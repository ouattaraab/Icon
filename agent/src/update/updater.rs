use std::path::PathBuf;
use std::process::Command;
use sha2::{Sha256, Digest};
use tracing::{info, warn, error};

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

    // Verify code signature before replacing the binary.
    // This ensures the downloaded binary was signed by a trusted authority.
    let temp_path_str = temp_path
        .to_str()
        .ok_or_else(|| anyhow::anyhow!("Temp binary path is not valid UTF-8"))?;

    match verify_code_signature(temp_path_str) {
        Ok(true) => {
            info!("Code signature verified for downloaded binary");
        }
        Ok(false) => {
            // Clean up the unverified binary
            let _ = std::fs::remove_file(&temp_path);
            warn!("Code signature verification failed for downloaded binary, aborting update");
            anyhow::bail!(
                "Update aborted: code signature verification failed for {}",
                temp_path_str
            );
        }
        Err(e) => {
            // Clean up the unverified binary
            let _ = std::fs::remove_file(&temp_path);
            warn!(error = %e, "Code signature verification error, aborting update");
            anyhow::bail!(
                "Update aborted: code signature verification error: {}",
                e
            );
        }
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

// ---------------------------------------------------------------------------
// Code signature verification
// ---------------------------------------------------------------------------

/// Verify the code signature of a binary using platform-specific tools.
/// Returns `Ok(true)` if the signature is valid, `Ok(false)` if invalid,
/// or an error if the verification tool could not be executed.
fn verify_code_signature(binary_path: &str) -> anyhow::Result<bool> {
    #[cfg(target_os = "macos")]
    {
        verify_code_signature_macos(binary_path)
    }

    #[cfg(target_os = "windows")]
    {
        return verify_code_signature_windows(binary_path);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // On Linux / other platforms, code signing verification is not yet
        // implemented. Log a warning and allow the update to proceed so we
        // don't break existing behaviour.
        let _ = binary_path;
        warn!("Code signature verification is not supported on this platform, skipping");
        Ok(true)
    }
}

/// Verify code signature on macOS using the `codesign` tool.
#[cfg(target_os = "macos")]
fn verify_code_signature_macos(binary_path: &str) -> anyhow::Result<bool> {
    let output = Command::new("codesign")
        .args(["--verify", "--deep", "--strict", binary_path])
        .output()?;
    Ok(output.status.success())
}

/// Verify code signature on Windows using PowerShell `Get-AuthenticodeSignature`.
#[cfg(target_os = "windows")]
fn verify_code_signature_windows(binary_path: &str) -> anyhow::Result<bool> {
    let output = Command::new("powershell")
        .args([
            "-Command",
            &format!(
                "(Get-AuthenticodeSignature '{}').Status -eq 'Valid'",
                binary_path
            ),
        ])
        .output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.trim() == "True")
}
