mod config;
mod clipboard;
mod proxy;
mod rules;
mod storage;
mod sync;
mod update;
mod watchdog;

use tracing::{info, warn, error};
use std::sync::Arc;

use crate::config::AppConfig;
use crate::proxy::domain_filter::DomainFilter;
use crate::storage::database::Database;
use crate::rules::engine::RuleEngine;
use crate::sync::api_client::ApiClient;
use crate::sync::queue::EventQueue;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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
    let mut config = AppConfig::load()?;
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
    if config.machine_id.is_some() {
        info!(machine_id = %config.machine_id.as_ref().unwrap(), "Using persisted credentials");
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
    let event_queue = Arc::new(EventQueue::new(db.clone(), api_client.clone()));

    // Initialize domain filter with defaults
    let domain_filter = Arc::new(DomainFilter::with_defaults());

    // Sync rules from server (updates local cache)
    if let Err(e) = sync::rules_sync::sync_rules(&api_client, &rule_engine).await {
        error!(error = %e, "Failed to sync rules, using cached rules");
    }

    // Sync monitored domains from server
    sync_domains_from_server(&api_client, &domain_filter).await;

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

    // Wait for any subsystem to exit (they shouldn't under normal operation)
    tokio::select! {
        r = proxy_handle => error!(?r, "Proxy exited unexpectedly"),
        r = clipboard_handle => error!(?r, "Clipboard monitor exited unexpectedly"),
        r = heartbeat_handle => error!(?r, "Heartbeat exited unexpectedly"),
        r = queue_handle => error!(?r, "Event queue exited unexpectedly"),
        r = websocket_handle => error!(?r, "WebSocket listener exited unexpectedly"),
    }

    Ok(())
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
