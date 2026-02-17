use std::path::PathBuf;
use sha2::{Sha256, Digest};
use tracing::{info, error};

use crate::sync::api_client::UpdateInfo;

/// Download and apply an agent update
pub async fn apply_update(update: &UpdateInfo) -> anyhow::Result<()> {
    info!(version = %update.version, "Downloading update...");

    // Download the new binary
    let client = reqwest::Client::new();
    let response = client.get(&update.download_url)
        .send()
        .await?
        .error_for_status()?;

    let bytes = response.bytes().await?;

    // Verify checksum
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual_checksum = hex::encode(hasher.finalize());

    if actual_checksum != update.checksum {
        anyhow::bail!(
            "Checksum mismatch: expected {}, got {}",
            update.checksum,
            actual_checksum
        );
    }

    info!("Checksum verified, applying update...");

    // Write to temp file
    let temp_path = temp_binary_path();
    std::fs::write(&temp_path, &bytes)?;

    // Make executable (Unix)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temp_path, std::fs::Permissions::from_mode(0o755))?;
    }

    // Replace current binary
    let current_binary = std::env::current_exe()?;
    let backup_path = current_binary.with_extension("bak");

    // Backup current binary
    std::fs::rename(&current_binary, &backup_path)?;

    // Move new binary into place
    if let Err(e) = std::fs::rename(&temp_path, &current_binary) {
        // Rollback on failure
        error!(error = %e, "Failed to replace binary, rolling back");
        std::fs::rename(&backup_path, &current_binary)?;
        anyhow::bail!("Update failed: {}", e);
    }

    // Clean up backup
    let _ = std::fs::remove_file(&backup_path);

    info!(version = %update.version, "Update applied successfully, restart required");

    // Request service restart
    restart_service();

    Ok(())
}

fn temp_binary_path() -> PathBuf {
    if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\ProgramData\Icon\icon-agent-update.exe")
    } else {
        PathBuf::from("/tmp/icon-agent-update")
    }
}

fn restart_service() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("launchctl")
            .args(["kickstart", "-k", "system/ci.gs2e.icon-agent"])
            .spawn();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "sc stop IconAgent && timeout /t 2 && sc start IconAgent"])
            .spawn();
    }
}
