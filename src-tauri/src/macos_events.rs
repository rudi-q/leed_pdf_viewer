// This module is now simplified since Tauri v2 handles Apple Events natively
// through RunEvent::Opened. The custom Apple Events implementation is no longer needed.

// Empty implementations for all platforms since we now use RunEvent::Opened
pub fn set_app_handle(_handle: tauri::AppHandle) {}

pub fn setup_apple_events() {}
