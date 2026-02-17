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
fn compress_pdf(content: Vec<u8>, quality: Option<u8>) -> Result<Vec<u8>, String> {
    use lopdf::{Document, Object, ObjectId};

    let jpeg_quality = quality.unwrap_or(75).clamp(10, 100);

    let mut doc = Document::load_mem(&content).map_err(|e| format!("Failed to load PDF: {}", e))?;

    // Phase 1: Recompress images — the main source of file size in PDFs
    let total_images = doc
        .objects
        .iter()
        .filter(|(_, obj)| {
            if let Object::Stream(stream) = obj {
                if let Ok(subtype) = stream.dict.get(b"Subtype") {
                    if let Ok(name) = subtype.as_name() {
                        return name == b"Image";
                    }
                }
            }
            false
        })
        .count();

    let mut skip_counts: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let mut filter_types: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    let mut colorspace_types: std::collections::HashMap<String, u32> = std::collections::HashMap::new();

    let image_ids: Vec<ObjectId> = doc
        .objects
        .iter()
        .filter_map(|(&id, obj)| {
            if let Object::Stream(stream) = obj {
                match is_recompressible_image(stream) {
                    Some(Ok(())) => return Some(id),
                    Some(Err(reason)) => {
                        match reason {
                            SkipReason::HasTransparency => {
                                *skip_counts.entry("transparency".to_string()).or_insert(0) += 1;
                            }
                            SkipReason::TooSmall => {
                                *skip_counts.entry("<2KB".to_string()).or_insert(0) += 1;
                            }
                            SkipReason::UnsupportedBitsPerComponent => {
                                *skip_counts.entry("bits/component".to_string()).or_insert(0) += 1;
                            }
                            SkipReason::UnsupportedColorSpace(cs) => {
                                let cs_name = String::from_utf8_lossy(&cs).to_string();
                                *skip_counts.entry("colorspace".to_string()).or_insert(0) += 1;
                                *colorspace_types.entry(cs_name).or_insert(0) += 1;
                            }
                            SkipReason::UnsupportedFilter(f) => {
                                let filter_name = String::from_utf8_lossy(&f).to_string();
                                *skip_counts.entry("filter".to_string()).or_insert(0) += 1;
                                *filter_types.entry(filter_name).or_insert(0) += 1;
                            }
                            SkipReason::HasPredictor => {
                                *skip_counts.entry("predictor".to_string()).or_insert(0) += 1;
                            }
                        }
                    }
                    None => {
                        // Not an image stream, don't count it
                    }
                }
            }
            None
        })
        .collect();

    println!(
        "Image analysis: {} total images, {} candidates for recompression (quality: {}%)",
        total_images,
        image_ids.len(),
        jpeg_quality
    );
    if image_ids.len() < total_images {
        println!("  Skipped breakdown:");
        for (reason, count) in &skip_counts {
            println!("    - {}: {} images", reason, count);
        }
        if !filter_types.is_empty() {
            println!("  Filter types encountered:");
            for (filter, count) in &filter_types {
                println!("    - {}: {} images", filter, count);
            }
        }
        if !colorspace_types.is_empty() {
            println!("  ColorSpace types encountered:");
            for (cs, count) in &colorspace_types {
                println!("    - {}: {} images", cs, count);
            }
        }
    }

    let mut images_processed = 0u32;
    let mut images_skipped_threshold = 0u32;
    for id in image_ids {
        if let Some(Object::Stream(ref mut stream)) = doc.objects.get_mut(&id) {
            match recompress_image_stream(stream, jpeg_quality) {
                ImageCompressionResult::Recompressed => images_processed += 1,
                ImageCompressionResult::SkippedThreshold => images_skipped_threshold += 1,
                ImageCompressionResult::Failed => {}
            }
        }
    }

    if images_skipped_threshold > 0 {
        println!(
            "  {} images skipped (new size didn't meet threshold)",
            images_skipped_threshold
        );
    }

    // Phase 2: Standard PDF optimization (prune only, skip compress to avoid inflating already-good streams)
    doc.prune_objects();
    doc.delete_zero_length_streams();
    // NOTE: doc.compress() removed because it was making files BIGGER by re-compressing already-optimal streams

    let mut output = Vec::new();
    doc.save_to(&mut output)
        .map_err(|e| format!("Failed to save compressed PDF: {}", e))?;

    let original_size = content.len();
    let compressed_size = output.len();
    let ratio = if original_size > 0 {
        ((original_size as f64 - compressed_size as f64) / original_size as f64) * 100.0
    } else {
        0.0
    };

    println!(
        "PDF compression: {} -> {} bytes ({:.1}% reduction, {} images recompressed)",
        original_size, compressed_size, ratio, images_processed
    );

    Ok(output)
}

