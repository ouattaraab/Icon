#[cfg(target_os = "windows")]
use windows::Win32::System::DataExchange::{
    OpenClipboard, CloseClipboard, GetClipboardData,
};
#[cfg(target_os = "windows")]
use windows::Win32::System::Memory::GlobalLock;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::HWND;

/// Get clipboard text on Windows using Win32 API
#[cfg(target_os = "windows")]
pub fn get_clipboard_text() -> Option<String> {
    unsafe {
        if !OpenClipboard(HWND::default()).is_ok() {
            return None;
        }

        let result = (|| {
            // CF_UNICODETEXT = 13
            let handle = GetClipboardData(13).ok()?;
            let ptr = GlobalLock(handle.0 as _);
            if ptr.is_null() {
                return None;
            }

            let wide_ptr = ptr as *const u16;
            let mut len = 0;
            while *wide_ptr.add(len) != 0 {
                len += 1;
            }

            let slice = std::slice::from_raw_parts(wide_ptr, len);
            let text = String::from_utf16_lossy(slice);

            windows::Win32::System::Memory::GlobalUnlock(handle.0 as _);

            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        })();

        let _ = CloseClipboard();
        result
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_clipboard_text() -> Option<String> {
    None
}
