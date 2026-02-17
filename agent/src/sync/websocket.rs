use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::connect_async;
use futures_util::StreamExt;
use tracing::{info, warn, error, debug};
use serde::Deserialize;

use crate::config::AppConfig;
use crate::rules::engine::RuleEngine;
use crate::rules::models::Rule;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerMessage {
    RuleUpdated { rule: Rule },
    RuleDeleted { rule_id: String },
    ForceSync,
    Restart,
}

/// Listen for real-time updates from the server via WebSocket
pub async fn listen_for_updates(config: AppConfig, rule_engine: Arc<RuleEngine>) {
    let reconnect_delay = Duration::from_secs(5);

    loop {
        match connect_and_listen(&config, &rule_engine).await {
            Ok(()) => {
                info!("WebSocket connection closed normally");
            }
            Err(e) => {
                warn!(error = %e, "WebSocket connection failed");
            }
        }

        info!(delay_secs = reconnect_delay.as_secs(), "Reconnecting...");
        sleep(reconnect_delay).await;
    }
}

async fn connect_and_listen(
    config: &AppConfig,
    rule_engine: &Arc<RuleEngine>,
) -> anyhow::Result<()> {
    let url = &config.websocket_url;
    info!(url, "Connecting to WebSocket server");

    let (ws_stream, _) = connect_async(url).await?;
    info!("WebSocket connected");

    let (_, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                debug!(len = text.len(), "WebSocket message received");
                handle_message(&text, rule_engine).await;
            }
            Ok(tokio_tungstenite::tungstenite::Message::Ping(_)) => {
                debug!("WebSocket ping received");
            }
            Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                info!("WebSocket close frame received");
                break;
            }
            Err(e) => {
                error!(error = %e, "WebSocket error");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn handle_message(text: &str, rule_engine: &Arc<RuleEngine>) {
    match serde_json::from_str::<ServerMessage>(text) {
        Ok(ServerMessage::RuleUpdated { rule }) => {
            info!(rule_id = %rule.id, rule_name = %rule.name, "Rule updated via WebSocket");
            if let Err(e) = rule_engine.update_rules(vec![rule]).await {
                error!(error = %e, "Failed to apply rule update");
            }
        }
        Ok(ServerMessage::RuleDeleted { rule_id }) => {
            info!(%rule_id, "Rule deleted via WebSocket");
            if let Err(e) = rule_engine.delete_rule(&rule_id).await {
                error!(error = %e, "Failed to delete rule");
            }
        }
        Ok(ServerMessage::ForceSync) => {
            info!("Force sync requested via WebSocket");
            if let Err(e) = rule_engine.load_rules().await {
                error!(error = %e, "Failed to reload rules");
            }
        }
        Ok(ServerMessage::Restart) => {
            info!("Restart requested via WebSocket");
            // TODO: graceful restart
        }
        Err(e) => {
            warn!(error = %e, "Failed to parse WebSocket message");
        }
    }
}