enum ImageCompressionResult {
    Recompressed,
    SkippedThreshold,
    Failed,
}

enum SkipReason {
    HasTransparency,
    TooSmall,
    UnsupportedBitsPerComponent,
    UnsupportedColorSpace(Vec<u8>),
    UnsupportedFilter(Vec<u8>),
    HasPredictor,
}

/// Convert CMYK pixels to RGB
/// CMYK uses subtractive color model, RGB uses additive
fn cmyk_to_rgb(cmyk_data: &[u8]) -> Vec<u8> {
    let mut rgb_data = Vec::with_capacity((cmyk_data.len() / 4) * 3);
    
    for chunk in cmyk_data.chunks_exact(4) {
        let c = chunk[0] as f32 / 255.0;
        let m = chunk[1] as f32 / 255.0;
        let y = chunk[2] as f32 / 255.0;
        let k = chunk[3] as f32 / 255.0;
        
        // Standard CMYK to RGB conversion
        let r = ((1.0 - c) * (1.0 - k) * 255.0) as u8;
        let g = ((1.0 - m) * (1.0 - k) * 255.0) as u8;
        let b = ((1.0 - y) * (1.0 - k) * 255.0) as u8;
        
        rgb_data.push(r);
        rgb_data.push(g);
        rgb_data.push(b);
    }
    
    rgb_data
}

/// Expand indexed/palette colorspace to RGB
/// Indexed format: pixel values are indices into a color lookup table
fn expand_indexed_to_rgb(
    indexed_data: &[u8],
    base_colorspace: &[u8],
    palette_data: &[u8],
) -> Result<Vec<u8>, ()> {
    let colors_per_pixel = if base_colorspace == b"DeviceRGB" {
        3
    } else if base_colorspace == b"DeviceGray" {
        1
    } else {
        return Err(()); // Unsupported base colorspace
    };
    
    let mut rgb_data = Vec::with_capacity(indexed_data.len() * 3);
    
    for &index in indexed_data {
        let palette_offset = (index as usize) * colors_per_pixel;
        
        if palette_offset + colors_per_pixel > palette_data.len() {
            return Err(()); // Invalid palette index
        }
        
        if colors_per_pixel == 3 {
            // RGB palette
            rgb_data.push(palette_data[palette_offset]);
            rgb_data.push(palette_data[palette_offset + 1]);
            rgb_data.push(palette_data[palette_offset + 2]);
        } else {
            // Grayscale palette - convert to RGB
            let gray = palette_data[palette_offset];
            rgb_data.push(gray);
            rgb_data.push(gray);
            rgb_data.push(gray);
        }
    }
    
    Ok(rgb_data)
}

