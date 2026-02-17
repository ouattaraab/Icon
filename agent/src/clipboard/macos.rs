use std::process::Command;

/// Get clipboard text on macOS using pbpaste
/// Uses pbpaste for simplicity and reliability
pub fn get_clipboard_text() -> Option<String> {
    let output = Command::new("pbpaste")
        .output()
        .ok()?;

    if output.status.success() {
        let text = String::from_utf8(output.stdout).ok()?;
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    } else {
        None
    }
}
