use std::path::Path;
use tracing::info;

const PLIST_PATH: &str = "/Library/LaunchDaemons/ci.gs2e.icon-agent.plist";
const AGENT_BINARY: &str = "/usr/local/bin/icon-agent";

/// Generate and install the LaunchDaemon plist for macOS
pub fn install_service() -> anyhow::Result<()> {
    let plist_content = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ci.gs2e.icon-agent</string>

    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/var/log/icon/agent.log</string>

    <key>StandardErrorPath</key>
    <string>/var/log/icon/agent.error.log</string>

    <key>WorkingDirectory</key>
    <string>/var/lib/icon</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>ICON_DATA_DIR</key>
        <string>/var/lib/icon</string>
    </dict>
</dict>
</plist>"#,
        AGENT_BINARY
    );

    // Create log directory
    std::fs::create_dir_all("/var/log/icon")?;
    std::fs::create_dir_all("/var/lib/icon")?;

    // Write plist
    std::fs::write(PLIST_PATH, plist_content)?;

    // Load the daemon
    std::process::Command::new("launchctl")
        .args(["load", "-w", PLIST_PATH])
        .output()?;

    info!("LaunchDaemon installed and loaded");
    Ok(())
}

/// Uninstall the LaunchDaemon
pub fn uninstall_service() -> anyhow::Result<()> {
    std::process::Command::new("launchctl")
        .args(["unload", PLIST_PATH])
        .output()?;

    if Path::new(PLIST_PATH).exists() {
        std::fs::remove_file(PLIST_PATH)?;
    }

    info!("LaunchDaemon uninstalled");
    Ok(())
}