/// Check if a PDF stream is an image that we can safely recompress.
/// Returns Some(Ok(())) if recompressible, Some(Err(reason)) if image but unsupported, None if not an image.
fn is_recompressible_image(stream: &lopdf::Stream) -> Option<Result<(), SkipReason>> {
    // Must be an Image XObject
    let is_image = match stream.dict.get(b"Subtype") {
        Ok(obj) => match obj.as_name() {
            Ok(name) if name == b"Image" => true,
            _ => false,
        },
        Err(_) => false,
    };

    if !is_image {
        return None; // Not an image, don't count it
    }

    // Skip images with alpha/transparency masks (JPEG doesn't support alpha)
    if stream.dict.get(b"SMask").is_ok() {
        return Some(Err(SkipReason::HasTransparency));
    }

    // Skip tiny images (icons, bullets) — lowered from 10KB to 2KB to catch more images
    if stream.content.len() < 2_000 {
        return Some(Err(SkipReason::TooSmall));
    }

    // Only handle 8 bits per component
    match stream.dict.get(b"BitsPerComponent") {
        Ok(bpc) => match bpc.as_i64() {
            Ok(8) => {}
            _ => return Some(Err(SkipReason::UnsupportedBitsPerComponent)),
        },
        Err(_) => return Some(Err(SkipReason::UnsupportedBitsPerComponent)),
    }

    // Handle common color spaces (DeviceRGB, DeviceGray, DeviceCMYK, Indexed)
    match stream.dict.get(b"ColorSpace") {
        Ok(cs) => {
            // Check if it's a simple name
            if let Ok(name) = cs.as_name() {
                if name == b"DeviceRGB" || name == b"DeviceGray" || name == b"DeviceCMYK" {
                    // These are all supported
                } else {
                    return Some(Err(SkipReason::UnsupportedColorSpace(name.to_vec())));
                }
            } else if let Ok(arr) = cs.as_array() {
                // Array-based colorspaces: Indexed, ICCBased, CalRGB, CalGray, etc.
                if let Some(first) = arr.first() {
                    if let Ok(name) = first.as_name() {
                        if name == b"Indexed" {
                            // Indexed: [/Indexed /BaseColorSpace hival lookup]
                            // Supported - we'll expand the palette
                        } else if name == b"ICCBased" {
                            // ICCBased: [/ICCBased <stream>]
                            // Supported - treat like RGB/Gray/CMYK based on component count
                        } else if name == b"CalRGB" || name == b"CalGray" {
                            // Calibrated RGB/Gray - treat like DeviceRGB/DeviceGray
                            // Supported
                        } else {
                            return Some(Err(SkipReason::UnsupportedColorSpace(name.to_vec())));
                        }
                    } else {
                        return Some(Err(SkipReason::UnsupportedColorSpace(b"<array-error>".to_vec())));
                    }
                } else {
                    return Some(Err(SkipReason::UnsupportedColorSpace(b"<empty-array>".to_vec())));
                }
            } else {
                return Some(Err(SkipReason::UnsupportedColorSpace(b"<complex>".to_vec())));
            }
        }
        Err(_) => return Some(Err(SkipReason::UnsupportedColorSpace(b"<missing>".to_vec()))),
    }

    // Handle filters we know how to decode (single or array)
    match stream.dict.get(b"Filter") {
        Ok(filter) => {
            // Try single filter name first
            if let Ok(name) = filter.as_name() {
                if name == b"FlateDecode" || name == b"DCTDecode" || name == b"JPXDecode" {
                    // Supported filters
                } else {
                    return Some(Err(SkipReason::UnsupportedFilter(name.to_vec())));
                }
            } else if let Ok(arr) = filter.as_array() {
                // Filter array - check if it's a single-element array (common in some PDFs)
                if arr.len() == 1 {
                    if let Some(first) = arr.first() {
                        if let Ok(name) = first.as_name() {
                            if name == b"FlateDecode" || name == b"DCTDecode" || name == b"JPXDecode" {
                                // Single filter in array - supported
                            } else {
                                return Some(Err(SkipReason::UnsupportedFilter(name.to_vec())));
                            }
                        } else {
                            return Some(Err(SkipReason::UnsupportedFilter(b"<array-error>".to_vec())));
                        }
                    }
                } else {
                    // Multiple filters - too complex for now
                    return Some(Err(SkipReason::UnsupportedFilter(b"<multi-filter>".to_vec())));
                }
            } else {
                return Some(Err(SkipReason::UnsupportedFilter(b"<unknown>".to_vec())));
            }
        }
        // No filter means raw uncompressed data — we can handle that
        Err(_) => {}
    }

    // Skip FlateDecode images with predictors (complex PNG-style encoding)
    if let Ok(params) = stream.dict.get(b"DecodeParms") {
        if let Ok(dict) = params.as_dict() {
            if let Ok(predictor) = dict.get(b"Predictor") {
                if let Ok(val) = predictor.as_i64() {
                    if val > 1 {
                        return Some(Err(SkipReason::HasPredictor));
                    }
                }
            }
        }
    }

    Some(Ok(()))
}

