use std::collections::VecDeque;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::{Emitter, RunEvent};

mod license;
use license::{
    activate_license_key, check_license_smart, get_stored_license, remove_stored_license,
    store_activated_license, store_license, validate_license_key,
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
            // Extract content after leedpdf://
            let content = arg.replace("leedpdf://", "");
            println!("[check_file_associations] Deep link content: {}", content);

            // Emit deep-link event to frontend
            match app_handle.emit("deep-link", &content) {
                Ok(_) => println!("[check_file_associations] Successfully emitted deep-link event"),
                Err(e) => println!(
                    "[check_file_associations] Failed to emit deep-link event: {:?}",
                    e
                ),
            }
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

#[tauri::command]
fn get_stored_license_key(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    match get_stored_license(&app_handle)? {
        Some(stored_license) => Ok(Some(stored_license.key)),
        None => Ok(None),
    }
}

#[tauri::command]
fn clear_license(app_handle: tauri::AppHandle) -> Result<(), String> {
    remove_stored_license(&app_handle)
}

#[tauri::command]
async fn check_license_smart_command(app_handle: tauri::AppHandle) -> Result<bool, String> {
    check_license_smart(&app_handle).await
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

    println!("Found {} system fonts using font-kit", fonts.len());
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
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_pending_file,
            check_file_associations,
            mark_file_processed,
            open_external_url,
            activate_license,
            validate_license,
            get_stored_license_key,
            clear_license,
            check_license_smart_command,
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
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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
                            debug_msg.push_str(&format!("Found deep link: {}\n", arg));
                            // Extract content after leedpdf://
                            let content = arg.replace("leedpdf://", "");
                            debug_msg.push_str(&format!("Deep link content: {}\n", content));

                            // Emit deep-link event to frontend
                            match app.emit("deep-link", content) {
                                Ok(_) => {
                                    debug_msg.push_str("Successfully emitted deep-link event\n")
                                }
                                Err(e) => debug_msg.push_str(&format!(
                                    "Failed to emit deep-link event: {:?}\n",
                                    e
                                )),
                            }
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
                            // Extract content after leedpdf://
                            let content = arg.replace("leedpdf://", "");
                            // Emit deep-link event to frontend
                            let _ = app.emit("deep-link", content);
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
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
