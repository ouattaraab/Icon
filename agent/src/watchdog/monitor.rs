use tracing::info;

const AGENT_PROCESS_NAME: &str = "icon-agent";
const CHECK_INTERVAL_SECS: u64 = 10;

/// Check if the main agent process is running
pub fn is_agent_running() -> bool {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("pgrep")
            .args(["-x", AGENT_PROCESS_NAME])
            .output();

        match output {
            Ok(o) => o.status.success(),
            Err(_) => false,
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {}.exe", AGENT_PROCESS_NAME)])
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.contains(AGENT_PROCESS_NAME)
            }
            Err(_) => false,
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

/// Check if the system proxy is still correctly configured
pub fn is_proxy_configured() -> bool {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("networksetup")
            .args(["-getautoproxyurl", "Wi-Fi"])
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout.contains("icon") || stdout.contains("8443")
            }
            Err(_) => false,
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Check Windows proxy registry key
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
                stdout.contains("icon")
            }
            Err(_) => false,
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

/// Restart the agent process
pub fn restart_agent() {
    info!("Attempting to restart agent...");

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("launchctl")
            .args(["kickstart", "-k", "system/ci.gs2e.icon-agent"])
            .output();
    }

    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("sc")
            .args(["start", "IconAgent"])
            .output();
    }
}
