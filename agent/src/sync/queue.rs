use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{warn, error, debug};

use crate::storage::database::Database;
use crate::sync::api_client::{ApiClient, EventBatch, EventPayload};

pub struct EventQueue {
    db: Arc<Database>,
    api_client: Arc<ApiClient>,
}

impl EventQueue {
    pub fn new(db: Arc<Database>, api_client: Arc<ApiClient>) -> Self {
        Self { db, api_client }
    }

    /// Log an event to the local queue (non-blocking)
    pub async fn log_event(
        &self,
        event_type: &str,
        platform: Option<&str>,
        domain: Option<&str>,
        content_hash: Option<&str>,
        prompt_excerpt: Option<&str>,
        response_excerpt: Option<&str>,
        rule_id: Option<&str>,
        severity: Option<&str>,
    ) {
        if let Err(e) = self.db.queue_event(
            event_type, platform, domain, content_hash,
            prompt_excerpt, response_excerpt, rule_id, severity, None,
        ) {
            error!(error = %e, "Failed to queue event locally");
        }
    }

    /// Log an event with additional metadata (e.g. DLP match details)
    pub async fn log_event_with_metadata(
        &self,
        event_type: &str,
        platform: Option<&str>,
        domain: Option<&str>,
        content_hash: Option<&str>,
        prompt_excerpt: Option<&str>,
        response_excerpt: Option<&str>,
        rule_id: Option<&str>,
        severity: Option<&str>,
        metadata: Option<&str>,
    ) {
        if let Err(e) = self.db.queue_event(
            event_type, platform, domain, content_hash,
            prompt_excerpt, response_excerpt, rule_id, severity, metadata,
        ) {
            error!(error = %e, "Failed to queue event locally");
        }
    }

    /// Main sync loop: periodically sends pending events to the server
    pub async fn run_sync_loop(&self) {
        let mut sync_interval = interval(Duration::from_secs(30));

        loop {
            sync_interval.tick().await;
            self.flush_pending().await;
        }
    }

    /// Attempt to send all pending events to the server
    async fn flush_pending(&self) {
        let batch_size = 100;

        loop {
            let events = match self.db.get_pending_events(batch_size) {
                Ok(events) => events,
                Err(e) => {
                    error!(error = %e, "Failed to read pending events");
                    return;
                }
            };

            if events.is_empty() {
                break;
            }

            let event_ids: Vec<i64> = events.iter().map(|e| e.id).collect();

            let batch = EventBatch {
                machine_id: self.get_machine_id(),
                events: events.into_iter().map(|e| EventPayload {
                    event_type: e.event_type,
                    platform: e.platform,
                    domain: e.domain,
                    content_hash: e.content_hash,
                    prompt_excerpt: e.prompt_excerpt,
                    response_excerpt: e.response_excerpt,
                    rule_id: e.rule_id,
                    severity: e.severity,
                    metadata: e.metadata,
                    occurred_at: e.occurred_at,
                }).collect(),
            };

            match self.api_client.send_events(&batch).await {
                Ok(()) => {
                    if let Err(e) = self.db.mark_events_synced(&event_ids) {
                        error!(error = %e, "Failed to mark events as synced");
                    }
                    debug!(count = event_ids.len(), "Events synced successfully");
                }
                Err(e) => {
                    warn!(error = %e, "Failed to sync events, will retry later");
                    return; // Server unreachable, stop trying
                }
            }
        }
    }

    fn get_machine_id(&self) -> String {
        self.db
            .get_config("machine_id")
            .ok()
            .flatten()
            .unwrap_or_else(|| "unregistered".to_string())
    }
}
