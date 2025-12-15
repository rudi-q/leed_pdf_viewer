use std::collections::VecDeque;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, RunEvent};

#[cfg(target_os = "macos")]
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem};

mod license;
// License imports only needed for Windows/Linux builds (excluded from macOS for App Store compliance)
#[cfg(not(target_os = "macos"))]
use license::{
    activate_license_key, check_license_smart, get_license_requirement_info, get_stored_license,
    remove_stored_license, store_activated_license, store_license, validate_license_key,
};

// Global state to store pending file paths
static PENDING_FILES: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());
static FILE_PROCESSED: Mutex<bool> = Mutex::new(false);

// Configuration constants
const MAX_FILE_LOADING_ATTEMPTS: u32 = 30;
const FRONTEND_READY_WAIT_MS: u64 = 3000;
const INITIAL_ATTEMPT_DELAY_MS: u64 = 2000;
const MIDDLE_ATTEMPT_DELAY_MS: u64 = 1000;
const FINAL_ATTEMPT_DELAY_MS: u64 = 500;
const INITIAL_ATTEMPT_COUNT: u32 = 5;
const MIDDLE_ATTEMPT_COUNT: u32 = 15;

// Path sanitization function
fn sanitize_path(path: &str) -> String {
    let mut clean_path = path.trim().to_string();

    // Remove surrounding quotes if present
    if clean_path.starts_with('"') && clean_path.ends_with('"') {
        clean_path = clean_path[1..clean_path.len() - 1].to_string();
    }

    // Handle Windows UNC paths and long path names
    if clean_path.starts_with("\\\\?\\") {
        clean_path = clean_path[4..].to_string();
    }

    clean_path
}

