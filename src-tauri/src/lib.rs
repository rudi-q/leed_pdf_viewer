use std::collections::VecDeque;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Manager, RunEvent};

mod license;
// License imports only needed for Windows/Linux builds (excluded from macOS for App Store compliance)
#[cfg(not(target_os = "macos"))]
use license::{activate_license_key, validate_license_key, get_stored_license, store_license, store_activated_license, remove_stored_license, check_license_smart, get_license_requirement_info};

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
                // Canonicalize to resolve symlinks and normalize
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
                    println!("[DEEP_LINK] Rejected non-file path: {}", canonical_path.display());
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

                if !confirm {
                    println!("[DEEP_LINK] User declined opening deep-linked file: {}", canonical_path.display());
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
            } else {
                // No file parameter, emit the action for informational handlers only
                let content = url.replace("leedpdf://", "").replace("?", "");
                println!("[DEEP_LINK] No file param, emitting raw content: {}", content);
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
// - file param must be an absolute local path with an allowed extension
fn parse_and_validate_deep_link(url: &str) -> Result<ParsedDeepLink, String> {
    let parsed = url::Url::parse(url).map_err(|e| format!("invalid URL: {}", e))?;

    if parsed.scheme() != "leedpdf" {
        return Err("unsupported scheme".to_string());
    }

    let action = parsed
        .host_str()
        .map(|s| s.to_string())
        .unwrap_or_default();

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
                // Reject obvious non-file origins
                let lower = v.to_lowercase();
                if lower.starts_with("http://")
                    || lower.starts_with("https://")
                    || lower.starts_with("file://")
                {
                    return Err("file param must be a local absolute path".to_string());
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
    fn rejects_http_origin_in_file() {
        assert!(parse_and_validate_deep_link("leedpdf://open?file=http://evil/a.pdf").is_err());
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
        assert!(parse_and_validate_deep_link("leedpdf://open?file=/tmp/a.pdf&page=100001").is_err());
    }

    #[test]
    fn accepts_minimal_valid_unix() {
        #[cfg(unix)]
        assert!(parse_and_validate_deep_link("leedpdf://open?file=/tmp/a.pdf&page=2").is_ok());
    }

    #[test]
    fn accepts_minimal_valid_windows() {
        #[cfg(windows)]
        assert!(parse_and_validate_deep_link("leedpdf://open?file=C:/Users/test/a.pdf&page=2").is_ok());
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
async fn activate_license(app_handle: tauri::AppHandle, licensekey: String) -> Result<bool, String> {
    let is_valid = activate_license_key(&licensekey).await?;
    
    if is_valid {
        // Store the activated license
        store_activated_license(&app_handle, &licensekey)?;
    }
    
    Ok(is_valid)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn validate_license(app_handle: tauri::AppHandle, licensekey: String) -> Result<bool, String> {
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
        println!("Frontend ready - processing {} pending files", pending_files.len());
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
        std::env::var("APPDATA").unwrap_or_default(), // Windows
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
        return Err(format!("File too large: {} bytes (max: {} bytes)", metadata.len(), MAX_FILE_SIZE));
    }
    
    // Read the file content with the validated canonical path
    match std::fs::read(&canonical_path) {
        Ok(content) => {
            println!("Successfully read {} bytes from {}", content.len(), canonical_path.display());
            Ok(content)
        }
        Err(e) => {
            println!("Failed to read file {}: {}", canonical_path.display(), e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

#[tauri::command]
fn export_file(_app_handle: tauri::AppHandle, content: Vec<u8>, default_filename: String, filter_name: String, extension: String) -> Result<Option<String>, String> {
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
            
            for attempt in 1..=MAX_FILE_LOADING_ATTEMPTS { // Increased attempts for file associations
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
                            println!(
                                "Attempt {}: Failed to emit event: {:?}",
                                attempt, e
                            );
                        }
                    }
                }

                // Emit debug info
                let _ = app_handle_clone.emit(
                    "debug-info",
                    format!("File loading attempt {} of {}", attempt, MAX_FILE_LOADING_ATTEMPTS),
                );
            }

            println!("File loading attempts completed");
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // NEW: Single-instance plugin for Windows/Linux (macOS is single-instance by default)
    #[cfg(desktop)]
    {
        #[cfg(not(target_os = "macos"))]
        {
            use tauri_plugin_deep_link::DeepLinkExt;
            
            builder = builder.plugin(
                tauri_plugin_single_instance::init(|app, argv, _cwd| {
                    println!("[SINGLE_INSTANCE] New instance attempted with args: {:?}", argv);
                    
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
                })
            );
        }
    }
	let builder_result = builder
        .plugin(tauri_plugin_deep_link::init())
        // .plugin(tauri_plugin_updater::Builder::new().build()) // Disabled for App Store
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
                let urls = event.urls();  // Call once and store
                println!("[DEEP_LINK] Deep link while running: {:?}", urls);
                
                // CRITICAL: Bring window to front (fixes "nothing happens" issue)
                if let Some(window) = handle.get_webview_window("main") {
                    let _ = window.set_focus();
                    let _ = window.show();
                    let _ = window.unminimize();
                    println!("[DEEP_LINK] Brought window to front");
                }
                
                // Process URLs (convert Url to &str)
                for url in &urls {  // Iterate over reference
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
                    if key.contains("PATH") || key.contains("HOME") || key.contains("USER") || key.contains("PWD") {
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

                let mut debug_msg = format!("LeedPDF Debug: Found {} args: {:?}\n", args.len(), args);
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
                        if lower.ends_with(".pdf") || lower.ends_with(".lpdf") || lower.ends_with(".md") {
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
                        if lower.ends_with(".pdf") || lower.ends_with(".lpdf") || lower.ends_with(".md") {
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
                            let decoded_path = urlencoding::decode(&path).unwrap_or_default();
                            
                            println!("Decoded path: {}", decoded_path);
                            
                            let lower = decoded_path.to_lowercase();
                            if lower.ends_with(".pdf") || lower.ends_with(".lpdf") || lower.ends_with(".md") {
                                pdf_files.push(decoded_path.to_string());
                                println!("Found PDF/LPDF/MD file from opened event: {}", decoded_path);
                            } else {
                                println!("Not a supported file: {}", decoded_path);
                            }
                        } else {
                            println!("Not a file:// URL: {}", url_str);
                        }
                    }
                    
                    if !pdf_files.is_empty() {
                        println!("Processing {} PDF files from file association event", pdf_files.len());
                        process_pdf_files(&app_handle, pdf_files);
                    } else {
                        println!("No PDF files found in file association event");
                    }
                }
                
                // Handle other events for debugging
                RunEvent::WindowEvent { label, event, .. } => {
                    println!("Window event for {}: {:?}", label, event);
                }
                
                RunEvent::ExitRequested {  code, .. } => {
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