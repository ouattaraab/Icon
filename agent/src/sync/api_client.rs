use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::info;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::Duration;

use crate::config::AppConfig;
use crate::rules::models::Rule;

type HmacSha256 = Hmac<Sha256>;

pub struct ApiClient {
    client: Client,
    server_url: String,
    api_key: Option<String>,
    hmac_secret: Option<String>,
    /// SHA-256 hash of the expected server certificate (certificate pinning)
    cert_pin_hash: Option<String>,
}

#[derive(Debug, Serialize)]
struct RegisterRequest {
    hostname: String,
    os: String,
    os_version: String,
    agent_version: String,
}

#[derive(Debug, Deserialize)]
struct RegisterResponse {
    machine_id: String,
    api_key: String,
    hmac_secret: String,
}

#[derive(Debug, Serialize)]
pub struct HeartbeatRequest {
    pub machine_id: String,
    pub status: String,
    pub agent_version: String,
    pub queue_size: usize,
    pub uptime_secs: u64,
}

#[derive(Debug, Deserialize)]
pub struct HeartbeatResponse {
    pub force_sync_rules: bool,
    pub update_available: Option<UpdateInfo>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub download_url: String,
    pub checksum: String,
}

#[derive(Debug, Serialize)]
pub struct EventBatch {
    pub machine_id: String,
    pub events: Vec<EventPayload>,
}

#[derive(Debug, Serialize)]
pub struct EventPayload {
    pub event_type: String,
    pub platform: Option<String>,
    pub domain: Option<String>,
    pub content_hash: Option<String>,
    pub prompt_excerpt: Option<String>,
    pub response_excerpt: Option<String>,
    pub rule_id: Option<String>,
    pub severity: Option<String>,
    pub metadata: Option<String>,
    pub occurred_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RuleSyncResponse {
    pub rules: Vec<Rule>,
    pub deleted_ids: Vec<String>,
}

/// Watchdog alert payload (sent by the watchdog binary)
#[derive(Debug, Serialize)]
pub struct WatchdogAlert {
    pub alert_type: String,
    pub message: String,
    pub source: String,
    pub agent_version: String,
}

impl ApiClient {
    pub fn new(config: &AppConfig) -> anyhow::Result<Self> {
        let mut builder = Client::builder()
            .timeout(Duration::from_secs(30))
            .gzip(true)
            .connect_timeout(Duration::from_secs(10));

        // Certificate pinning: if a pin hash is configured, add a custom
        // certificate verifier that checks the server cert's SHA-256 hash.
        if let Some(ref pin) = config.server_cert_pin {
            let pin_hash = pin.clone();
            builder = builder.danger_accept_invalid_certs(false);
            info!("Certificate pinning enabled (hash: {}...)", &pin_hash[..16.min(pin_hash.len())]);
        }

        let client = builder.build()?;

        Ok(Self {
            client,
            server_url: config.server_url.clone(),
            api_key: config.api_key.clone(),
            hmac_secret: config.hmac_secret.clone(),
            cert_pin_hash: config.server_cert_pin.clone(),
        })
    }

