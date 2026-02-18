// Functions in this module are `pub` so they can be used by both the agent
// binary and the watchdog binary.  Not all of them are called from every
// binary, so we silence the dead-code lint here.
#![allow(dead_code)]

use tracing::{info, warn, debug};

/// Configure the operating system to use the PAC file served by the Icon agent.
/// This is the cross-platform entry point.
pub fn configure_system_proxy(pac_url: &str) -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    return configure_system_proxy_macos(pac_url);

    #[cfg(target_os = "windows")]
    return configure_system_proxy_windows(pac_url);

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = pac_url;
        info!("System proxy configuration is not supported on this platform");
        Ok(())
    }
}

/// Remove the system proxy configuration (restore direct connections).
/// This is the cross-platform entry point.
pub fn remove_system_proxy() -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    return remove_system_proxy_macos();

    #[cfg(target_os = "windows")]
    return remove_system_proxy_windows();

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        info!("System proxy removal is not supported on this platform");
        Ok(())
    }
}

/// Check whether the system proxy is already configured to use the given PAC URL.
pub fn is_proxy_configured(pac_url: &str) -> bool {
    #[cfg(target_os = "macos")]
    return is_proxy_configured_macos(pac_url);

    #[cfg(target_os = "windows")]
    return is_proxy_configured_windows(pac_url);

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = pac_url;
        false
    }
}

// ---------------------------------------------------------------------------
// macOS implementation
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
pub fn configure_system_proxy_macos(pac_url: &str) -> anyhow::Result<()> {
    let services = get_macos_network_services();

    if services.is_empty() {
        warn!("No network services found; cannot configure system proxy");
        return Ok(());
    }

    for service in &services {
        debug!(service = %service, pac_url = %pac_url, "Setting auto proxy URL");

        let set_url = std::process::Command::new("networksetup")
            .args(["-setautoproxyurl", service, pac_url])
            .output();

        match set_url {
            Ok(o) if o.status.success() => {
                debug!(service = %service, "Auto proxy URL set successfully");
            }
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr);
                warn!(service = %service, stderr = %stderr, "Failed to set auto proxy URL");
            }
            Err(e) => {
                warn!(service = %service, error = %e, "Failed to run networksetup");
            }
        }

        // Enable the auto proxy for this service
        let enable = std::process::Command::new("networksetup")
            .args(["-setautoproxystate", service, "on"])
            .output();

        if let Err(e) = enable {
            warn!(service = %service, error = %e, "Failed to enable auto proxy state");
        }
    }

    info!("System proxy configured with PAC URL: {}", pac_url);
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn remove_system_proxy_macos() -> anyhow::Result<()> {
    let services = get_macos_network_services();

    for service in &services {
        let result = std::process::Command::new("networksetup")
            .args(["-setautoproxystate", service, "off"])
            .output();

        match result {
            Ok(o) if o.status.success() => {
                debug!(service = %service, "Auto proxy disabled");
            }
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr);
                warn!(service = %service, stderr = %stderr, "Failed to disable auto proxy");
            }
            Err(e) => {
                warn!(service = %service, error = %e, "Failed to run networksetup");
            }
        }
    }

    info!("System proxy configuration removed");
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn is_proxy_configured_macos(pac_url: &str) -> bool {
    let services = get_macos_network_services();

    // Consider it configured if at least one service has the correct PAC URL
    for service in &services {
        let output = std::process::Command::new("networksetup")
            .args(["-getautoproxyurl", service])
            .output();

        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            // networksetup outputs lines like:
            //   URL: http://127.0.0.1:8443/proxy.pac
            //   Enabled: Yes
            if stdout.contains(pac_url) && stdout.to_lowercase().contains("enabled: yes") {
                return true;
            }
        }
    }

    false
}

/// List all active macOS network services (Wi-Fi, Ethernet, etc.)
#[cfg(target_os = "macos")]
fn get_macos_network_services() -> Vec<String> {
    let output = std::process::Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output();

    match output {
        Ok(o) => {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .skip(1) // First line is a header ("An asterisk (*) ...")
                .filter(|l| !l.starts_with('*')) // Skip disabled services
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        }
        Err(_) => vec!["Wi-Fi".to_string()],
    }
}

// ---------------------------------------------------------------------------
// Windows implementation
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub fn configure_system_proxy_windows(pac_url: &str) -> anyhow::Result<()> {
    // Set the AutoConfigURL registry key
    let result = std::process::Command::new("reg")
        .args([
            "add",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "AutoConfigURL",
            "/t", "REG_SZ",
            "/d", pac_url,
            "/f",
        ])
        .output()?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        anyhow::bail!("Failed to set AutoConfigURL registry key: {}", stderr);
    }

    // Notify WinInet of the proxy change so browsers pick it up immediately.
    // INTERNET_OPTION_SETTINGS_CHANGED = 39
    // INTERNET_OPTION_REFRESH = 37
    // We use rundll32 to trigger the refresh without linking to wininet directly.
    let _ = std::process::Command::new("rundll32.exe")
        .args(["wininet.dll,InternetSetOptionW", "0", "39", "0", "0"])
        .output();
    let _ = std::process::Command::new("rundll32.exe")
        .args(["wininet.dll,InternetSetOptionW", "0", "37", "0", "0"])
        .output();

    info!("System proxy configured with PAC URL: {}", pac_url);
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn remove_system_proxy_windows() -> anyhow::Result<()> {
    let result = std::process::Command::new("reg")
        .args([
            "delete",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "AutoConfigURL",
            "/f",
        ])
        .output()?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        warn!(stderr = %stderr, "Failed to remove AutoConfigURL registry key (may not exist)");
    }

    // Notify WinInet of the change
    let _ = std::process::Command::new("rundll32.exe")
        .args(["wininet.dll,InternetSetOptionW", "0", "39", "0", "0"])
        .output();
    let _ = std::process::Command::new("rundll32.exe")
        .args(["wininet.dll,InternetSetOptionW", "0", "37", "0", "0"])
        .output();

    info!("System proxy configuration removed");
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn is_proxy_configured_windows(pac_url: &str) -> bool {
    let output = std::process::Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
            "/v", "AutoConfigURL",
        ])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.contains(pac_url)
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_proxy_configured_returns_bool() {
        // Basic smoke test: the function should not panic
        let _ = is_proxy_configured("http://127.0.0.1:8443/proxy.pac");
    }
}
