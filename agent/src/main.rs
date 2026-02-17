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

    // Load configuration
    let config = AppConfig::load()?;
    info!(server_url = %config.server_url, "Configuration loaded");

    // Initialize encrypted local database
    let db = Arc::new(Database::init(&config.data_dir, &config.db_encryption_key)?);
    db.run_migrations()?;
    info!("Local database initialized");

    // Initialize components
    let rule_engine = Arc::new(RuleEngine::new(db.clone()));
    let api_client = Arc::new(ApiClient::new(&config)?);
    let event_queue = Arc::new(EventQueue::new(db.clone(), api_client.clone()));

    // Load cached rules from local DB
    if let Err(e) = rule_engine.load_rules().await {
        warn!(error = %e, "Failed to load cached rules from local DB");
    }

    // Register with server (or verify registration)
    match api_client.register_or_verify(&config).await {
        Ok(machine_id) => info!(%machine_id, "Registered with server"),
        Err(e) => {
            error!(error = %e, "Failed to register with server, running in offline mode");
        }
    }

    // Sync rules from server (updates local cache)
    if let Err(e) = sync::rules_sync::sync_rules(&api_client, &rule_engine).await {
        error!(error = %e, "Failed to sync rules, using cached rules");
    }

    // Start all subsystems concurrently
    let proxy_handle = {
        let re = rule_engine.clone();
        let eq = event_queue.clone();
        let cfg = config.clone();
        tokio::spawn(async move {
            if let Err(e) = proxy::interceptor::start_proxy(cfg, re, eq).await {
                error!(error = %e, "Proxy interceptor failed");
            }
        })
    };

    let clipboard_handle = {
        let re = rule_engine.clone();
        let eq = event_queue.clone();
        tokio::spawn(async move {
            if let Err(e) = clipboard::monitor::start_monitoring(re, eq).await {
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
