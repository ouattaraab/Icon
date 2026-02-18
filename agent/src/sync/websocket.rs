use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::connect_async;
use futures_util::{SinkExt, StreamExt};
use tracing::{info, warn, error, debug};
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::rules::engine::RuleEngine;
use crate::rules::models::Rule;

// ---------------------------------------------------------------------------
// Pusher protocol messages (used by Laravel Reverb)
// ---------------------------------------------------------------------------

/// Incoming frame from the Reverb server
#[derive(Debug, Deserialize)]
struct PusherFrame {
    event: String,
    #[serde(default)]
    channel: Option<String>,
    /// Always a JSON-encoded string in the Pusher protocol
    #[serde(default)]
    data: Option<String>,
}

/// Outgoing frame to the Reverb server
#[derive(Debug, Serialize)]
struct PusherOutgoing {
    event: String,
    data: serde_json::Value,
}

/// Data received after connection is established
#[derive(Debug, Deserialize)]
struct ConnectionEstablishedData {
    socket_id: String,
    #[serde(default = "default_activity_timeout")]
    activity_timeout: u64,
}

fn default_activity_timeout() -> u64 {
    30
}

// ---------------------------------------------------------------------------
// Rule channel event payloads (from Laravel broadcasts)
// ---------------------------------------------------------------------------

/// Payload for the `rule.changed` event
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct RuleChangedPayload {
    action: String,
    rule: Option<Rule>,
    #[serde(default)]
    rule_id: Option<String>,
    #[serde(default)]
    version: Option<u64>,
}

/// Payload for the `rule.deleted` event
#[derive(Debug, Deserialize)]
struct RuleDeletedPayload {
    rule_id: String,
    #[serde(default)]
    rule_name: Option<String>,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Listen for real-time rule updates from the Reverb server via the Pusher
/// WebSocket protocol. Reconnects automatically on disconnection.
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

        info!(delay_secs = reconnect_delay.as_secs(), "Reconnecting to Reverb...");
        sleep(reconnect_delay).await;
    }
}

// ---------------------------------------------------------------------------
// Connection & main loop
// ---------------------------------------------------------------------------