// NEW: Process deep link URLs (leedpdf://...)
fn process_deep_link(app_handle: &tauri::AppHandle, url: &str) {
    println!("[DEEP_LINK] Processing: {}", url);

    match parse_and_validate_deep_link(url) {
        Ok(parsed) => {
            let page = parsed.page.unwrap_or(1);

            if let Some(path) = parsed.file {
                // Check if it's a URL or local file path
                if path.starts_with("http://") || path.starts_with("https://") {
                    // It's a URL - emit directly to frontend for URL loading
                    println!("[DEEP_LINK] Processing URL: {}", path);
                    let payload = serde_json::json!({
                        "pdf_url": path,
                        "page": page
                    });
                    println!(
                        "[DEEP_LINK] Emitting load-pdf-from-deep-link event with payload: {:?}",
                        payload
                    );

                    // Emit both events to ensure compatibility
                    if let Err(e) = app_handle.emit("load-pdf-from-deep-link", payload.clone()) {
                        println!(
                            "[DEEP_LINK] Failed to emit load-pdf-from-deep-link event: {:?}",
                            e
                        );
                    } else {
                        println!("[DEEP_LINK] Successfully emitted load-pdf-from-deep-link event");
                    }

                    // Also emit the simple deep-link event as fallback
                    if let Err(e) = app_handle.emit("deep-link", &path) {
                        println!("[DEEP_LINK] Failed to emit deep-link event: {:?}", e);
                    } else {
                        println!("[DEEP_LINK] Successfully emitted deep-link event");
                    }
                } else {
                    // It's a local file path - use existing security checks
                    let path_obj = std::path::Path::new(&path);
                    let canonical_path = match std::fs::canonicalize(path_obj) {
                        Ok(canonical) => canonical,
                        Err(e) => {
                            println!("[DEEP_LINK] Failed to canonicalize path {}: {}", path, e);
                            return;
                        }
                    };

                    // Check against allowed base directories
                    let allowed_bases = [
                        std::env::var("HOME").unwrap_or_default(),
                        std::env::var("USERPROFILE").unwrap_or_default(),
                        std::env::var("APPDATA").unwrap_or_default(),
                        std::env::var("LOCALAPPDATA").unwrap_or_default(),
                        #[cfg(target_os = "windows")]
                        "C:\\Users".to_string(),
                        #[cfg(target_os = "linux")]
                        "/home".to_string(),
                        #[cfg(target_os = "macos")]
                        "/Users".to_string(),
                    ];

                    let mut is_allowed = false;
                    for base in &allowed_bases {
                        if !base.is_empty() {
                            let base_path = std::path::Path::new(base);
                            if canonical_path.starts_with(base_path) {
                                is_allowed = true;
                                break;
                            }
                        }
                    }

                    if !is_allowed {
                        println!(
                            "[DEEP_LINK] Rejected path outside allowed directories: {}",
                            canonical_path.display()
                        );
                        println!("[DEEP_LINK] Allowed bases were: {:?}", allowed_bases);
                        if allowed_bases.iter().all(|s| s.is_empty()) {
                            println!("[DEEP_LINK] WARNING: All environment variables are empty, blocking all files");
                        }
                        return;
                    }

                    // Verify it's a regular file
                    let metadata = match std::fs::metadata(&canonical_path) {
                        Ok(meta) => meta,
                        Err(e) => {
                            println!(
                                "[DEEP_LINK] Failed to read file metadata for {}: {}",
                                canonical_path.display(),
                                e
                            );
                            return;
                        }
                    };

                    if !metadata.is_file() {
                        println!(
                            "[DEEP_LINK] Rejected non-file path: {}",
                            canonical_path.display()
                        );
                        return;
                    }

                    // Explicit user confirmation before opening the file
                    let confirm = rfd::MessageDialog::new()
                        .set_title("Open file from link?")
                        .set_description(format!(
                            "A link is requesting to open this file:\n{}\nPage: {}",
                            canonical_path.display(),
                            page
                        ))
                        .set_level(rfd::MessageLevel::Info)
                        .set_buttons(rfd::MessageButtons::OkCancel)
                        .show();

                    if confirm != rfd::MessageDialogResult::Ok {
                        println!(
                            "[DEEP_LINK] User declined opening deep-linked file: {}",
                            canonical_path.display()
                        );
                        return;
                    }

                    println!(
                        "[DEEP_LINK] Approved PDF path: {}, page: {}",
                        canonical_path.display(),
                        page
                    );

                    let payload = serde_json::json!({
                        "pdf_path": canonical_path.to_string_lossy().to_string(),
                        "page": page
                    });
                    if let Err(e) = app_handle.emit("load-pdf-from-deep-link", payload) {
                        println!("[DEEP_LINK] Failed to emit event: {:?}", e);
                    }
                }
            } else {
                // No file parameter, emit the action for informational handlers only
                let content = url.replace("leedpdf://", "").replace("?", "");
                println!(
                    "[DEEP_LINK] No file param, emitting raw content: {}",
                    content
                );
                if let Err(e) = app_handle.emit("deep-link", &content) {
                    println!("[DEEP_LINK] Failed to emit deep-link event: {:?}", e);
                }
            }
        }
        Err(err) => {
            println!("[DEEP_LINK] Rejected deep link: {} => {}", url, err);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedDeepLink {
    action: String,
    file: Option<String>,
    page: Option<i32>,
}

// Parse and strictly validate the deep link without touching the filesystem.
// This function enforces:
// - scheme is exactly "leedpdf"
// - host/action is whitelisted (currently: "open")
// - only "file" and "page" params are accepted
// - value lengths are bounded and types/ranges validated
// - file param must be either:
//   - an HTTP(S) URL for loading remote PDFs, or
//   - an absolute local path with an allowed extension (pdf, lpdf, md)
fn parse_and_validate_deep_link(url: &str) -> Result<ParsedDeepLink, String> {
    println!("[DEEP_LINK] Parsing URL: {}", url);
    let parsed = url::Url::parse(url).map_err(|e| {
        println!("[DEEP_LINK] URL parse error: {}", e);
        format!("invalid URL: {}", e)
    })?;

    println!("[DEEP_LINK] Parsed scheme: {}", parsed.scheme());
    if parsed.scheme() != "leedpdf" {
        println!("[DEEP_LINK] Unsupported scheme: {}", parsed.scheme());
        return Err("unsupported scheme".to_string());
    }

    let action = parsed.host_str().map(|s| s.to_string()).unwrap_or_default();

    println!("[DEEP_LINK] Parsed action: {}", action);

    // Handle direct URLs (leedpdf://https://example.com/file.pdf)
    if action == "https" || action == "http" {
        // Extract the full URL from the path
        let full_url = format!("{}://{}", action, parsed.path().trim_start_matches('/'));
        println!("[DEEP_LINK] Extracted full URL: {}", full_url);
        return Ok(ParsedDeepLink {
            action: "open".to_string(),
            file: Some(full_url),
            page: None,
        });
    }

    let allowed_actions = ["open"]; // whitelist of actions we support
    if !allowed_actions.contains(&action.as_str()) {
        return Err(format!("unsupported action: {}", action));
    }

    // Collect params, enforce whitelist and bounds
    let mut file: Option<String> = None;
    let mut page: Option<i32> = None;

    for (key, value) in parsed.query_pairs() {
        let v = value.to_string();
        // Truncate overly long values early
        if v.len() > 4096 {
            return Err(format!("parameter '{}' too long", key));
        }

        match key.as_ref() {
            "file" => {
                // Check if it's a URL or local file path
                let lower = v.to_lowercase();
                if lower.starts_with("http://") || lower.starts_with("https://") {
                    // It's a URL - allow it
                    file = Some(v);
                    continue;
                } else if lower.starts_with("file://") {
                    return Err(
                        "file param must be a local absolute path, not file:// URL".to_string()
                    );
                }

                // Basic absolute path checks without fs access
                let is_abs_unix = v.starts_with('/') || v.starts_with("~/");
                let is_abs_win = v.len() > 2
                    && v.as_bytes()[1] == b':'
                    && (v.as_bytes()[2] == b'\\' || v.as_bytes()[2] == b'/');
                let is_unc = v.starts_with("\\\\");
                if !(is_abs_unix || is_abs_win || is_unc) {
                    return Err("file path must be absolute".to_string());
                }

                // Disallow traversal fragments
                if v.contains("/../") || v.contains("\\..\\") || v.starts_with("../") {
                    return Err("path traversal not allowed".to_string());
                }

                // Extension allowlist
                if let Some(ext) = std::path::Path::new(&v).extension() {
                    let ext = ext.to_string_lossy().to_lowercase();
                    if !["pdf", "lpdf", "md"].contains(&ext.as_str()) {
                        return Err("unsupported file extension".to_string());
                    }
                } else {
                    return Err("file path must include an extension".to_string());
                }

                file = Some(v);
            }
            "page" => {
                let p: i32 = v
                    .parse()
                    .map_err(|_| "page must be a valid integer".to_string())?;
                if p < 1 || p > 100000 {
                    return Err("page out of allowed range".to_string());
                }
                page = Some(p);
            }
            other => {
                return Err(format!("unexpected parameter: {}", other));
            }
        }
    }

    Ok(ParsedDeepLink { action, file, page })
}

#[cfg(test)]
mod tests {
    use super::parse_and_validate_deep_link;

    #[test]
    fn rejects_wrong_scheme() {
        assert!(parse_and_validate_deep_link("https://example.com").is_err());
    }

    #[test]
    fn rejects_unsupported_action() {
        assert!(parse_and_validate_deep_link("leedpdf://delete?file=/tmp/a.pdf").is_err());
    }

    #[test]
    fn rejects_unknown_param() {
        assert!(parse_and_validate_deep_link("leedpdf://open?foo=bar").is_err());
    }

    #[test]
    fn rejects_relative_path() {
        assert!(parse_and_validate_deep_link("leedpdf://open?file=docs/a.pdf").is_err());
    }

    #[test]
    fn accepts_http_url_in_file() {
        // HTTP(S) URLs are allowed in the file parameter to support loading remote PDFs
        let result = parse_and_validate_deep_link("leedpdf://open?file=http://example.com/doc.pdf");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.file, Some("http://example.com/doc.pdf".to_string()));
    }

    #[test]
    fn accepts_https_url_in_file() {
        let result =
            parse_and_validate_deep_link("leedpdf://open?file=https://example.com/doc.pdf");
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.file, Some("https://example.com/doc.pdf".to_string()));
    }

    #[test]
    fn rejects_traversal() {
        assert!(parse_and_validate_deep_link("leedpdf://open?file=/tmp/../secret.pdf").is_err());
    }

    #[test]
    fn rejects_bad_extension() {
        assert!(parse_and_validate_deep_link("leedpdf://open?file=/tmp/a.exe").is_err());
    }

    #[test]
    fn rejects_page_out_of_range() {
        assert!(parse_and_validate_deep_link("leedpdf://open?file=/tmp/a.pdf&page=0").is_err());
        assert!(
            parse_and_validate_deep_link("leedpdf://open?file=/tmp/a.pdf&page=100001").is_err()
        );
    }

    #[test]
    fn accepts_minimal_valid_unix() {
        #[cfg(unix)]
        assert!(parse_and_validate_deep_link("leedpdf://open?file=/tmp/a.pdf&page=2").is_ok());
    }

    #[test]
    fn accepts_minimal_valid_windows() {
        #[cfg(windows)]
        assert!(
            parse_and_validate_deep_link("leedpdf://open?file=C:/Users/test/a.pdf&page=2").is_ok()
        );
    }
}

#[tauri::command]
fn get_pending_file() -> Option<String> {
    let mut pending = PENDING_FILES.lock().unwrap();
    pending.pop_front()
}

#[tauri::command]
fn check_file_associations(app_handle: tauri::AppHandle) -> Vec<String> {
    let args: Vec<String> = std::env::args().collect();
    let mut pdf_files: Vec<String> = Vec::new();

    for arg in &args[1..] {
        // Check for deep links BEFORE sanitizing (they're not file paths!)
        if arg.starts_with("leedpdf://") {
            println!("[check_file_associations] Found deep link: {}", arg);
            process_deep_link(&app_handle, arg);
            continue;
        }

        // Only sanitize file paths, not deep links
        let clean_arg = sanitize_path(arg);
        let lower = clean_arg.to_lowercase();
        if lower.ends_with(".pdf") || lower.ends_with(".lpdf") || lower.ends_with(".md") {
            pdf_files.push(clean_arg);
        }
    }

    pdf_files
}

#[tauri::command]
fn mark_file_processed() {
    let mut processed = FILE_PROCESSED.lock().unwrap();
    *processed = true;
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// License commands - excluded from macOS builds for App Store compliance
#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn activate_license(
    app_handle: tauri::AppHandle,
    licensekey: String,
) -> Result<bool, String> {
    let is_valid = activate_license_key(&licensekey).await?;

    if is_valid {
        // Store the activated license
        store_activated_license(&app_handle, &licensekey)?;
    }

    Ok(is_valid)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn validate_license(
    app_handle: tauri::AppHandle,
    licensekey: String,
) -> Result<bool, String> {
    let is_valid = validate_license_key(&licensekey).await?;

    if is_valid {
        // Update the validation timestamp for existing license
        store_license(&app_handle, &licensekey)?;
    }

    Ok(is_valid)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn get_stored_license_key(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    match get_stored_license(&app_handle)? {
        Some(stored_license) => Ok(Some(stored_license.key)),
        None => Ok(None),
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn clear_license(app_handle: tauri::AppHandle) -> Result<(), String> {
    remove_stored_license(&app_handle)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn check_license_smart_command(app_handle: tauri::AppHandle) -> Result<bool, String> {
    check_license_smart(&app_handle).await
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn get_license_info() -> serde_json::Value {
    get_license_requirement_info()
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn test_tauri_detection() -> String {
    "Tauri detection working!".to_string()
}

/// Get all installed system fonts
/// Returns a sorted list of font family names installed on the system
/// Uses font-kit for native cross-platform font enumeration
#[tauri::command]
fn get_system_fonts() -> Result<Vec<String>, String> {
    use font_kit::source::SystemSource;
    use std::collections::HashSet;

    let source = SystemSource::new();

    // Get all font families from the system
    let families = source
        .all_families()
        .map_err(|e| format!("Failed to enumerate fonts: {:?}", e))?;

    // Use HashSet to deduplicate, then collect and sort
    let unique_fonts: HashSet<String> = families.into_iter().collect();
    let mut fonts: Vec<String> = unique_fonts.into_iter().collect();

    // Sort alphabetically for consistent ordering
    fonts.sort();

    log::debug!("Found {} system fonts using font-kit", fonts.len());
    Ok(fonts)
}

#[cfg(debug_assertions)]
#[tauri::command]
fn test_file_event(app_handle: tauri::AppHandle, file_path: String) -> Result<(), String> {
    println!("Testing file event with path: {}", file_path);

    // Test if we can emit events
    match app_handle.emit("file-opened", &file_path) {
        Ok(_) => println!("Successfully emitted file-opened event"),
        Err(e) => println!("Failed to emit file-opened event: {:?}", e),
    }

    match app_handle.emit("startup-file-ready", &file_path) {
        Ok(_) => println!("Successfully emitted startup-file-ready event"),
        Err(e) => println!("Failed to emit startup-file-ready event: {:?}", e),
    }

    Ok(())
}

#[tauri::command]
fn frontend_ready(app_handle: tauri::AppHandle) -> Result<(), String> {
    println!("Frontend is ready to receive events");

    // Check if there are any pending files and emit them now
    let pending_files: Vec<String> = {
        let mut pending = PENDING_FILES.lock().unwrap();
        pending.drain(..).collect()
    };

    if !pending_files.is_empty() {
        println!(
            "Frontend ready - processing {} pending files",
            pending_files.len()
        );
        process_pdf_files(&app_handle, pending_files);
    }

    Ok(())
}

#[cfg(debug_assertions)]
#[tauri::command]
fn check_app_state() -> Result<String, String> {
    let args: Vec<String> = std::env::args().collect();
    let pending_count = PENDING_FILES.lock().unwrap().len();
    let processed = FILE_PROCESSED.lock().unwrap();

    let state = format!(
        "App State:\n- Args: {:?}\n- Pending files: {}\n- File processed: {}\n- Current dir: {:?}\n- Bundle path: {:?}",
        args,
        pending_count,
        processed,
        std::env::current_dir().unwrap_or_default(),
        std::env::current_exe().unwrap_or_default()
    );

    println!("{}", state);
    Ok(state)
}

#[tauri::command]
fn read_file_content(file_path: String) -> Result<Vec<u8>, String> {
    println!("Reading file content from: {}", file_path);

    // Security: Validate and canonicalize the file path
    let path = std::path::Path::new(&file_path);

    // Check if path is absolute and valid
    if !path.is_absolute() {
        return Err("File path must be absolute".to_string());
    }

    // Canonicalize the path to resolve any symlinks and normalize
    let canonical_path = match std::fs::canonicalize(path) {
        Ok(canonical) => canonical,
        Err(e) => return Err(format!("Failed to canonicalize path: {}", e)),
    };

    // Security: Define allowed base directories (user's home directory and common locations)
    let allowed_bases = [
        std::env::var("HOME").unwrap_or_default(),
        std::env::var("USERPROFILE").unwrap_or_default(), // Windows
        std::env::var("APPDATA").unwrap_or_default(),     // Windows
        std::env::var("LOCALAPPDATA").unwrap_or_default(), // Windows
    ];

    // Check if the canonicalized path is under any allowed base directory
    let mut is_allowed = false;
    for base in &allowed_bases {
        if !base.is_empty() {
            let base_path = std::path::Path::new(base);
            if canonical_path.starts_with(base_path) {
                is_allowed = true;
                break;
            }
        }
    }

    if !is_allowed {
        return Err("File path is outside of allowed directories".to_string());
    }

    // Security: Check if it's a regular file (not a directory, symlink, etc.)
    let metadata = match std::fs::metadata(&canonical_path) {
        Ok(meta) => meta,
        Err(e) => return Err(format!("Failed to read file metadata: {}", e)),
    };

    if !metadata.is_file() {
        return Err("Path does not point to a regular file".to_string());
    }

    // Security: Enforce file size limits (50MB max)
    const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50MB
    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large: {} bytes (max: {} bytes)",
            metadata.len(),
            MAX_FILE_SIZE
        ));
    }

    // Read the file content with the validated canonical path
    match std::fs::read(&canonical_path) {
        Ok(content) => {
            println!(
                "Successfully read {} bytes from {}",
                content.len(),
                canonical_path.display()
            );
            Ok(content)
        }
        Err(e) => {
            println!("Failed to read file {}: {}", canonical_path.display(), e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

#[tauri::command]
fn export_file(
    _app_handle: tauri::AppHandle,
    content: Vec<u8>,
    default_filename: String,
    filter_name: String,
    extension: String,
) -> Result<Option<String>, String> {
    use rfd::FileDialog;

    let path = FileDialog::new()
        .add_filter(&filter_name, &[&extension])
        .set_file_name(&default_filename)
        .save_file();

    if let Some(p) = path {
        std::fs::write(&p, content).map_err(|e| e.to_string())?;
        Ok(Some(p.to_string_lossy().to_string()))
    } else {
        Ok(None) // User cancelled
    }
}

#[cfg(debug_assertions)]
#[tauri::command]
fn get_default_test_path() -> Result<String, String> {
    // Return a platform-appropriate default test path
    let default_path = if cfg!(target_os = "windows") {
        // Windows: Use temp directory
        std::env::temp_dir()
            .join("test.pdf")
            .to_string_lossy()
            .to_string()
    } else if cfg!(target_os = "macos") {
        // macOS: Use /tmp or user's temp directory
        std::env::temp_dir()
            .join("test.pdf")
            .to_string_lossy()
            .to_string()
    } else {
        // Linux and other Unix-like systems
        "/tmp/test.pdf".to_string()
    };

    Ok(default_path)
}

// Function to create the application menu (macOS)
#[cfg(target_os = "macos")]
fn create_app_menu(
    app_handle: &tauri::AppHandle,
) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    // Create File menu items
    let open_file_item = MenuItemBuilder::with_id("open_file", "Open...")
        .accelerator("U")
        .build(app_handle)?;

    let browse_templates_item = MenuItemBuilder::with_id("browse_templates", "Browse Templates...")
        .accelerator("CmdOrCtrl+Shift+T")
        .build(app_handle)?;

    let start_fresh_item = MenuItemBuilder::with_id("start_fresh", "Start Fresh")
        .accelerator("CmdOrCtrl+N")
        .build(app_handle)?;

    let search_pdf_item = MenuItemBuilder::with_id("search_pdf", "Search PDF...")
        .accelerator("CmdOrCtrl+F")
        .build(app_handle)?;

    // Create Edit menu items
    let undo_item = MenuItemBuilder::with_id("undo", "Undo")
        .accelerator("CmdOrCtrl+Z")
        .build(app_handle)?;

    let redo_item = MenuItemBuilder::with_id("redo", "Redo")
        .accelerator("CmdOrCtrl+Shift+Z")
        .build(app_handle)?;

    // Create View menu items
    let previous_page_item = MenuItemBuilder::with_id("previous_page", "Previous Page")
        .accelerator("Left")
        .build(app_handle)?;

    let next_page_item = MenuItemBuilder::with_id("next_page", "Next Page")
        .accelerator("Right")
        .build(app_handle)?;

    let zoom_in_item = MenuItemBuilder::with_id("zoom_in", "Zoom In")
        .accelerator("CmdOrCtrl+=")
        .build(app_handle)?;

    let zoom_out_item = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app_handle)?;

    let reset_zoom_item = MenuItemBuilder::with_id("reset_zoom", "Reset Zoom")
        .accelerator("CmdOrCtrl+0")
        .build(app_handle)?;

    let fit_width_item = MenuItemBuilder::with_id("fit_width", "Fit Width")
        .accelerator("W")
        .build(app_handle)?;

    let fit_height_item = MenuItemBuilder::with_id("fit_height", "Fit Height")
        .accelerator("H")
        .build(app_handle)?;

    let focus_mode_item = MenuItemBuilder::with_id("focus_mode", "Focus Mode")
        .accelerator("F")
        .build(app_handle)?;

    // Create View submenu
    let view_menu = tauri::menu::SubmenuBuilder::new(app_handle, "View")
        .item(&previous_page_item)
        .item(&next_page_item)
        .separator()
        .item(&zoom_in_item)
        .item(&zoom_out_item)
        .item(&reset_zoom_item)
        .separator()
        .item(&fit_width_item)
        .item(&fit_height_item)
        .separator()
        .item(&focus_mode_item)
        .build()?;

    // Create Export submenu items
    let export_as_pdf_item = MenuItemBuilder::with_id("export_as_pdf", "PDF")
        .accelerator("CmdOrCtrl+Shift+P")
        .build(app_handle)?;

    let export_as_lpdf_item = MenuItemBuilder::with_id("export_as_lpdf", "LPDF")
        .accelerator("CmdOrCtrl+Shift+L")
        .build(app_handle)?;

    let export_as_docx_item = MenuItemBuilder::with_id("export_as_docx", "DOCX")
        .accelerator("CmdOrCtrl+Shift+D")
        .build(app_handle)?;

    // Create Export submenu
    let export_menu = tauri::menu::SubmenuBuilder::new(app_handle, "Export as")
        .item(&export_as_pdf_item)
        .item(&export_as_lpdf_item)
        .item(&export_as_docx_item)
        .build()?;

    let share_pdf_item = MenuItemBuilder::with_id("share_pdf", "Share PDF...")
        .accelerator("CmdOrCtrl+E")
        .build(app_handle)?;

    // Create File submenu
    let file_menu = tauri::menu::SubmenuBuilder::new(app_handle, "File")
        .item(&open_file_item)
        .item(&browse_templates_item)
        .item(&start_fresh_item)
        .item(&search_pdf_item)
        .separator()
        .item(&export_menu)
        .separator()
        .item(&share_pdf_item)
        .build()?;

    // Create Tools menu items
    let pencil_tool_item = MenuItemBuilder::with_id("tool_pencil", "Pencil")
        .accelerator("1")
        .build(app_handle)?;

    let eraser_tool_item = MenuItemBuilder::with_id("tool_eraser", "Eraser")
        .accelerator("2")
        .build(app_handle)?;

    let text_tool_item = MenuItemBuilder::with_id("tool_text", "Text")
        .accelerator("3")
        .build(app_handle)?;

    let arrow_tool_item = MenuItemBuilder::with_id("tool_arrow", "Arrow")
        .accelerator("4")
        .build(app_handle)?;

    let highlighter_tool_item = MenuItemBuilder::with_id("tool_highlighter", "Highlighter")
        .accelerator("5")
        .build(app_handle)?;

    let sticky_note_tool_item = MenuItemBuilder::with_id("tool_sticky", "Sticky Note")
        .accelerator("6")
        .build(app_handle)?;

    let stamps_tool_item = MenuItemBuilder::with_id("tool_stamps", "Stamps")
        .accelerator("S")
        .build(app_handle)?;

    // Create Tools submenu
    let tools_menu = tauri::menu::SubmenuBuilder::new(app_handle, "Tools")
        .item(&pencil_tool_item)
        .item(&eraser_tool_item)
        .item(&text_tool_item)
        .item(&arrow_tool_item)
        .item(&highlighter_tool_item)
        .item(&sticky_note_tool_item)
        .item(&stamps_tool_item)
        .build()?;

    // Create Help menu items
    let help_item = MenuItemBuilder::with_id("help", "LeedPDF Help")
        .accelerator("CmdOrCtrl+?")
        .build(app_handle)?;

    let shortcuts_item = MenuItemBuilder::with_id("shortcuts", "Keyboard Shortcuts")
        .accelerator("?")
        .build(app_handle)?;

    let report_bug_item =
        MenuItemBuilder::with_id("report_bug", "Report Bug...").build(app_handle)?;

    let feedback_item =
        MenuItemBuilder::with_id("feedback", "Submit Feedback...").build(app_handle)?;

    // Create Help submenu
    let help_menu = tauri::menu::SubmenuBuilder::new(app_handle, "Help")
        .item(&help_item)
        .separator()
        .item(&shortcuts_item)
        .separator()
        .item(&report_bug_item)
        .item(&feedback_item)
        .build()?;

    // Create the full menu with macOS standard app menu
    let menu = MenuBuilder::new(app_handle)
        .item(
            &tauri::menu::SubmenuBuilder::new(app_handle, "LeedPDF")
                .about(Some(AboutMetadata {
                    name: Some("LeedPDF".to_string()),
                    version: Some(env!("CARGO_PKG_VERSION").to_string()),
                    short_version: None,
                    authors: None,
                    comments: Some("Draw and Annotate on PDFs".to_string()),
                    copyright: None,
                    license: None,
                    website: None,
                    website_label: None,
                    credits: None,
                    icon: None,
                }))
                .separator()
                .item(&PredefinedMenuItem::hide(app_handle, None)?)
                .item(&PredefinedMenuItem::hide_others(app_handle, None)?)
                .item(&PredefinedMenuItem::show_all(app_handle, None)?)
                .separator()
                .item(&PredefinedMenuItem::quit(app_handle, None)?)
                .build()?,
        )
        .item(&file_menu)
        .item(
            &tauri::menu::SubmenuBuilder::new(app_handle, "Edit")
                .item(&undo_item)
                .item(&redo_item)
                .build()?,
        )
        .item(&view_menu)
        .item(&tools_menu)
        .item(
            &tauri::menu::SubmenuBuilder::new(app_handle, "Window")
                .item(&PredefinedMenuItem::minimize(app_handle, None)?)
                .item(&PredefinedMenuItem::maximize(app_handle, None)?)
                .separator()
                .item(&PredefinedMenuItem::close_window(app_handle, None)?)
                .build()?,
        )
        .item(&help_menu)
        .build()?;

    Ok(menu)
}

// Function to process PDF files and emit events
fn process_pdf_files(app_handle: &tauri::AppHandle, pdf_files: Vec<String>) {
    if !pdf_files.is_empty() {
        // Store in global queue
        {
            let mut pending = PENDING_FILES.lock().unwrap();
            for pdf_file in &pdf_files {
                pending.push_back(pdf_file.clone());
            }
        }

        // Spawn background thread for persistent file loading attempts
        let app_handle_clone = app_handle.clone();
        thread::spawn(move || {
            // Wait longer for frontend to be ready (especially for file associations)
            println!("Waiting for frontend to be ready...");
            thread::sleep(Duration::from_millis(FRONTEND_READY_WAIT_MS)); // Wait 3 seconds for frontend

            for attempt in 1..=MAX_FILE_LOADING_ATTEMPTS {
                // Increased attempts for file associations
                // Check if file has been processed
                {
                    let processed = FILE_PROCESSED.lock().unwrap();
                    if *processed {
                        println!("File already processed, stopping attempts");
                        break;
                    }
                }

                // Wait longer for first few attempts (frontend initialization)
                let delay = if attempt <= INITIAL_ATTEMPT_COUNT {
                    Duration::from_millis(INITIAL_ATTEMPT_DELAY_MS) // 2 seconds for first 5 attempts
                } else if attempt <= MIDDLE_ATTEMPT_COUNT {
                    Duration::from_millis(MIDDLE_ATTEMPT_DELAY_MS) // 1 second for next 10 attempts
                } else {
                    Duration::from_millis(FINAL_ATTEMPT_DELAY_MS) // 0.5 seconds for remaining attempts
                };

                thread::sleep(delay);

                // Try to emit event for each PDF file
                for (i, pdf_file) in pdf_files.iter().enumerate() {
                    let event_name = if i == 0 {
                        "file-opened"
                    } else {
                        "additional-file-opened"
                    };

                    match app_handle_clone.emit(event_name, pdf_file) {
                        Ok(_) => {
                            println!(
                                "Attempt {}: Successfully emitted {} for {}",
                                attempt, event_name, pdf_file
                            );

                            // Also emit a generic startup event
                            let _ = app_handle_clone.emit("startup-file-ready", pdf_file);
                        }
                        Err(e) => {
                            println!("Attempt {}: Failed to emit event: {:?}", attempt, e);
                        }
                    }
                }

                // Emit debug info
                let _ = app_handle_clone.emit(
                    "debug-info",
                    format!(
                        "File loading attempt {} of {}",
                        attempt, MAX_FILE_LOADING_ATTEMPTS
                    ),
                );
            }

            println!("File loading attempts completed");
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    // NEW: Single-instance plugin for Windows/Linux (macOS is single-instance by default)
    #[cfg(desktop)]
    {
        #[cfg(not(target_os = "macos"))]
        {
            builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
                println!(
                    "[SINGLE_INSTANCE] New instance attempted with args: {:?}",
                    argv
                );

                // Bring window to front
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.show();
                    let _ = window.unminimize();
                }

                // Process any deep links in the arguments
                for arg in &argv {
                    if arg.starts_with("leedpdf://") {
                        println!("[SINGLE_INSTANCE] Found deep link: {}", arg);
                        process_deep_link(&app, arg);
                    }
                }
            }));
        }
    }
    // Enable updater for non-macOS builds (App Store compliance)
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    let builder_result = builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_pending_file,
            check_file_associations,
            mark_file_processed,
            open_external_url,
            // License commands excluded from macOS builds for App Store compliance
            #[cfg(not(target_os = "macos"))]
            activate_license,
            #[cfg(not(target_os = "macos"))]
            validate_license,
            #[cfg(not(target_os = "macos"))]
            get_stored_license_key,
            #[cfg(not(target_os = "macos"))]
            clear_license,
            #[cfg(not(target_os = "macos"))]
            check_license_smart_command,
            #[cfg(not(target_os = "macos"))]
            get_license_info,
            exit_app,
            test_tauri_detection,
            get_system_fonts,
            frontend_ready,
            read_file_content,
            export_file,
            #[cfg(debug_assertions)]
            test_file_event,
            #[cfg(debug_assertions)]
            check_app_state,
            #[cfg(debug_assertions)]
            get_default_test_path
        ])
        .setup(|app| {
            // NEW: Add import at the top of setup
            use tauri_plugin_deep_link::DeepLinkExt;

            // Setup macOS menu
            #[cfg(target_os = "macos")]
            {
                let menu = create_app_menu(&app.handle())?;
                app.set_menu(menu)?;

                // Handle menu events
                app.on_menu_event(move |app, event| {
                    let event_id = event.id().as_ref();
                    println!("[MENU] Menu event: {}", event_id);

                    if let Some(window) = app.get_webview_window("main") {
                        match event_id {
                            // Edit menu
                            "undo" => {
                                println!("[MENU] Undo clicked");
                                let _ = window.emit("menu-undo", ());
                            }
                            "redo" => {
                                println!("[MENU] Redo clicked");
                                let _ = window.emit("menu-redo", ());
                            }

                            // View menu
                            "previous_page" => {
                                println!("[MENU] Previous Page clicked");
                                let _ = window.emit("menu-previous-page", ());
                            }
                            "next_page" => {
                                println!("[MENU] Next Page clicked");
                                let _ = window.emit("menu-next-page", ());
                            }
                            "zoom_in" => {
                                println!("[MENU] Zoom In clicked");
                                let _ = window.emit("menu-zoom-in", ());
                            }
                            "zoom_out" => {
                                println!("[MENU] Zoom Out clicked");
                                let _ = window.emit("menu-zoom-out", ());
                            }
                            "reset_zoom" => {
                                println!("[MENU] Reset Zoom clicked");
                                let _ = window.emit("menu-reset-zoom", ());
                            }
                            "fit_width" => {
                                println!("[MENU] Fit Width clicked");
                                let _ = window.emit("menu-fit-width", ());
                            }
                            "fit_height" => {
                                println!("[MENU] Fit Height clicked");
                                let _ = window.emit("menu-fit-height", ());
                            }
                            "focus_mode" => {
                                println!("[MENU] Focus Mode clicked");
                                let _ = window.emit("menu-focus-mode", ());
                            }

                            // File menu
                            "open_file" => {
                                println!("[MENU] Open File clicked");
                                let _ = window.emit("menu-open-file", ());
                            }
                            "browse_templates" => {
                                println!("[MENU] Browse Templates clicked");
                                let _ = window.emit("menu-browse-templates", ());
                            }
                            "start_fresh" => {
                                println!("[MENU] Start Fresh clicked");
                                let _ = window.emit("menu-start-fresh", ());
                            }
                            "search_pdf" => {
                                println!("[MENU] Search PDF clicked");
                                let _ = window.emit("menu-search-pdf", ());
                            }
                            "export_as_pdf" => {
                                println!("[MENU] Export as PDF clicked");
                                let _ = window.emit("menu-export-as-pdf", ());
                            }
                            "export_as_lpdf" => {
                                println!("[MENU] Export as LPDF clicked");
                                let _ = window.emit("menu-export-as-lpdf", ());
                            }
                            "export_as_docx" => {
                                println!("[MENU] Export as DOCX clicked");
                                let _ = window.emit("menu-export-as-docx", ());
                            }
                            "share_pdf" => {
                                println!("[MENU] Share PDF clicked");
                                let _ = window.emit("menu-share-pdf", ());
                            }

                            // Tools menu
                            "tool_pencil" => {
                                println!("[MENU] Pencil tool selected");
                                let _ = window.emit("menu-select-tool", "pencil");
                            }
                            "tool_eraser" => {
                                println!("[MENU] Eraser tool selected");
                                let _ = window.emit("menu-select-tool", "eraser");
                            }
                            "tool_text" => {
                                println!("[MENU] Text tool selected");
                                let _ = window.emit("menu-select-tool", "text");
                            }
                            "tool_arrow" => {
                                println!("[MENU] Arrow tool selected");
                                let _ = window.emit("menu-select-tool", "arrow");
                            }
                            "tool_highlighter" => {
                                println!("[MENU] Highlighter tool selected");
                                let _ = window.emit("menu-select-tool", "highlighter");
                            }
                            "tool_sticky" => {
                                println!("[MENU] Sticky Note tool selected");
                                let _ = window.emit("menu-select-tool", "sticky");
                            }
                            "tool_stamps" => {
                                println!("[MENU] Stamps tool selected");
                                let _ = window.emit("menu-select-tool", "stamps");
                            }

                            // Help menu
                            "help" => {
                                println!("[MENU] Help menu clicked, opening help page");
                                let _ = window.emit("menu-help", ());
                            }
                            "shortcuts" => {
                                println!("[MENU] Shortcuts menu clicked, opening shortcuts modal");
                                let _ = window.emit("show-shortcuts", ());
                            }
                            "report_bug" => {
                                println!("[MENU] Report Bug clicked, opening GitHub issues");
                                let url = "https://github.com/rudi-q/leed_pdf_viewer/issues";
                                #[cfg(target_os = "macos")]
                                {
                                    let _ = std::process::Command::new("open").arg(url).spawn();
                                }
                            }
                            "feedback" => {
                                println!("[MENU] Submit Feedback clicked, opening email");
                                let url = "mailto:write@leed.my?subject=LeedPDF%20Feedback";
                                #[cfg(target_os = "macos")]
                                {
                                    let _ = std::process::Command::new("open").arg(url).spawn();
                                }
                            }
                            _ => {}
                        }
                    }
                });
            }

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ============ NEW: DEEP LINK HANDLING (macOS) ============
            let app_handle = app.handle().clone();

            // CRITICAL: Check for launch URLs immediately (fixes first-attempt issue)
            println!("=== CHECKING FOR LAUNCH DEEP LINKS ===");
            match app.deep_link().get_current() {
                Ok(Some(urls)) => {
                    println!("[DEEP_LINK] App launched via deep link: {:?}", urls);
                    for url in &urls {
                        let url_str = url.as_str();
                        if !url_str.is_empty() {
                            process_deep_link(&app_handle, url_str);
                        }
                    }
                }
                Ok(None) => {
                    println!("[DEEP_LINK] No launch URLs found");
                }
                Err(e) => {
                    println!("[DEEP_LINK] Error getting launch URLs: {:?}", e);
                }
            }

            // Set up listener for when app is already running (fixes subsequent-attempt issue)
            let handle = app_handle.clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls(); // Call once and store
                println!("[DEEP_LINK] Deep link while running: {:?}", urls);

                // CRITICAL: Bring window to front (fixes "nothing happens" issue)
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.show();
                    let _ = window.unminimize();
                    println!("[DEEP_LINK] Brought window to front");
                }

                // Process URLs (convert Url to &str)
                for url in &urls {
                    // Iterate over reference
                    let url_str = url.as_str();
                    if !url_str.is_empty() {
                        process_deep_link(&handle, url_str);
                    }
                }
            });

            // Don't use register_all() on macOS - it's not supported
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                println!("[DEEP_LINK] Registering URL scheme at runtime");
                app.deep_link().register_all()?;
            }
            // ============ END DEEP LINK HANDLING ============

            // Handle command line arguments for file associations
            let args: Vec<String> = std::env::args().collect();

            // Log essential startup information
            if cfg!(debug_assertions) {
                println!("=== LEEDPDF STARTUP DEBUG ===");
                println!("Command line arguments: {:?}", args);
                println!("Current working directory: {:?}", std::env::current_dir());
                println!("Bundle path: {:?}", std::env::current_exe());

                // Log relevant environment variables
                println!("Environment variables:");
                for (key, value) in std::env::vars() {
                    if key.contains("PATH")
                        || key.contains("HOME")
                        || key.contains("USER")
                        || key.contains("PWD")
                    {
                        println!("  {}: {}", key, value);
                    }
                }
            }

            // Check if we're being launched via file association
            if args.len() > 1 {
                if cfg!(debug_assertions) {
                    println!("*** LAUNCHED WITH ARGUMENTS - POTENTIAL FILE ASSOCIATION ***");
                }
            } else if cfg!(debug_assertions) {
                println!("*** LAUNCHED WITHOUT ARGUMENTS - NORMAL APP LAUNCH ***");
            }

            // Create log file for debugging (only in debug builds)
            if cfg!(debug_assertions) {
                let log_path = if cfg!(target_os = "windows") {
                    "C:\\Windows\\Temp\\leedpdf_debug.txt"
                } else {
                    "/tmp/leedpdf_debug.txt"
                };

                let mut debug_msg =
                    format!("LeedPDF Debug: Found {} args: {:?}\n", args.len(), args);
                std::fs::write(log_path, &debug_msg).unwrap_or_default();

                if args.len() > 1 {
                    // Process arguments with sanitization
                    let mut pdf_files: Vec<String> = Vec::new();

                    for arg in &args[1..] {
                        debug_msg.push_str(&format!("Processing argument: {}\n", arg));

                        // Handle deep links directly BEFORE sanitizing (they're not file paths!)
                        if arg.starts_with("leedpdf://") {
                            debug_msg.push_str(&format!("Found deep link in args: {}\n", arg));
                            process_deep_link(&app.handle(), arg);
                            continue;
                        }

                        // Only sanitize file paths, not deep links
                        let clean_arg = sanitize_path(arg);
                        debug_msg.push_str(&format!("Sanitized to: {}\n", clean_arg));

                        let lower = clean_arg.to_lowercase();
                        if lower.ends_with(".pdf")
                            || lower.ends_with(".lpdf")
                            || lower.ends_with(".md")
                        {
                            pdf_files.push(clean_arg.clone());
                            debug_msg.push_str(&format!("Found PDF/LPDF/MD file: {}\n", clean_arg));
                        }
                    }

                    if !pdf_files.is_empty() {
                        debug_msg.push_str(&format!("Queued {} PDF files\n", pdf_files.len()));
                        std::fs::write(log_path, &debug_msg).unwrap_or_default();
                        process_pdf_files(&app.handle(), pdf_files);
                    }
                } else {
                    app.emit("debug-info", "No command-line arguments provided")
                        .unwrap_or_default();
                }

                // Always emit a debug message
                app.emit("debug-info", &debug_msg).unwrap_or_default();

                println!("=== SETUP COMPLETE ===");
            } else {
                // In production, just process files silently
                if args.len() > 1 {
                    let mut pdf_files: Vec<String> = Vec::new();
                    for arg in &args[1..] {
                        // Handle deep links directly BEFORE sanitizing (they're not file paths!)
                        if arg.starts_with("leedpdf://") {
                            process_deep_link(&app.handle(), arg);
                            continue;
                        }

                        // Only sanitize file paths, not deep links
                        let clean_arg = sanitize_path(arg);
                        let lower = clean_arg.to_lowercase();
                        if lower.ends_with(".pdf")
                            || lower.ends_with(".lpdf")
                            || lower.ends_with(".md")
                        {
                            pdf_files.push(clean_arg.clone());
                        }
                    }
                    if !pdf_files.is_empty() {
                        process_pdf_files(&app.handle(), pdf_files);
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!());

    match builder_result {
        Ok(app) => {
            app.run(|app_handle, event| {
                // Log all events for debugging (debug builds only)
                if cfg!(debug_assertions) {
                    println!("Received event: {:?}", event);
                }

                match event {
                    // Handle macOS file association events
                    #[cfg(any(target_os = "macos", target_os = "ios"))]
                    RunEvent::Opened { urls } => {
                        println!("*** FILE ASSOCIATION EVENT RECEIVED ***");
                        println!("Received opened event with URLs: {:?}", urls);

                        let mut pdf_files: Vec<String> = Vec::new();
                        for url in urls {
                            // Convert URL to file path
                            let url_str = url.to_string();
                            println!("Processing URL: {}", url_str);

                            if url_str.starts_with("file://") {
                                let path = url_str.replace("file://", "");

                                // Properly handle URL decoding errors
                                let decoded_path = match urlencoding::decode(&path) {
                                    Ok(decoded) => decoded.into_owned(),
                                    Err(e) => {
                                        println!("Failed to decode URL path '{}': {:?}", path, e);
                                        continue; // Skip this URL
                                    }
                                };

                                // Skip empty paths
                                if decoded_path.is_empty() {
                                    println!("Decoded path is empty for URL: {}", url_str);
                                    continue;
                                }

                                println!("Decoded path: {}", decoded_path);

                                let lower = decoded_path.to_lowercase();
                                if lower.ends_with(".pdf")
                                    || lower.ends_with(".lpdf")
                                    || lower.ends_with(".md")
                                {
                                    pdf_files.push(decoded_path.clone());
                                    println!(
                                        "Found PDF/LPDF/MD file from opened event: {}",
                                        decoded_path
                                    );
                                } else {
                                    println!("Not a supported file: {}", decoded_path);
                                }
                            } else {
                                println!("Not a file:// URL: {}", url_str);
                            }
                        }

                        if !pdf_files.is_empty() {
                            println!(
                                "Processing {} PDF files from file association event",
                                pdf_files.len()
                            );
                            process_pdf_files(&app_handle, pdf_files);
                        } else {
                            println!("No PDF files found in file association event");
                        }
                    }

                    // Handle other events for debugging
                    RunEvent::WindowEvent { label, event, .. } => {
                        println!("Window event for {}: {:?}", label, event);
                    }

                    RunEvent::ExitRequested { code, .. } => {
                        println!("Exit requested with code: {:?}", code);
                    }

                    _ => {
                        println!("Other event: {:?}", event);
                    }
                }
            });
        }
        Err(e) => {
            eprintln!("Failed to build Tauri application: {e}");
            std::process::exit(1);
        }
    }
}
