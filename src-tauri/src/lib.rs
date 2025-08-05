use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
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
      
      // Write debug info to a log file
      let log_path = "C:\\Windows\\Temp\\leedpdf_debug.txt";
      let mut debug_msg = format!("LeedPDF Debug: Found {} args: {:?}\n", args.len(), args);
      std::fs::write(log_path, &debug_msg).unwrap_or_default();
      
      // Delay to allow frontend to set up event listeners
      std::thread::sleep(std::time::Duration::from_millis(1000));
      
      // Create debug message for UI
      app.emit("debug-info", &debug_msg).unwrap_or_default();
      
      if args.len() > 1 {
        // Skip the first argument (executable path) and check for PDF files
        for arg in &args[1..] {
          let arg_msg = format!("Processing argument: {}", arg);
          app.emit("debug-info", &arg_msg).unwrap_or_default();
          
          if arg.to_lowercase().ends_with(".pdf") {
            // Log to file
            debug_msg.push_str(&format!("Found PDF file: {}\n", arg));
            std::fs::write(log_path, &debug_msg).unwrap_or_default();
            
            // Emit an event to the frontend with the file path
            match app.emit("file-opened", arg) {
              Ok(_) => {
                debug_msg.push_str("Successfully emitted file-opened event\n");
                std::fs::write(log_path, &debug_msg).unwrap_or_default();
                app.emit("debug-info", "Successfully emitted file-opened event").unwrap_or_default();
              },
              Err(e) => {
                let error_msg = format!("Failed to emit event: {:?}\n", e);
                debug_msg.push_str(&error_msg);
                std::fs::write(log_path, &debug_msg).unwrap_or_default();
                app.emit("debug-info", &format!("Failed to emit event: {:?}", e)).unwrap_or_default();
              },
            }
          } else {
            let not_pdf_msg = format!("Argument '{}' is not a PDF file", arg);
            app.emit("debug-info", &not_pdf_msg).unwrap_or_default();
          }
        }
      } else {
        app.emit("debug-info", "No command-line arguments provided").unwrap_or_default();
      }
      
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
