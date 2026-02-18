mod config;
mod clipboard;
mod proxy;
mod rules;
mod service;
mod storage;
mod sync;
mod update;

use clap::Parser;
use tracing::{info, warn, error};
use std::path::PathBuf;
use std::sync::Arc;

use crate::config::AppConfig;
use crate::proxy::domain_filter::DomainFilter;
use crate::proxy::tls::CaManager;
use crate::storage::database::Database;
use crate::rules::engine::RuleEngine;
use crate::sync::api_client::ApiClient;
use crate::sync::queue::EventQueue;

/// Icon Agent - Endpoint monitoring agent for GS2E
#[derive(Parser, Debug)]
#[command(
    name = "icon-agent",
    version,
    about = "Icon Agent - AI-powered endpoint monitoring agent"
)]
struct Cli {
    /// Generate a default config.toml file and exit.
    /// The file is written to the default platform location unless --config-path is specified.
    #[arg(long)]
    generate_config: bool,

    /// Path to the configuration file.
    /// Overrides the default platform-specific path.
    #[arg(long, value_name = "FILE")]
    config_path: Option<PathBuf>,

    /// Run as a Windows Service (called by SCM, not intended for manual use).
    #[arg(long)]
    service: bool,

    /// Install the agent as a system service and exit.
    #[arg(long)]
    install_service: bool,

    /// Uninstall the agent system service and exit.
    #[arg(long)]
    uninstall_service: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    // Handle --generate-config: write a default config and exit immediately
    if cli.generate_config {
        return handle_generate_config(&cli.config_path);
    }

    // Handle --install-service
    if cli.install_service {
        return handle_install_service();
    }

    // Handle --uninstall-service
    if cli.uninstall_service {
        return handle_uninstall_service();
    }

    // Handle --service: start as a Windows Service via SCM
    if cli.service {
        #[cfg(target_os = "windows")]
        {
            service::windows::run_as_service()
                .map_err(|e| anyhow::anyhow!("Windows Service dispatcher failed: {}", e))?;
            return Ok(());
        }

        #[cfg(not(target_os = "windows"))]
        {
            anyhow::bail!("--service flag is only supported on Windows");
        }
    }

    // Normal agent startup flow — run interactively
    run_agent(&cli.config_path).await
}

