/// Icon Watchdog — separate lightweight binary
/// Monitors that the main icon-agent process is running and the proxy is configured.
/// Runs as a separate service/LaunchDaemon.
///
/// Responsibilities:
/// 1. Ensure the agent process is alive; restart if killed
/// 2. Ensure the system proxy configuration hasn't been tampered with
/// 3. Verify agent binary integrity (detect tampering)
/// 4. Alert the server when anomalies are detected
mod monitor;

use std::collections::HashMap;
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, Instant};

use sha2::{Sha256, Digest};

const CHECK_INTERVAL_SECS: u64 = 10;
const ALERT_COOLDOWN_SECS: u64 = 300; // Don't spam alerts, wait 5 min between same type
const MAX_RESTART_ATTEMPTS: u32 = 5;
const RESTART_BACKOFF_SECS: u64 = 10;

/// In-memory state for the watchdog
struct WatchdogState {
    restart_attempts: u32,
    last_restart: Option<Instant>,
    last_alert_times: HashMap<String, Instant>,
    known_binary_hash: Option<String>,
}

impl WatchdogState {
    fn new() -> Self {
        Self {
            restart_attempts: 0,
            last_restart: None,
            last_alert_times: HashMap::new(),
            known_binary_hash: None,
        }
    }

    /// Check if we can send an alert of this type (cooldown)
    fn can_alert(&self, alert_type: &str) -> bool {
        match self.last_alert_times.get(alert_type) {
            Some(last) => last.elapsed().as_secs() >= ALERT_COOLDOWN_SECS,
            None => true,
        }
    }

    fn mark_alerted(&mut self, alert_type: &str) {
        self.last_alert_times.insert(alert_type.to_string(), Instant::now());
    }
}

fn main() {
    eprintln!("[watchdog] Icon Watchdog v{} started", env!("CARGO_PKG_VERSION"));

    let mut state = WatchdogState::new();

    // Compute initial hash of the agent binary for integrity checks
    state.known_binary_hash = compute_agent_binary_hash();
    if let Some(ref hash) = state.known_binary_hash {
        eprintln!("[watchdog] Agent binary hash: {}...", &hash[..16]);
    }

    loop {
        // 1. Check agent process
        check_agent_process(&mut state);

        // 2. Check proxy configuration
        check_proxy_config(&mut state);

        // 3. Check binary integrity
        check_binary_integrity(&mut state);

        // 4. Check data directory permissions
        check_data_directory();

        thread::sleep(Duration::from_secs(CHECK_INTERVAL_SECS));
    }
}

/// Ensure the agent process is running; restart if not
fn check_agent_process(state: &mut WatchdogState) {
    if monitor::is_agent_running() {
        // Agent is fine, reset restart counter
        if state.restart_attempts > 0 {
            eprintln!("[watchdog] Agent is running again after {} restart attempts", state.restart_attempts);
            state.restart_attempts = 0;
        }
        return;
    }

    eprintln!("[watchdog] WARNING: Agent process is not running!");

    // Check if we should back off
    if state.restart_attempts >= MAX_RESTART_ATTEMPTS {
        if state.can_alert("agent_down_max_retries") {
            eprintln!(
                "[watchdog] CRITICAL: Agent failed to start after {} attempts. Manual intervention required.",
                MAX_RESTART_ATTEMPTS
            );
            alert_server("agent_crash_loop", &format!(
                "Agent failed to restart after {} attempts on this machine",
                MAX_RESTART_ATTEMPTS
            ));
            state.mark_alerted("agent_down_max_retries");
        }
        return;
    }

    // Apply exponential backoff
    let backoff = RESTART_BACKOFF_SECS * (state.restart_attempts as u64 + 1);
    if let Some(last) = state.last_restart {
        if last.elapsed().as_secs() < backoff {
            return; // Still in backoff period
        }
    }

    eprintln!("[watchdog] Attempting restart (attempt {})", state.restart_attempts + 1);
    monitor::restart_agent();
    state.restart_attempts += 1;
    state.last_restart = Some(Instant::now());

    // Alert server on first restart
    if state.restart_attempts == 1 && state.can_alert("agent_restarted") {
        alert_server("agent_restarted", "Agent process was not running and has been restarted");
        state.mark_alerted("agent_restarted");
    }
}

/// Ensure the system proxy is still configured correctly
fn check_proxy_config(state: &mut WatchdogState) {
    if monitor::is_proxy_configured() {
        return;
    }

    eprintln!("[watchdog] WARNING: System proxy configuration has been modified!");

    // Attempt to re-apply proxy configuration
    if reapply_proxy_config() {
        eprintln!("[watchdog] Proxy configuration restored");
    } else {
        eprintln!("[watchdog] FAILED to restore proxy configuration");
    }

    // Alert server
    if state.can_alert("proxy_tampered") {
        alert_server(
            "proxy_tampered",
            "System proxy configuration was modified (possible user bypass attempt)",
        );
        state.mark_alerted("proxy_tampered");
    }
}

