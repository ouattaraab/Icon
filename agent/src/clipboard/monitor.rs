use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{info, debug};
use sha2::{Sha256, Digest};

use crate::rules::engine::RuleEngine;
use crate::rules::models::{EvaluationResult, RuleTarget};
use crate::sync::queue::EventQueue;

/// Start clipboard monitoring loop
/// Polls the system clipboard every 500ms and checks content against DLP rules
pub async fn start_monitoring(
    rule_engine: Arc<RuleEngine>,
    event_queue: Arc<EventQueue>,
) -> anyhow::Result<()> {
    info!("Clipboard monitor started");

    let mut poll_interval = interval(Duration::from_millis(500));
    let mut last_content_hash: Option<String> = None;

    loop {
        poll_interval.tick().await;

        // Get current clipboard text content
        let content = match get_clipboard_text() {
            Some(text) if !text.is_empty() => text,
            _ => continue,
        };

        // Compute hash to detect changes
        let hash = compute_hash(&content);
        if last_content_hash.as_deref() == Some(&hash) {
            continue; // No change
        }
        last_content_hash = Some(hash.clone());

        debug!(len = content.len(), "Clipboard content changed");

        // Evaluate against DLP rules
        let result = rule_engine.evaluate(&content, RuleTarget::Clipboard).await;

        match result {
            EvaluationResult::Blocked { rule_id, rule_name, message: _ } => {
                info!(%rule_name, "Clipboard content matched blocking rule");
                // Note: We can't block clipboard content, but we log it as critical
                event_queue.log_event(
                    "clipboard_block",
                    None,
                    None,
                    Some(&hash),
                    Some(&truncate(&content, 500)),
                    None,
                    Some(&rule_id),
                    Some("critical"),
                ).await;
            }
            EvaluationResult::Alerted { rule_id, rule_name, severity } => {
                info!(%rule_name, "Clipboard content triggered alert");
                let sev = format!("{:?}", severity).to_lowercase();
                event_queue.log_event(
                    "clipboard_alert",
                    None,
                    None,
                    Some(&hash),
                    Some(&truncate(&content, 500)),
                    None,
                    Some(&rule_id),
                    Some(&sev),
                ).await;
            }
            EvaluationResult::Logged { rule_id } => {
                debug!("Clipboard content logged");
                event_queue.log_event(
                    "clipboard_log",
                    None,
                    None,
                    Some(&hash),
                    Some(&truncate(&content, 200)),
                    None,
                    rule_id.as_deref(),
                    Some("info"),
                ).await;
            }
            EvaluationResult::NoMatch => {
                // No rule matched — no action needed
            }
        }
    }
}

/// Get the current clipboard text (platform-specific)
fn get_clipboard_text() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        super::macos::get_clipboard_text()
    }

    #[cfg(target_os = "windows")]
    {
        super::windows::get_clipboard_text()
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

fn compute_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    hex::encode(hasher.finalize())
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        s[..max_len].to_string()
    }
}