/// Main agent logic. Called by both interactive mode and Windows Service mode.
pub async fn run_agent(config_path: &Option<PathBuf>) -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("icon_agent=info".parse().unwrap()),
        )
        .json()
        .init();

    info!("Icon Agent v{} starting...", env!("CARGO_PKG_VERSION"));

    // Load configuration (file + env vars)
    let mut config = match config_path {
        Some(path) => AppConfig::load_from(Some(path))?,
        None => AppConfig::load()?,
    };
    info!(server_url = %config.server_url, "Configuration loaded");

    // Initialize encrypted local database
    let db = Arc::new(Database::init(&config.data_dir, &config.db_encryption_key)?);
    db.run_migrations()?;
    info!("Local database initialized");

    // Restore persisted credentials from local DB if not in config
    restore_credentials_from_db(&db, &mut config);

    // Initialize components
    let mut api_client = ApiClient::new(&config)?;
    let rule_engine = Arc::new(RuleEngine::new(db.clone()));

    // Load cached rules from local DB
    if let Err(e) = rule_engine.load_rules().await {
        warn!(error = %e, "Failed to load cached rules from local DB");
    }

    // Register with server or use existing credentials
    if let Some(mid) = &config.machine_id {
        info!(machine_id = %mid, "Using persisted credentials");
    } else {
        match api_client.register().await {
            Ok(resp) => {
                info!(machine_id = %resp.machine_id, "Registered with server");

                // Persist credentials to local encrypted DB
                if let Err(e) = persist_credentials(&db, &resp) {
                    error!(error = %e, "Failed to persist credentials to local DB");
                }

                // Update config and API client with new credentials
                config.machine_id = Some(resp.machine_id);
                config.api_key = Some(resp.api_key.clone());
                config.hmac_secret = Some(resp.hmac_secret.clone());
                api_client.set_credentials(resp.api_key, resp.hmac_secret);
            }
            Err(e) => {
                error!(error = %e, "Failed to register with server, running in offline mode");
            }
        }
    }

    let api_client = Arc::new(api_client);
    let event_queue = Arc::new(EventQueue::new(
        db.clone(),
        api_client.clone(),
        config.event_sync_interval_secs,
        config.event_batch_size,
    ));

    // Initialize domain filter with defaults
    let domain_filter = Arc::new(DomainFilter::with_defaults());

    // Sync rules from server (updates local cache)
    if let Err(e) = sync::rules_sync::sync_rules(&api_client, &rule_engine).await {
        error!(error = %e, "Failed to sync rules, using cached rules");
    }

    // Sync monitored domains from server
    sync_domains_from_server(&api_client, &domain_filter).await;

    // -----------------------------------------------------------------------
    // First-boot setup: install CA certificate and configure system proxy
    // -----------------------------------------------------------------------
    let ca_manager = CaManager::load_or_create(&config.data_dir)?;

    // Install the CA certificate in the OS trust store so the MITM proxy is
    // transparently trusted by browsers and other TLS clients.
    if let Err(e) = ca_manager.install_in_trust_store() {
        error!(error = %e, "Failed to install CA certificate in trust store — \
            HTTPS interception will not work until the certificate is trusted");
    } else {
        info!("CA certificate installed in system trust store");
    }

    // Configure the OS to use our PAC file so that monitored AI domains are
    // automatically routed through the local MITM proxy.
    let pac_url = format!("http://127.0.0.1:{}/proxy.pac", config.proxy_port);
    if let Err(e) = proxy::system_proxy::configure_system_proxy(&pac_url) {
        error!(error = %e, "Failed to configure system proxy — \
            traffic will not be routed through the agent");
    } else {
        info!(pac_url = %pac_url, "System proxy configured");
    }

    // Start all subsystems concurrently
    let proxy_handle = {
        let re = rule_engine.clone();
        let eq = event_queue.clone();
        let cfg = config.clone();
        let df = domain_filter.clone();
        tokio::spawn(async move {
            if let Err(e) = proxy::interceptor::start_proxy(cfg, re, eq, df).await {
                error!(error = %e, "Proxy interceptor failed");
            }
        })
    };

    let clipboard_handle = {
        let re = rule_engine.clone();
        let eq = event_queue.clone();
        let monitor_config = clipboard::monitor::ClipboardMonitorConfig::from_app_config(&config);
        tokio::spawn(async move {
            if let Err(e) = clipboard::monitor::start_monitoring(re, eq, monitor_config).await {
                error!(error = %e, "Clipboard monitor failed");
            }
        })
    };

    let heartbeat_handle = {
        let client = api_client.clone();
        let cfg = config.clone();
        let re = rule_engine.clone();
        let heartbeat_db = db.clone();
        tokio::spawn(async move {
            sync::heartbeat::run_heartbeat_loop(client, cfg, re, heartbeat_db).await;
        })
    };

    let queue_handle = {
        let eq = event_queue.clone();
        tokio::spawn(async move {
            eq.run_sync_loop().await;
        })
    };

    let websocket_handle = {
        let re = rule_engine.clone();
        let cfg = config.clone();
        tokio::spawn(async move {
            sync::websocket::listen_for_updates(cfg, re).await;
        })
    };

    info!("All subsystems started. Icon Agent is running.");

    // -----------------------------------------------------------------------
    // Graceful shutdown: remove system proxy when the agent exits
    // -----------------------------------------------------------------------
    // Wait for any subsystem to exit (they shouldn't under normal operation)
    // or for a SIGTERM / Ctrl+C signal.
    let shutdown_signal = async {
        // Listen for SIGTERM (Unix) or Ctrl+C
        #[cfg(unix)]
        {
            use tokio::signal::unix::{signal, SignalKind};
            let mut sigterm = signal(SignalKind::terminate())
                .expect("failed to register SIGTERM handler");
            tokio::select! {
                _ = sigterm.recv() => {
                    info!("Received SIGTERM, shutting down...");
                }
                _ = tokio::signal::ctrl_c() => {
                    info!("Received Ctrl+C, shutting down...");
                }
            }
        }
        #[cfg(not(unix))]
        {
            let _ = tokio::signal::ctrl_c().await;
            info!("Received shutdown signal, shutting down...");
        }
    };

    tokio::select! {
        r = proxy_handle => error!(?r, "Proxy exited unexpectedly"),
        r = clipboard_handle => error!(?r, "Clipboard monitor exited unexpectedly"),
        r = heartbeat_handle => error!(?r, "Heartbeat exited unexpectedly"),
        r = queue_handle => error!(?r, "Event queue exited unexpectedly"),
        r = websocket_handle => error!(?r, "WebSocket listener exited unexpectedly"),
        _ = shutdown_signal => {
            info!("Shutdown signal received");
        }
    }

    // Clean up: remove system proxy configuration so the OS does not try to
    // route traffic through a proxy that is no longer running.
    info!("Removing system proxy configuration...");
    if let Err(e) = proxy::system_proxy::remove_system_proxy() {
        error!(error = %e, "Failed to remove system proxy configuration during shutdown");
    } else {
        info!("System proxy configuration removed");
    }

    Ok(())
}

