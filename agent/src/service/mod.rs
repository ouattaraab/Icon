/// Platform-specific service management
/// Windows: Windows Service via SCM
/// macOS: LaunchDaemon via launchd

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;
