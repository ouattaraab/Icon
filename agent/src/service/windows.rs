/// Windows Service implementation
/// Registers icon-agent as a Windows Service via the Service Control Manager (SCM)
///
/// Installation: sc create IconAgent binPath= "C:\Program Files\Icon\icon-agent.exe" start= auto
/// Or via the installer MSI which handles this automatically.

use tracing::info;

const SERVICE_NAME: &str = "IconAgent";
const DISPLAY_NAME: &str = "Icon AI Monitoring Agent";
const DESCRIPTION: &str = "GS2E Icon - Surveillance des interactions avec les plateformes IA";

/// Install the Windows Service via sc.exe
pub fn install_service(binary_path: &str) -> anyhow::Result<()> {
    let output = std::process::Command::new("sc")
        .args([
            "create",
            SERVICE_NAME,
            &format!("binPath={}", binary_path),
            "start=auto",
            &format!("DisplayName={}", DISPLAY_NAME),
        ])
        .output()?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to create service: {}", err);
    }

    // Set description
    std::process::Command::new("sc")
        .args(["description", SERVICE_NAME, DESCRIPTION])
        .output()?;

    // Set recovery options (restart on failure)
    std::process::Command::new("sc")
        .args([
            "failure",
            SERVICE_NAME,
            "reset=86400",
            "actions=restart/5000/restart/10000/restart/30000",
        ])
        .output()?;

    info!("Windows Service '{}' installed", SERVICE_NAME);
    Ok(())
}

/// Start the Windows Service
pub fn start_service() -> anyhow::Result<()> {
    std::process::Command::new("sc")
        .args(["start", SERVICE_NAME])
        .output()?;

    info!("Windows Service '{}' started", SERVICE_NAME);
    Ok(())
}

/// Stop the Windows Service
pub fn stop_service() -> anyhow::Result<()> {
    std::process::Command::new("sc")
        .args(["stop", SERVICE_NAME])
        .output()?;

    info!("Windows Service '{}' stopped", SERVICE_NAME);
    Ok(())
}

/// Uninstall the Windows Service
pub fn uninstall_service() -> anyhow::Result<()> {
    let _ = stop_service();

    std::process::Command::new("sc")
        .args(["delete", SERVICE_NAME])
        .output()?;

    info!("Windows Service '{}' uninstalled", SERVICE_NAME);
    Ok(())
}
