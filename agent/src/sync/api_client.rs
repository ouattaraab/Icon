use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::info;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::Duration;

use crate::config::AppConfig;
use crate::rules::models::Rule;
use crate::sync::cert_pinning;

type HmacSha256 = Hmac<Sha256>;

pub struct ApiClient {
    client: Client,
    server_url: String,
    api_key: Option<String>,
    hmac_secret: Option<String>,
    enrollment_key: Option<String>,
}

#[derive(Debug, Serialize)]
struct RegisterRequest {
    hostname: String,
    os: String,
    os_version: String,
    agent_version: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterResponse {
    pub machine_id: String,
    pub api_key: String,
    pub hmac_secret: String,
}

/// Domain entry from the /api/domains/sync endpoint
#[derive(Debug, Deserialize)]
// Fields populated by serde deserialization from server JSON responses
#[allow(dead_code)]
pub struct DomainEntry {
    pub domain: String,
    pub platform_name: Option<String>,
    pub is_blocked: bool,
}

#[derive(Debug, Deserialize)]
pub struct DomainSyncResponse {
    pub domains: Vec<DomainEntry>,
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
// Used by the icon-watchdog binary, not the main agent
#[allow(dead_code)]
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

        // Certificate pinning: if a pin hash is configured, build a custom
        // rustls ClientConfig with a PinnedCertVerifier that checks the server
        // cert's SHA-256 hash at the TLS layer. Otherwise, use a default
        // rustls config with webpki-roots.
        if let Some(ref pin) = config.server_cert_pin {
            let tls_config = cert_pinning::create_pinned_tls_config(pin);
            builder = builder.use_preconfigured_tls(tls_config);
            info!(
                "Certificate pinning enabled (hash: {}...)",
                &pin[..16.min(pin.len())]
            );
        } else {
            let tls_config = cert_pinning::create_default_tls_config();
            builder = builder.use_preconfigured_tls(tls_config);
        }

        let client = builder.build()?;

        Ok(Self {
            client,
            server_url: config.server_url.clone(),
            api_key: config.api_key.clone(),
            hmac_secret: config.hmac_secret.clone(),
            enrollment_key: config.enrollment_key.clone(),
        })
    }

    /// Register this machine with the server.
    /// Returns `Some(RegisterResponse)` on new registration, `None` if already registered.
    pub async fn register(&self) -> anyhow::Result<RegisterResponse> {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let req = RegisterRequest {
            hostname,
            os: std::env::consts::OS.to_string(),
            os_version: os_version(),
            agent_version: env!("CARGO_PKG_VERSION").to_string(),
        };

        let mut request = self.client
            .post(format!("{}/api/agents/register", self.server_url))
            .json(&req);

        // Include the enrollment key header if configured, so the server can
        // authorize this new agent registration.
        if let Some(ref key) = self.enrollment_key {
            request = request.header("X-Enrollment-Key", key);
        }

        let resp = request.send().await?;

        let resp = resp
            .error_for_status()?
            .json::<RegisterResponse>()
            .await?;

        info!(machine_id = %resp.machine_id, "Successfully registered with server");

        Ok(resp)
    }

    /// Update the API key and HMAC secret used for authenticated requests.
    /// Called after registration to apply the received credentials.
    pub fn set_credentials(&mut self, api_key: String, hmac_secret: String) {
        self.api_key = Some(api_key);
        self.hmac_secret = Some(hmac_secret);
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
    // Update checks are currently handled via HeartbeatResponse.update_available;
    // this method is retained for direct/CLI-triggered update checks.
    #[allow(dead_code)]
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

    /// Fetch monitored domains from the server
    pub async fn sync_domains(&self) -> anyhow::Result<DomainSyncResponse> {
        let url = format!("{}/api/domains/sync", self.server_url);

        let resp = self.authenticated_get(&url)
            .await?
            .json::<DomainSyncResponse>()
            .await?;

        info!(
            count = resp.domains.len(),
            "Domain sync completed"
        );
        Ok(resp)
    }

    /// Send a watchdog alert to the server
    // Used by the icon-watchdog binary, not the main agent
    #[allow(dead_code)]
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
        let timestamp = chrono::Utc::now().timestamp().to_string();
        let signature = self.sign_payload(&timestamp, &body_json);

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

        resp.error_for_status().map_err(Into::into)
    }

    fn sign_payload(&self, timestamp: &str, payload: &str) -> Option<String> {
        let secret = self.hmac_secret.as_ref()?;
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
        // Include the timestamp in the signed data to bind the signature to
        // a specific timestamp window and prevent replay attacks.
        let signed_data = format!("{}.{}", timestamp, payload);
        mac.update(signed_data.as_bytes());
        Some(hex::encode(mac.finalize().into_bytes()))
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
