use std::collections::VecDeque;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Emitter;

mod license;
use license::{activate_license_key, validate_license_key, get_stored_license, store_license, store_activated_license, remove_stored_license, check_license_smart};

// Global state to store pending file paths
static PENDING_FILES: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());
static FILE_PROCESSED: Mutex<bool> = Mutex::new(false);

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
fn check_file_associations() -> Vec<String> {
    let args: Vec<String> = std::env::args().collect();
    let mut pdf_files: Vec<String> = Vec::new();

    for arg in &args[1..] {
        let clean_arg = sanitize_path(arg);
        if clean_arg.to_lowercase().ends_with(".pdf") {
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
async fn activate_license(app_handle: tauri::AppHandle, license_key: String) -> Result<bool, String> {
    let is_valid = activate_license_key(&license_key).await?;
    
    if is_valid {
        // Store the activated license
        store_activated_license(&app_handle, &license_key)?;
    }
    
    Ok(is_valid)
}

#[tauri::command]
async fn validate_license(app_handle: tauri::AppHandle, license_key: String) -> Result<bool, String> {
    let is_valid = validate_license_key(&license_key).await?;
    
    if is_valid {
        // Update the validation timestamp for existing license
        store_license(&app_handle, &license_key)?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            export_file
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

            // Create log file for debugging
            let log_path = if cfg!(target_os = "windows") {
                "C:\\Windows\\Temp\\leedpdf_debug.txt"
            } else {
                "/tmp/leedpdf_debug.txt"
            };

            let mut debug_msg = format!("LeedPDF Debug: Found {} args: {:?}\n", args.len(), args);
            std::fs::write(log_path, &debug_msg).unwrap_or_default();

            if args.len() > 1 {
                // Clone app handle for use in thread
                let app_handle = app.handle().clone();

                // Store PDF files in multiple places for reliability
                let mut pdf_files: Vec<String> = Vec::new();

                // Process arguments with sanitization
                for arg in &args[1..] {
                    let clean_arg = sanitize_path(arg);
                    debug_msg.push_str(&format!("Processing argument: {} -> {}\n", arg, clean_arg));

                    if clean_arg.to_lowercase().ends_with(".pdf") {
                        pdf_files.push(clean_arg.clone());
                        debug_msg.push_str(&format!("Found PDF file: {}\n", clean_arg));
                    }
                }

                if !pdf_files.is_empty() {
                    // Store in global queue
                    {
                        let mut pending = PENDING_FILES.lock().unwrap();
                        for pdf_file in &pdf_files {
                            pending.push_back(pdf_file.clone());
                        }
                        debug_msg.push_str(&format!("Queued {} PDF files\n", pdf_files.len()));
                    }

                    std::fs::write(log_path, &debug_msg).unwrap_or_default();

                    // Spawn background thread for persistent file loading attempts
                    thread::spawn(move || {
                        for attempt in 1..=20 {
                            // Try for up to 20 attempts (10 seconds)
                            // Check if file has been processed
                            {
                                let processed = FILE_PROCESSED.lock().unwrap();
                                if *processed {
                                    println!("File already processed, stopping attempts");
                                    break;
                                }
                            }

                            // Wait longer for first few attempts (frontend initialization)
                            let delay = if attempt <= 3 {
                                Duration::from_millis(2000) // 2 seconds for first 3 attempts
                            } else if attempt <= 8 {
                                Duration::from_millis(1000) // 1 second for next 5 attempts
                            } else {
                                Duration::from_millis(500) // 0.5 seconds for remaining attempts
                            };

                            thread::sleep(delay);

                            // Try to emit event for each PDF file
                            for (i, pdf_file) in pdf_files.iter().enumerate() {
                                let event_name = if i == 0 {
                                    "file-opened"
                                } else {
                                    "additional-file-opened"
                                };

                                match app_handle.emit(event_name, pdf_file) {
                                    Ok(_) => {
                                        println!(
                                            "Attempt {}: Successfully emitted {} for {}",
                                            attempt, event_name, pdf_file
                                        );

                                        // Also emit a generic startup event
                                        let _ = app_handle.emit("startup-file-ready", pdf_file);
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
                            let _ = app_handle.emit(
                                "debug-info",
                                format!("File loading attempt {} of 20", attempt),
                            );
                        }

                        println!("File loading attempts completed");
                    });
                }
            } else {
                app.emit("debug-info", "No command-line arguments provided")
                    .unwrap_or_default();
            }

            // Always emit a debug message
            app.emit("debug-info", &debug_msg).unwrap_or_default();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