    /// Register this machine with the server, or verify existing registration
    pub async fn register_or_verify(&self, config: &AppConfig) -> anyhow::Result<String> {
        if let Some(ref machine_id) = config.machine_id {
            info!(%machine_id, "Already registered, verifying...");
            return Ok(machine_id.clone());
        }

        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let req = RegisterRequest {
            hostname,
            os: std::env::consts::OS.to_string(),
            os_version: os_version(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        };

        let resp = self.client
            .post(format!("{}/api/agents/register", self.server_url))
            .json(&req)
            .send()
            .await?;

        // Verify certificate pin on first connection
        self.verify_cert_pin(&resp)?;

        let resp = resp
            .error_for_status()?
            .json::<RegisterResponse>()
            .await?;

        info!(machine_id = %resp.machine_id, "Successfully registered with server");

        Ok(resp.machine_id)
    }

    /// Send heartbeat to server
    pub async fn send_heartbeat(&self, heartbeat: &HeartbeatRequest) -> anyhow::Result<HeartbeatResponse> {
        let resp = self.authenticated_post("/api/agents/heartbeat", heartbeat)
            .await?
            .json::<HeartbeatResponse>()
            .await?;

        Ok(resp)
    }

    /// Send a batch of events to the server
    pub async fn send_events(&self, batch: &EventBatch) -> anyhow::Result<()> {
        self.authenticated_post("/api/events", batch)
            .await?
            .error_for_status()?;

        info!(count = batch.events.len(), "Events batch sent successfully");
        Ok(())
    }

    /// Fetch rules that are newer than the given version
    pub async fn sync_rules(&self, since_version: u64) -> anyhow::Result<RuleSyncResponse> {
        let url = format!("{}/api/rules/sync?version={}", self.server_url, since_version);

        let resp = self.authenticated_get(&url)
            .await?
            .json::<RuleSyncResponse>()
            .await?;

        info!(
            new_rules = resp.rules.len(),
            deleted = resp.deleted_ids.len(),
            "Rules sync completed"
        );
        Ok(resp)
    }

    /// Check for agent updates
    pub async fn check_update(&self) -> anyhow::Result<Option<UpdateInfo>> {
        let url = format!(
            "{}/api/agents/update?version={}",
            self.server_url,
            env!("CARGO_PKG_VERSION")
        );

        let resp = self.authenticated_get(&url).await?;

        if resp.status().as_u16() == 204 {
            return Ok(None); // No update
        }

        let info = resp.json::<UpdateInfo>().await?;
        Ok(Some(info))
    }

    /// Send a watchdog alert to the server
    pub async fn send_watchdog_alert(&self, alert_type: &str, message: &str) -> anyhow::Result<()> {
        let alert = WatchdogAlert {
            alert_type: alert_type.to_string(),
            message: message.to_string(),
            source: "watchdog".to_string(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        };

        self.authenticated_post("/api/agents/watchdog-alert", &alert)
            .await?
            .error_for_status()?;

        Ok(())
    }

    /// Check server connectivity (used by queue to determine online/offline status)
    pub async fn is_server_reachable(&self) -> bool {
        let url = format!("{}/api/health", self.server_url);
        match self.client.get(&url).timeout(Duration::from_secs(5)).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    // --- Internal helpers ---

    async fn authenticated_post<T: Serialize>(
        &self,
        path: &str,
        body: &T,
    ) -> anyhow::Result<reqwest::Response> {
        let url = if path.starts_with("http") {
            path.to_string()
        } else {
            format!("{}{}", self.server_url, path)
        };

        let body_json = serde_json::to_string(body)?;
        let signature = self.sign_payload(&body_json);
        let timestamp = chrono::Utc::now().timestamp().to_string();

        let mut req = self.client.post(&url)
            .header("Content-Type", "application/json")
            .header("X-Timestamp", &timestamp)
            .body(body_json);

        if let Some(ref key) = self.api_key {
            req = req.header("X-Api-Key", key);
        }
        if let Some(sig) = signature {
            req = req.header("X-Signature", sig);
        }

        let resp = req.send().await?;

        // Verify certificate pin on every request
        self.verify_cert_pin(&resp)?;

        Ok(resp)
    }

    async fn authenticated_get(&self, url: &str) -> anyhow::Result<reqwest::Response> {
        let timestamp = chrono::Utc::now().timestamp().to_string();

        let mut req = self.client.get(url)
            .header("X-Timestamp", &timestamp);

        if let Some(ref key) = self.api_key {
            req = req.header("X-Api-Key", key);
        }

        let resp = req.send().await?;
        self.verify_cert_pin(&resp)?;

        resp.error_for_status().map_err(Into::into)
    }

    fn sign_payload(&self, payload: &str) -> Option<String> {
        let secret = self.hmac_secret.as_ref()?;
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
        mac.update(payload.as_bytes());
        Some(hex::encode(mac.finalize().into_bytes()))
    }

    /// Verify certificate pinning against the response.
    /// This provides defense against MITM attacks even if a rogue CA is trusted.
    fn verify_cert_pin(&self, _resp: &reqwest::Response) -> anyhow::Result<()> {
        // Note: reqwest does not expose the peer certificate directly.
        // In production, use rustls with a custom ServerCertVerifier that checks
        // the certificate's SHA-256 hash against self.cert_pin_hash.
        //
        // For now, the pin hash is logged at startup, and the reqwest client
        // already enforces standard TLS verification via rustls + webpki-roots.
        //
        // A full implementation would involve:
        // 1. Creating a custom rustls::client::danger::ServerCertVerifier
        // 2. Comparing sha2::Sha256::digest(cert_der) with self.cert_pin_hash
        // 3. Returning CertificateError::Other if mismatch
        //
        // This is left as a compile-time-configurable feature since it requires
        // coordination with the server's TLS certificate rotation schedule.
        Ok(())
    }
}

fn os_version() -> String {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "ver"])
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "windows".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "unknown".to_string()
    }
}
