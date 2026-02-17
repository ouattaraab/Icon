use std::sync::Arc;
use std::time::Instant;
use tokio::time::{interval, Duration};
use tracing::{info, warn, debug, error};

use crate::config::AppConfig;
use crate::rules::engine::RuleEngine;
use crate::storage::database::Database;
use crate::sync::api_client::{ApiClient, HeartbeatRequest};
use crate::update::updater;

pub async fn run_heartbeat_loop(
    api_client: Arc<ApiClient>,
    config: AppConfig,
    rule_engine: Arc<RuleEngine>,
    db: Arc<Database>,
) {
    let mut heartbeat_interval = interval(Duration::from_secs(config.heartbeat_interval_secs));
    let start_time = Instant::now();

    let machine_id = config.machine_id.clone().unwrap_or_else(|| "unregistered".to_string());

    loop {
        heartbeat_interval.tick().await;

        // Get actual queue size from database
        let queue_size = db.get_pending_events(1)
            .map(|events| events.len())
            .unwrap_or(0);

        let req = HeartbeatRequest {
            machine_id: machine_id.clone(),
            status: "active".to_string(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
            queue_size,
            uptime_secs: start_time.elapsed().as_secs(),
        };

        match api_client.send_heartbeat(&req).await {
            Ok(resp) => {
                debug!("Heartbeat sent successfully");

                // Handle force rule sync
                if resp.force_sync_rules {
                    info!("Server requested force rule sync");
                    if let Err(e) = crate::sync::rules_sync::sync_rules(&api_client, &rule_engine).await {
                        error!(error = %e, "Force rule sync failed");
                    }
                }

                // Handle available update
                if let Some(update) = resp.update_available {
                    info!(version = %update.version, "Update available, starting auto-update");
                    match updater::apply_update(&update).await {
                        Ok(()) => info!("Update applied successfully"),
                        Err(e) => error!(error = %e, "Auto-update failed"),
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, "Heartbeat failed, server may be unreachable");
            }
        }

        // Periodic local maintenance: purge old events
        let retention_days = config.local_retention_days;
        if let Err(e) = db.purge_old_events(retention_days) {
            warn!(error = %e, "Failed to purge old events from local DB");
        }
    }
}
