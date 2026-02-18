/// Windows Service implementation
/// Registers icon-agent as a Windows Service via the Service Control Manager (SCM)
///
/// Installation: sc create IconAgent binPath= "C:\Program Files\Icon\icon-agent.exe" start= auto
/// Or via the installer MSI which handles this automatically.
///
/// SCM Integration: When started by SCM, the binary must call StartServiceCtrlDispatcher
/// via `run_as_service()`. The `--service` CLI flag triggers this code path.

use tracing::info;

const SERVICE_NAME: &str = "IconAgent";
const DISPLAY_NAME: &str = "Icon AI Monitoring Agent";
const DESCRIPTION: &str = "GS2E Icon - Surveillance des interactions avec les plateformes IA";

// --- SCM Integration ---

#[cfg(target_os = "windows")]
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

/// Define the Windows service entry point expected by SCM (StartServiceCtrlDispatcher)
#[cfg(target_os = "windows")]
define_windows_service!(ffi_service_main, service_main);

/// Start the service dispatcher. This is the entry point when running as a Windows Service.
/// Must be called from the main thread before any other work.
#[cfg(target_os = "windows")]
pub fn run_as_service() -> Result<(), windows_service::Error> {
    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
}

/// Called by SCM after StartServiceCtrlDispatcher connects.
#[cfg(target_os = "windows")]
fn service_main(arguments: Vec<std::ffi::OsString>) {
    if let Err(e) = run_service(arguments) {
        eprintln!("Service error: {}", e);
    }
}

/// The main service loop: registers a control handler, reports Running,
/// spawns the agent logic, and waits for a shutdown signal from SCM.
#[cfg(target_os = "windows")]
fn run_service(_arguments: Vec<std::ffi::OsString>) -> Result<(), Box<dyn std::error::Error>> {
    let (shutdown_tx, shutdown_rx) = std::sync::mpsc::channel();

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop | ServiceControl::Shutdown => {
                let _ = shutdown_tx.send(());
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;

    // Report Running to SCM
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: std::time::Duration::default(),
        process_id: None,
    })?;

    // Run the actual agent logic in a separate thread with its own tokio runtime.
    // Service mode always uses the default config path (no --config-path).
    let _agent_handle = std::thread::spawn(|| {
        let rt = tokio::runtime::Runtime::new()
            .expect("failed to create tokio runtime for agent");
        if let Err(e) = rt.block_on(crate::run_agent(&None)) {
            eprintln!("Agent error: {}", e);
        }
    });

    // Wait for shutdown signal from SCM (Stop or Shutdown)
    let _ = shutdown_rx.recv();

    // Report Stopped to SCM
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: std::time::Duration::default(),
        process_id: None,
    })?;

    Ok(())
}

// --- Service install/uninstall via sc.exe ---

/// Install the Windows Service via sc.exe
pub fn install_service(binary_path: &str) -> anyhow::Result<()> {
    let output = std::process::Command::new("sc")
        .args([
            "create",
            SERVICE_NAME,
            &format!("binPath={} --service", binary_path),
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
