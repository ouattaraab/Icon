use sha2::{Sha256, Digest};
use std::path::{Path, PathBuf};
use tracing::{info, warn, error};

/// Binary integrity checker for anti-tampering detection.
/// Computes and stores SHA-256 hashes of critical files.
pub struct IntegrityChecker {
    /// Hash of the agent binary at startup
    agent_hash: String,
    /// Hash of the watchdog binary at startup
    watchdog_hash: Option<String>,
    /// Hash of the CA certificate
    ca_cert_hash: Option<String>,
}

impl IntegrityChecker {
    /// Initialize with hashes of current binaries
    pub fn new(data_dir: &Path) -> Self {
        let agent_hash = hash_file(&agent_binary_path())
            .unwrap_or_else(|| "unknown".to_string());

        let watchdog_hash = hash_file(&watchdog_binary_path());

        let ca_cert_path = data_dir.join("icon-ca.crt");
        let ca_cert_hash = hash_file(&ca_cert_path);

        info!(
            agent_hash = &agent_hash[..16.min(agent_hash.len())],
            "Integrity checker initialized"
        );

        Self {
            agent_hash,
            watchdog_hash,
            ca_cert_hash,
        }
    }

    /// Verify all critical files. Returns a list of tampered items.
    pub fn verify(&self, data_dir: &Path) -> Vec<TamperAlert> {
        let mut alerts = Vec::new();

        // Check agent binary
        if let Some(current) = hash_file(&agent_binary_path()) {
            if current != self.agent_hash {
                alerts.push(TamperAlert {
                    component: "agent_binary".to_string(),
                    message: format!(
                        "Agent binary hash changed: expected {}..., got {}...",
                        &self.agent_hash[..16],
                        &current[..16]
                    ),
                    severity: TamperSeverity::Critical,
                });
            }
        }

        // Check watchdog binary
        if let (Some(ref expected), Some(current)) =
            (&self.watchdog_hash, hash_file(&watchdog_binary_path()))
        {
            if &current != expected {
                alerts.push(TamperAlert {
                    component: "watchdog_binary".to_string(),
                    message: "Watchdog binary has been modified".to_string(),
                    severity: TamperSeverity::Critical,
                });
            }
        }

        // Check CA certificate
        let ca_cert_path = data_dir.join("icon-ca.crt");
        if let (Some(ref expected), Some(current)) =
            (&self.ca_cert_hash, hash_file(&ca_cert_path))
        {
            if &current != expected {
                alerts.push(TamperAlert {
                    component: "ca_certificate".to_string(),
                    message: "CA certificate has been modified".to_string(),
                    severity: TamperSeverity::Warning,
                });
            }
        } else if self.ca_cert_hash.is_some() && !ca_cert_path.exists() {
            alerts.push(TamperAlert {
                component: "ca_certificate".to_string(),
                message: "CA certificate has been deleted".to_string(),
                severity: TamperSeverity::Critical,
            });
        }

        // Check config file permissions
        let config_path = config_file_path();
        if let Some(alert) = check_file_permissions(&config_path) {
            alerts.push(alert);
        }

        // Check database file
        let db_path = data_dir.join("icon.db");
        if !db_path.exists() {
            alerts.push(TamperAlert {
                component: "database".to_string(),
                message: "Local database file is missing".to_string(),
                severity: TamperSeverity::Warning,
            });
        }

        alerts
    }

    /// Update the reference hash (called after legitimate auto-update)
    pub fn update_agent_hash(&mut self) {
        if let Some(hash) = hash_file(&agent_binary_path()) {
            info!(new_hash = &hash[..16], "Updated agent binary reference hash");
            self.agent_hash = hash;
        }
    }
}

#[derive(Debug, Clone)]
pub struct TamperAlert {
    pub component: String,
    pub message: String,
    pub severity: TamperSeverity,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TamperSeverity {
    Warning,
    Critical,
}

fn hash_file(path: &Path) -> Option<String> {
    let data = std::fs::read(path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Some(hex::encode(hasher.finalize()))
}

fn agent_binary_path() -> PathBuf {
    // Try current exe first, fall back to known install path
    std::env::current_exe().unwrap_or_else(|_| {
        if cfg!(target_os = "windows") {
            PathBuf::from(r"C:\Program Files\Icon\icon-agent.exe")
        } else {
            PathBuf::from("/usr/local/bin/icon-agent")
        }
    })
}

fn watchdog_binary_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Program Files\Icon\icon-watchdog.exe")
    } else {
        PathBuf::from("/usr/local/bin/icon-watchdog")
    }
}

fn config_file_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\ProgramData\Icon\config.toml")
    } else {
        PathBuf::from("/etc/icon/config.toml")
    }
}

/// Check file permissions on Unix systems
fn check_file_permissions(path: &Path) -> Option<TamperAlert> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;

        let meta = std::fs::metadata(path).ok()?;
        let mode = meta.mode() & 0o777;

        // Config should not be world-readable (contains secrets)
        if mode & 0o007 != 0 {
            return Some(TamperAlert {
                component: "config_permissions".to_string(),
                message: format!(
                    "Config file {} has insecure permissions: {:o} (world-accessible)",
                    path.display(),
                    mode
                ),
                severity: TamperSeverity::Warning,
            });
        }
    }

    None
}