/// Recompress an image stream as JPEG at the given quality (1-100).
fn recompress_image_stream(stream: &mut lopdf::Stream, quality: u8) -> ImageCompressionResult {
    use image::codecs::jpeg::JpegEncoder;
    use image::ExtendedColorType;

    let width = match stream.dict.get(b"Width") {
        Ok(w) => match w.as_i64() {
            Ok(v) => v as u32,
            Err(_) => return ImageCompressionResult::Failed,
        },
        Err(_) => return ImageCompressionResult::Failed,
    };
    let height = match stream.dict.get(b"Height") {
        Ok(h) => match h.as_i64() {
            Ok(v) => v as u32,
            Err(_) => return ImageCompressionResult::Failed,
        },
        Err(_) => return ImageCompressionResult::Failed,
    };

    // Get colorspace - handle both simple names and arrays (for Indexed)
    // For Indexed, extract: [/Indexed /BaseColorSpace hival lookup]
    let (cs_bytes, is_indexed, is_cmyk, indexed_info): (Vec<u8>, bool, bool, Option<(Vec<u8>, i64, Vec<u8>)>) = 
        match stream.dict.get(b"ColorSpace") {
        Ok(cs) => {
            if let Ok(name) = cs.as_name() {
                let is_cmyk = name == b"DeviceCMYK";
                (name.to_vec(), false, is_cmyk, None)
            } else if let Ok(arr) = cs.as_array() {
                // Handle array-based colorspaces
                if let Some(first) = arr.first() {
                    if let Ok(name) = first.as_name() {
                        if name == b"Indexed" {
                            // Indexed colorspace: [/Indexed /BaseColorSpace hival lookup]
                            if arr.len() >= 4 {
                                if let (Some(base), Some(hival_obj), Some(lookup)) =
                                    (arr.get(1), arr.get(2), arr.get(3))
                                {
                                    if let (Ok(base_cs), Ok(hival)) =
                                        (base.as_name(), hival_obj.as_i64())
                                    {
                                        // Extract lookup table data (might be inline or reference)
                                        let palette_data = match lookup {
                                            lopdf::Object::String(ref bytes, _) => bytes.clone(),
                                            _ => {
                                                // Lookup table might be a stream reference or other type - skip for now
                                                return ImageCompressionResult::Failed;
                                            }
                                        };
                                        
                                        (
                                            b"Indexed".to_vec(),
                                            true,
                                            false,
                                            Some((base_cs.to_vec(), hival, palette_data)),
                                        )
                                    } else {
                                        return ImageCompressionResult::Failed;
                                    }
                                } else {
                                    return ImageCompressionResult::Failed;
                                }
                            } else {
                                return ImageCompressionResult::Failed;
                            }
                        } else if name == b"ICCBased" {
                            // ICCBased: [/ICCBased <stream>]
                            // Treat as RGB for now (most common case)
                            // TODO: Could inspect stream's /N parameter to determine if Gray/CMYK
                            (b"DeviceRGB".to_vec(), false, false, None)
                        } else if name == b"CalRGB" {
                            // CalRGB: treat as DeviceRGB
                            (b"DeviceRGB".to_vec(), false, false, None)
                        } else if name == b"CalGray" {
                            // CalGray: treat as DeviceGray
                            (b"DeviceGray".to_vec(), false, false, None)
                        } else {
                            return ImageCompressionResult::Failed;
                        }
                    } else {
                        return ImageCompressionResult::Failed;
                    }
                } else {
                    return ImageCompressionResult::Failed;
                }
            } else {
                return ImageCompressionResult::Failed;
            }
        }
        Err(_) => return ImageCompressionResult::Failed,
    };

    // Determine channels and color type for encoding
    // Note: CMYK and Indexed will be converted to RGB
    let (_source_channels, color_type, target_channels) = if is_indexed {
        // Indexed: 1 byte per pixel (index), but will expand to RGB (3 bytes)
        (1u32, ExtendedColorType::Rgb8, 3u32)
    } else if cs_bytes == b"DeviceRGB" {
        (3u32, ExtendedColorType::Rgb8, 3u32)
    } else if cs_bytes == b"DeviceGray" {
        (1u32, ExtendedColorType::L8, 1u32)
    } else if cs_bytes == b"DeviceCMYK" {
        // CMYK: 4 channels in source, but we'll convert to 3 (RGB) for JPEG
        (4u32, ExtendedColorType::Rgb8, 3u32)
    } else {
        return ImageCompressionResult::Failed;
    };

    // Extract filter name - handle both single name and single-element arrays
    let filter_bytes: Option<Vec<u8>> = stream.dict.get(b"Filter").ok().and_then(|f| {
        if let Ok(name) = f.as_name() {
            Some(name.to_vec())
        } else if let Ok(arr) = f.as_array() {
            // Single-element filter array
            if arr.len() == 1 {
                arr.first().and_then(|obj| obj.as_name().ok()).map(|n| n.to_vec())
            } else {
                None
            }
        } else {
            None
        }
    });

    let original_stream_size = stream.content.len();
    let filter_name = filter_bytes.as_deref();
    let is_already_jpeg = filter_name == Some(b"DCTDecode");
    let is_jpeg2000 = filter_name == Some(b"JPXDecode");

    // Get raw pixel data depending on current encoding
    // Note: We avoid mutating the stream until we're sure we'll succeed
    let raw_pixels: Vec<u8> = if filter_name == Some(b"FlateDecode") {
        // Decompress zlib to get raw pixels
        // Clone the stream to avoid side-effects if we fail later
        let mut temp_stream = stream.clone();
        if temp_stream.decompress().is_err() {
            return ImageCompressionResult::Failed;
        }
        let decompressed = temp_stream.content;
        
        if is_indexed {
            // Indexed image: expand palette to RGB
            if let Some((ref base_cs, _hival, ref palette)) = indexed_info {
                match expand_indexed_to_rgb(&decompressed, base_cs, palette) {
                    Ok(rgb) => rgb,
                    Err(_) => return ImageCompressionResult::Failed,
                }
            } else {
                return ImageCompressionResult::Failed;
            }
        } else if is_cmyk {
            // CMYK FlateDecode: convert to RGB
            cmyk_to_rgb(&decompressed)
        } else {
            // RGB or Grayscale - use as-is
            decompressed
        }
    } else if is_already_jpeg {
        // Already JPEG (including CMYK JPEG) — decode to RGB
        // The image crate automatically converts CMYK JPEG to RGB
        // Note: This causes generation loss, so we'll only replace if significantly smaller
        match image::load_from_memory_with_format(&stream.content, image::ImageFormat::Jpeg) {
            Ok(img) => {
                // Convert to RGB8 or Luma8 depending on source
                if is_cmyk || cs_bytes == b"DeviceRGB" {
                    img.to_rgb8().into_raw()
                } else {
                    img.to_luma8().into_raw()
                }
            }
            Err(_) => return ImageCompressionResult::Failed,
        }
    } else if is_jpeg2000 {
        // JPEG2000 support would require jpeg2000 feature + jpeg2k crate
        // Skip for now
        return ImageCompressionResult::Failed;
    } else if filter_name.is_none() {
        // Uncompressed raw data
        let raw_data = stream.content.clone();
        
        if is_indexed {
            // Indexed image: expand palette to RGB
            if let Some((ref base_cs, _hival, ref palette)) = indexed_info {
                match expand_indexed_to_rgb(&raw_data, base_cs, palette) {
                    Ok(rgb) => rgb,
                    Err(_) => return ImageCompressionResult::Failed,
                }
            } else {
                return ImageCompressionResult::Failed;
            }
        } else if is_cmyk {
            // Uncompressed CMYK: convert to RGB
            cmyk_to_rgb(&raw_data)
        } else {
            // RGB or Grayscale - use as-is
            raw_data
        }
    } else {
        return ImageCompressionResult::Failed;
    };

    // Validate expected data size (cast to usize before multiplying to prevent u32 overflow)
    // Use target_channels (post-conversion) for validation
    let expected_size = (width as usize) * (height as usize) * (target_channels as usize);
    if raw_pixels.len() != expected_size {
        return ImageCompressionResult::Failed;
    }

    // Encode as JPEG at the user-chosen quality level
    let mut jpeg_data: Vec<u8> = Vec::new();
    {
        let mut encoder = JpegEncoder::new_with_quality(&mut jpeg_data, quality);
        if encoder
            .encode(&raw_pixels, width, height, color_type)
            .is_err()
        {
            return ImageCompressionResult::Failed;
        }
    }

    // Quality-aware threshold: lower quality = more aggressive (allow smaller reductions)
    // This helps achieve meaningful compression even with generation loss on pre-compressed JPEGs
    let threshold_multiplier = if is_already_jpeg {
        if quality < 50 {
            0.85 // Aggressive: accept 15%+ reduction for very low quality
        } else if quality < 70 {
            0.88 // Moderate: accept 12%+ reduction for medium quality
        } else {
            0.92 // Conservative: accept 8%+ reduction for high quality
        }
    } else {
        1.0 // For non-JPEG sources, any reduction is good (no generation loss)
    };

    let size_threshold = (original_stream_size as f64 * threshold_multiplier) as usize;

    if jpeg_data.len() >= size_threshold {
        return ImageCompressionResult::SkippedThreshold;
    }

    let cs_display = String::from_utf8_lossy(&cs_bytes);
    println!(
        "  Image {}x{} {}: {} -> {} bytes (saved {})",
        width,
        height,
        cs_display,
        original_stream_size,
        jpeg_data.len(),
        original_stream_size - jpeg_data.len()
    );

    // Update stream with JPEG data
    stream.set_content(jpeg_data);
    stream
        .dict
        .set("Filter", lopdf::Object::Name(b"DCTDecode".to_vec()));
    stream.dict.remove(b"DecodeParms");
    
    // If we converted CMYK or Indexed to RGB, update the colorspace
    if is_cmyk || is_indexed {
        stream.dict.set("ColorSpace", lopdf::Object::Name(b"DeviceRGB".to_vec()));
    }
    
    stream.allows_compression = false;

    ImageCompressionResult::Recompressed
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
            compress_pdf,
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