/// Handle the --generate-config CLI flag: write a default config.toml and exit.
fn handle_generate_config(config_path_override: &Option<PathBuf>) -> anyhow::Result<()> {
    let target_path = match config_path_override {
        Some(p) => p.clone(),
        None => AppConfig::default_config_path(),
    };

    // Ensure the parent directory exists
    if let Some(parent) = target_path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
            eprintln!("Created directory: {}", parent.display());
        }
    }

    let content = AppConfig::generate_default_config_toml();
    std::fs::write(&target_path, &content)?;

    println!("Default configuration written to: {}", target_path.display());
    println!(
        "Edit this file to customize the agent configuration before starting the service."
    );

    Ok(())
}

/// Handle the --install-service CLI flag: install the platform service and exit.
fn handle_install_service() -> anyhow::Result<()> {
    let binary_path = std::env::current_exe()?;
    let binary_str = binary_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Binary path is not valid UTF-8"))?;

    #[cfg(target_os = "windows")]
    {
        service::windows::install_service(binary_str)?;
        println!("Windows Service installed. Start with: sc start IconAgent");
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let _ = binary_str;
        service::macos::install_service()?;
        println!("LaunchDaemon installed and loaded.");
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = binary_str;
        anyhow::bail!("Service installation is not supported on this platform");
    }
}

/// Handle the --uninstall-service CLI flag: uninstall the platform service and exit.
fn handle_uninstall_service() -> anyhow::Result<()> {
    #[cfg(target_os = "windows")]
    {
        service::windows::uninstall_service()?;
        println!("Windows Service uninstalled.");
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        service::macos::uninstall_service()?;
        println!("LaunchDaemon uninstalled.");
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        anyhow::bail!("Service uninstallation is not supported on this platform");
    }
}

/// Restore machine_id, api_key, and hmac_secret from the local encrypted DB.
/// This allows the agent to survive config file loss or reinstallation.
fn restore_credentials_from_db(db: &Database, config: &mut AppConfig) {
    if config.machine_id.is_none() {
        if let Ok(Some(mid)) = db.get_config("machine_id") {
            info!("Restored machine_id from local DB");
            config.machine_id = Some(mid);
        }
    }
    if config.api_key.is_none() {
        if let Ok(Some(key)) = db.get_config("api_key") {
            info!("Restored api_key from local DB");
            config.api_key = Some(key);
        }
    }
    if config.hmac_secret.is_none() {
        if let Ok(Some(secret)) = db.get_config("hmac_secret") {
            info!("Restored hmac_secret from local DB");
            config.hmac_secret = Some(secret);
        }
    }
}

/// Persist registration credentials to the local encrypted DB.
fn persist_credentials(
    db: &Database,
    resp: &sync::api_client::RegisterResponse,
) -> anyhow::Result<()> {
    db.set_config("machine_id", &resp.machine_id)?;
    db.set_config("api_key", &resp.api_key)?;
    db.set_config("hmac_secret", &resp.hmac_secret)?;
    info!("Credentials persisted to local encrypted DB");
    Ok(())
}

/// Fetch monitored domains from the server and update the DomainFilter.
async fn sync_domains_from_server(api_client: &ApiClient, domain_filter: &DomainFilter) {
    match api_client.sync_domains().await {
        Ok(resp) => {
            let domains: Vec<(String, bool)> = resp
                .domains
                .into_iter()
                .map(|d| (d.domain, d.is_blocked))
                .collect();
            let count = domains.len();
            domain_filter.update_domains(domains).await;
            info!(count, "Domain filter updated from server");
        }
        Err(e) => {
            warn!(error = %e, "Failed to sync domains, using defaults");
        }
    }
}