async fn connect_and_listen(
    config: &AppConfig,
    rule_engine: &Arc<RuleEngine>,
) -> anyhow::Result<()> {
    // Build the Pusher-compatible WebSocket URL:
    //   ws(s)://host:port/app/{app_key}?protocol=7&client=icon-agent&version=0.1.0
    let base = config.websocket_url.trim_end_matches('/');
    let app_key = config.reverb_app_key.as_deref().unwrap_or("icon-local-key");
    let url = format!(
        "{base}/app/{app_key}?protocol=7&client=icon-agent&version=0.1.0&flash=false"
    );
    let channel = config
        .reverb_channel
        .as_deref()
        .unwrap_or("icon.rules");

    info!(%url, %channel, "Connecting to Reverb WebSocket");

    let (ws_stream, _) = connect_async(&url).await?;
    info!("WebSocket connected to Reverb");

    let (mut write, mut read) = ws_stream.split();

    // 1. Wait for `pusher:connection_established`
    let activity_timeout = wait_for_connection(&mut read).await?;
    info!(activity_timeout, "Reverb connection established");

    // 2. Subscribe to the rules channel
    let subscribe_msg = PusherOutgoing {
        event: "pusher:subscribe".into(),
        data: serde_json::json!({ "channel": channel }),
    };
    let json = serde_json::to_string(&subscribe_msg)?;
    write
        .send(tokio_tungstenite::tungstenite::Message::Text(json.into()))
        .await?;
    info!(%channel, "Subscribed to Reverb channel");

    // 3. Main read loop — handle events, pings, etc.
    while let Some(msg) = read.next().await {
        match msg {
            Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                debug!(len = text.len(), "Reverb frame received");

                if let Some(pong) = handle_frame(&text, channel, rule_engine).await {
                    write
                        .send(tokio_tungstenite::tungstenite::Message::Text(pong.into()))
                        .await?;
                }
            }
            Ok(tokio_tungstenite::tungstenite::Message::Ping(data)) => {
                debug!("WebSocket ping received");
                write
                    .send(tokio_tungstenite::tungstenite::Message::Pong(data))
                    .await?;
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

/// Wait for the initial `pusher:connection_established` frame.
/// Returns the activity_timeout in seconds.
async fn wait_for_connection<S>(read: &mut S) -> anyhow::Result<u64>
where
    S: StreamExt<Item = Result<tokio_tungstenite::tungstenite::Message, tokio_tungstenite::tungstenite::Error>>
        + Unpin,
{
    while let Some(msg) = read.next().await {
        if let Ok(tokio_tungstenite::tungstenite::Message::Text(text)) = msg {
            if let Ok(frame) = serde_json::from_str::<PusherFrame>(&text) {
                if frame.event == "pusher:connection_established" {
                    if let Some(data_str) = &frame.data {
                        if let Ok(data) =
                            serde_json::from_str::<ConnectionEstablishedData>(data_str)
                        {
                            info!(socket_id = %data.socket_id, "Pusher connection established");
                            return Ok(data.activity_timeout);
                        }
                    }
                    // Got the event even if we couldn't parse data fully
                    return Ok(30);
                }
            }
        }
    }

    anyhow::bail!("WebSocket closed before receiving connection_established")
}

// ---------------------------------------------------------------------------
// Frame handling
// ---------------------------------------------------------------------------

/// Handle a single Pusher protocol frame. Returns an optional response to send
/// back (e.g. `pusher:pong`).
async fn handle_frame(
    text: &str,
    channel: &str,
    rule_engine: &Arc<RuleEngine>,
) -> Option<String> {
    let frame: PusherFrame = match serde_json::from_str(text) {
        Ok(f) => f,
        Err(e) => {
            warn!(error = %e, "Failed to parse Pusher frame");
            return None;
        }
    };

    match frame.event.as_str() {
        // --- Pusher protocol events ---
        "pusher:ping" => {
            debug!("Pusher ping — sending pong");
            let pong = PusherOutgoing {
                event: "pusher:pong".into(),
                data: serde_json::json!({}),
            };
            serde_json::to_string(&pong).ok()
        }

        "pusher_internal:subscription_succeeded" => {
            info!(channel = ?frame.channel, "Channel subscription confirmed");
            None
        }

        "pusher:error" => {
            error!(data = ?frame.data, "Pusher error received");
            None
        }

        // --- Application events (from Laravel broadcasts) ---
        "rule.changed" => {
            if frame.channel.as_deref() == Some(channel) {
                handle_rule_changed(frame.data.as_deref(), rule_engine).await;
            }
            None
        }

        "rule.deleted" => {
            if frame.channel.as_deref() == Some(channel) {
                handle_rule_deleted(frame.data.as_deref(), rule_engine).await;
            }
            None
        }

        _ => {
            debug!(event = %frame.event, "Ignoring unknown Pusher event");
            None
        }
    }
}

/// Handle a `rule.changed` broadcast event (created / updated / toggled).
async fn handle_rule_changed(data: Option<&str>, rule_engine: &Arc<RuleEngine>) {
    let data_str = match data {
        Some(s) => s,
        None => {
            warn!("rule.changed event has no data");
            return;
        }
    };

    match serde_json::from_str::<RuleChangedPayload>(data_str) {
        Ok(payload) => {
            info!(action = %payload.action, "Rule change received via Reverb");

            match payload.action.as_str() {
                "created" | "updated" | "toggled" => {
                    if let Some(rule) = payload.rule {
                        info!(rule_id = %rule.id, rule_name = %rule.name, "Applying rule update");
                        if let Err(e) = rule_engine.update_rules(vec![rule]).await {
                            error!(error = %e, "Failed to apply rule update");
                        }
                    } else {
                        // No rule payload — trigger a full sync
                        info!("No rule data in payload, triggering full sync");
                        if let Err(e) = rule_engine.load_rules().await {
                            error!(error = %e, "Failed to reload rules");
                        }
                    }
                }
                "deleted" => {
                    if let Some(rule_id) = payload.rule_id {
                        info!(%rule_id, "Deleting rule via change event");
                        if let Err(e) = rule_engine.delete_rule(&rule_id).await {
                            error!(error = %e, "Failed to delete rule");
                        }
                    }
                }
                other => {
                    warn!(action = %other, "Unknown rule change action");
                }
            }
        }
        Err(e) => {
            warn!(error = %e, "Failed to parse rule.changed payload");
        }
    }
}

/// Handle a `rule.deleted` broadcast event.
async fn handle_rule_deleted(data: Option<&str>, rule_engine: &Arc<RuleEngine>) {
    let data_str = match data {
        Some(s) => s,
        None => {
            warn!("rule.deleted event has no data");
            return;
        }
    };

    match serde_json::from_str::<RuleDeletedPayload>(data_str) {
        Ok(payload) => {
            info!(
                rule_id = %payload.rule_id,
                rule_name = ?payload.rule_name,
                "Rule deleted via Reverb"
            );
            if let Err(e) = rule_engine.delete_rule(&payload.rule_id).await {
                error!(error = %e, "Failed to delete rule");
            }
        }
        Err(e) => {
            warn!(error = %e, "Failed to parse rule.deleted payload");
        }
    }
}