/// Verify the agent binary hasn't been tampered with
fn check_binary_integrity(state: &mut WatchdogState) {
    let Some(ref known_hash) = state.known_binary_hash else {
        return; // Can't verify without a reference hash
    };

    let Some(current_hash) = compute_agent_binary_hash() else {
        return; // Binary not readable (might be updating)
    };

    if &current_hash == known_hash {
        return; // Integrity OK
    }

    // Hash changed — could be legitimate update or tampering
    // Check if the binary was recently modified (update window)
    let binary_path = agent_binary_path();
    if let Ok(metadata) = std::fs::metadata(&binary_path) {
        if let Ok(modified) = metadata.modified() {
            if modified.elapsed().unwrap_or_default() < Duration::from_secs(120) {
                // Modified within last 2 minutes — likely an auto-update
                eprintln!("[watchdog] Agent binary changed (likely auto-update), updating reference hash");
                state.known_binary_hash = Some(current_hash);
                return;
            }
        }
    }

    eprintln!("[watchdog] CRITICAL: Agent binary integrity check failed!");
    eprintln!("[watchdog]   Expected: {}...", &known_hash[..16]);
    eprintln!("[watchdog]   Got:      {}...", &current_hash[..16]);

    if state.can_alert("binary_tampered") {
        alert_server(
            "binary_tampered",
            &format!(
                "Agent binary integrity check failed. Expected hash {}..., got {}...",
                &known_hash[..16],
                &current_hash[..16]
            ),
        );
        state.mark_alerted("binary_tampered");
    }
}

/// Check that data directory permissions are correct
fn check_data_directory() {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;

        let data_dir = PathBuf::from("/var/lib/icon");

        if let Ok(meta) = std::fs::metadata(&data_dir) {
            let mode = meta.mode() & 0o777;
            if mode & 0o077 != 0 {
                eprintln!(
                    "[watchdog] WARNING: Data directory {} has insecure permissions: {:o}",
                    data_dir.display(),
                    mode
                );
                // Try to fix permissions
                let _ = std::process::Command::new("chmod")
                    .args(["700", &data_dir.to_string_lossy()])
                    .output();
            }
        }
    }
}

/// Re-apply the system proxy PAC file configuration
fn reapply_proxy_config() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Get all network services
        let services = get_macos_network_services();
        let mut success = false;

        for service in &services {
            let pac_url = "http://127.0.0.1:8443/proxy.pac".to_string();
            let result = std::process::Command::new("networksetup")
                .args(["-setautoproxyurl", service, &pac_url])
                .output();

            if let Ok(o) = result {
                if o.status.success() {
                    success = true;
                }
            }
        }
        success
    }

    #[cfg(target_os = "windows")]
    {
        let pac_url = "http://127.0.0.1:8443/proxy.pac";
        let result = std::process::Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
                "/v", "AutoConfigURL",
                "/t", "REG_SZ",
                "/d", pac_url,
                "/f",
            ])
            .output();

        result.map(|o| o.status.success()).unwrap_or(false)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[cfg(target_os = "macos")]
fn get_macos_network_services() -> Vec<String> {
    let output = std::process::Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output();

    match output {
        Ok(o) => {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .skip(1) // First line is a header
                .filter(|l| !l.starts_with('*')) // Skip disabled services
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        }
        Err(_) => vec!["Wi-Fi".to_string()],
    }
}

/// Compute SHA-256 hash of the agent binary
fn compute_agent_binary_hash() -> Option<String> {
    let path = agent_binary_path();
    let data = std::fs::read(&path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Some(hex::encode(hasher.finalize()))
}

/// Get the path to the agent binary
fn agent_binary_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Program Files\Icon\icon-agent.exe")
    } else {
        PathBuf::from("/usr/local/bin/icon-agent")
    }
}

/// Send an alert to the Icon server (best-effort, fire and forget)
fn alert_server(alert_type: &str, message: &str) {
    eprintln!("[watchdog] ALERT -> server: [{}] {}", alert_type, message);

    // Read server URL and API key from config
    let server_url = read_config_value("server_url")
        .unwrap_or_else(|| "https://icon.gs2e.ci".to_string());
    let api_key = read_config_value("api_key");

    let payload = format!(
        r#"{{"alert_type":"{}","message":"{}","source":"watchdog","agent_version":"{}"}}"#,
        alert_type,
        message.replace('"', r#"\""#),
        env!("CARGO_PKG_VERSION"),
    );

    let mut cmd = std::process::Command::new("curl");
    cmd.args([
        "-s", "-X", "POST",
        &format!("{}/api/agents/watchdog-alert", server_url),
        "-H", "Content-Type: application/json",
        "-d", &payload,
        "--max-time", "5",
    ]);

    if let Some(ref key) = api_key {
        cmd.args(["-H", &format!("X-Api-Key: {}", key)]);
    }

    // Fire and forget
    let _ = cmd.output();
}

/// Read a config value from the TOML config file
fn read_config_value(key: &str) -> Option<String> {
    let config_path = if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\ProgramData\Icon\config.toml")
    } else {
        PathBuf::from("/etc/icon/config.toml")
    };

    let content = std::fs::read_to_string(&config_path).ok()?;
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(key) {
            let rest = rest.trim();
            if let Some(value) = rest.strip_prefix('=') {
                let value = value.trim().trim_matches('"').trim_matches('\'');
                return Some(value.to_string());
            }
        }
    }
    None
}
