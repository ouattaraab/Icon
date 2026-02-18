use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;
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

    // Track the last version we attempted to update to, so we don't retry
    // the same failed update on every heartbeat cycle.
    let last_attempted_update_version: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));

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

                // Handle available update — only attempt once per version
                if let Some(update) = resp.update_available {
                    let mut last_version = last_attempted_update_version.lock().await;
                    let already_attempted = last_version
                        .as_ref()
                        .map(|v| v == &update.version)
                        .unwrap_or(false);

                    if already_attempted {
                        debug!(
                            version = %update.version,
                            "Skipping update, already attempted this version"
                        );
                    } else {
                        info!(
                            version = %update.version,
                            download_url = %update.download_url,
                            "Update available, starting auto-update"
                        );

                        // Record the version before attempting so we don't retry on failure
                        *last_version = Some(update.version.clone());

                        // Release the lock before the potentially long download
                        drop(last_version);

                        match updater::apply_update(&update).await {
                            Ok(()) => {
                                info!(
                                    version = %update.version,
                                    "Update applied successfully, agent will restart"
                                );
                            }
                            Err(e) => {
                                error!(
                                    error = %e,
                                    version = %update.version,
                                    "Auto-update failed, will not retry this version"
                                );
                            }
                        }
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
