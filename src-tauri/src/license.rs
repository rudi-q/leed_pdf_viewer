use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
struct LicenseValidationRequest {
    key: String,
    organization_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LicenseActivationRequest {
    key: String,
    organization_id: String,
    label: String,
}

#[derive(Debug, Deserialize)]
struct LicenseValidationResponse {
    status: String,
}

#[derive(Debug, Deserialize)]
struct LicenseKeyNested {
    status: String,
}

#[derive(Debug, Deserialize)]
struct LicenseActivationResponse {
    license_key: LicenseKeyNested,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredLicense {
    pub key: String,
    pub validated_at: u64,
    pub activated_at: u64,
    pub device_id: String,
}

const POLAR_VALIDATION_URL: &str = "https://api.polar.sh/v1/customer-portal/license-keys/validate";
const POLAR_ACTIVATION_URL: &str = "https://api.polar.sh/v1/customer-portal/license-keys/activate";
const ORGANIZATION_ID: &str = "2ec4183f-eaad-4089-b9dc-9008f3748460";

// Offline grace period: 7 days (in seconds)
const OFFLINE_GRACE_PERIOD: u64 = 7 * 24 * 60 * 60;

/// Get unique device ID for license activation
pub fn get_device_id() -> Result<String, String> {
    machine_uid::get().map_err(|e| format!("Failed to get device ID: {}", e))
}

/// Validate license key prefix for current platform
fn is_valid_license_key_prefix(license_key: &str) -> bool {
    // TODO: Remove LEEDUMMY support after merging to main - this is for testing only
    if license_key.starts_with("LEEDUMMY") {
        return true; // LEEDUMMY works on all platforms for testing
    }
    
    #[cfg(target_os = "windows")]
    {
        license_key.starts_with("LEEDWIN")
    }
    #[cfg(target_os = "macos")]
    {
        license_key.starts_with("LEEDMAC")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // For other platforms, accept both prefixes or add specific logic
        license_key.starts_with("LEEDWIN") || license_key.starts_with("LEEDMAC")
    }
}

/// Activate a license key for this device (first time setup)
pub async fn activate_license_key(license_key: &str) -> Result<bool, String> {
    // Validate license key pattern based on platform
    if !is_valid_license_key_prefix(license_key) {
        #[cfg(target_os = "windows")]
        {
            return Err("This license key is not valid for Windows. Please ensure you have a Windows license key that starts with 'LEEDWIN'.".to_string());
        }
        #[cfg(target_os = "macos")]
        {
            return Err("This license key is not valid for macOS. Please ensure you have a Mac license key that starts with 'LEEDMAC'.".to_string());
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            return Err("Invalid license key format. Please ensure your license key starts with 'LEEDWIN' or 'LEEDMAC'.".to_string());
        }
    }
    
    let client = reqwest::Client::new();
    let device_id = get_device_id()?;
    
    let request_body = LicenseActivationRequest {
        key: license_key.to_string(),
        organization_id: ORGANIZATION_ID.to_string(),
        label: device_id,
    };

    let response = client
        .post(POLAR_ACTIVATION_URL)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    // Handle HTTP status codes properly
    if response.status().is_client_error() {
        // 4xx errors indicate client issues (invalid license, already activated, etc.)
        let status_code = response.status().as_u16();
        return match status_code {
            400 => Err("Invalid license key format or request. Please check your license key.".to_string()),
            401 => Err("License key authentication failed. Please verify your license key is correct.".to_string()),
            403 => Err("This license key cannot be activated. It may be expired, already used on too many devices, or invalid.".to_string()),
            404 => Err("License key not found. Please check that you've entered the correct license key.".to_string()),
            409 => Err("This license key has already been activated on this device or has reached its device limit.".to_string()),
            _ => Err(format!("License activation failed with error code {}. Please contact support if this persists.", status_code)),
        };
    }
    
    if !response.status().is_success() {
        // 5xx or other unexpected status codes are server/network errors
        return Err("License server is temporarily unavailable. Please try again later.".to_string());
    }

    let activation_response: LicenseActivationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))?;

    // Check if status is "granted" for successful activation
    if activation_response.license_key.status == "granted" {
        Ok(true)
    } else {
        // Non-"granted" status means invalid license, not a network error
        Err(format!("License activation was rejected. Status: {}. Please verify your license key is valid and not expired.", activation_response.license_key.status))
    }
}

/// Validate an already-activated license key
pub async fn validate_license_key(license_key: &str) -> Result<bool, String> {
    // Validate license key pattern based on platform
    if !is_valid_license_key_prefix(license_key) {
        #[cfg(target_os = "windows")]
        {
            return Err("This license key is not valid for Windows. Please ensure you have a Windows license key that starts with 'LEEDWIN'.".to_string());
        }
        #[cfg(target_os = "macos")]
        {
            return Err("This license key is not valid for macOS. Please ensure you have a Mac license key that starts with 'LEEDMAC'.".to_string());
        }
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            return Err("Invalid license key format. Please ensure your license key starts with 'LEEDWIN' or 'LEEDMAC'.".to_string());
        }
    }
    
    let client = reqwest::Client::new();
    
    let request_body = LicenseValidationRequest {
        key: license_key.to_string(),
        organization_id: ORGANIZATION_ID.to_string(),
    };

    let response = client
        .post(POLAR_VALIDATION_URL)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    // Handle HTTP status codes properly
    if response.status().is_client_error() {
        // 4xx errors indicate client issues (invalid license, expired, etc.)
        let status_code = response.status().as_u16();
        return match status_code {
            400 => Err("Invalid license key format. Please check your license key.".to_string()),
            401 => Err("License key authentication failed. Please verify your license key is correct.".to_string()),
            403 => Err("This license key is not valid or has expired. Please check your license status.".to_string()),
            404 => Err("License key not found. Please check that you've entered the correct license key.".to_string()),
            _ => Err(format!("License validation failed with error code {}. Please contact support if this persists.", status_code)),
        };
    }
    
    if !response.status().is_success() {
        // 5xx or other unexpected status codes are server/network errors
        return Err("License server is temporarily unavailable. Please try again later.".to_string());
    }

    let validation_response: LicenseValidationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))?;

    // Check if status is "granted" for valid license
    if validation_response.status == "granted" {
        Ok(true)
    } else {
        // Non-"granted" status means invalid license, not a network error
        Err(format!("License validation was rejected. Status: {}. Your license may be expired or invalid.", validation_response.status))
    }
}

fn get_license_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("license.json"))
}

pub fn get_stored_license(app_handle: &AppHandle) -> Result<Option<StoredLicense>, String> {
    let license_file = get_license_file_path(app_handle)?;
    
    if !license_file.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&license_file)
        .map_err(|e| format!("Failed to read license file: {}", e))?;

    let stored_license: StoredLicense = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse license file: {}", e))?;

    Ok(Some(stored_license))
}

/// Store an activated license (first time setup)
pub fn store_activated_license(app_handle: &AppHandle, license_key: &str) -> Result<(), String> {
    let license_file = get_license_file_path(app_handle)?;
    let device_id = get_device_id()?;
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let stored_license = StoredLicense {
        key: license_key.to_string(),
        validated_at: current_time,
        activated_at: current_time,
        device_id,
    };

    let content = serde_json::to_string_pretty(&stored_license)
        .map_err(|e| format!("Failed to serialize license: {}", e))?;

    std::fs::write(&license_file, content)
        .map_err(|e| format!("Failed to write license file: {}", e))?;

    Ok(())
}

/// Update validation timestamp for existing activated license
pub fn store_license(app_handle: &AppHandle, license_key: &str) -> Result<(), String> {
    // Get existing license to preserve activation data
    let existing_license = get_stored_license(app_handle)?;
    
    match existing_license {
        Some(license) => {
            // Update existing license with new validation timestamp
            let license_file = get_license_file_path(app_handle)?;
            
            let updated_license = StoredLicense {
                key: license_key.to_string(),
                validated_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
                activated_at: license.activated_at,
                device_id: license.device_id,
            };
        
            let content = serde_json::to_string_pretty(&updated_license)
                .map_err(|e| format!("Failed to serialize license: {}", e))?;
        
            std::fs::write(&license_file, content)
                .map_err(|e| format!("Failed to write license file: {}", e))?;
        
            Ok(())
        },
        None => {
            // No existing license - this shouldn't happen for validation updates
            // but we'll create a new one anyway
            store_activated_license(app_handle, license_key)
        }
    }
}

pub fn remove_stored_license(app_handle: &AppHandle) -> Result<(), String> {
    let license_file = get_license_file_path(app_handle)?;
    
    if license_file.exists() {
        std::fs::remove_file(&license_file)
            .map_err(|e| format!("Failed to remove license file: {}", e))?;
    }

    Ok(())
}

/// Smart license validation that works offline within grace period
pub async fn check_license_smart(app_handle: &AppHandle) -> Result<bool, String> {
    // Try to get stored license first
    let stored_license = match get_stored_license(app_handle)? {
        Some(license) => license,
        None => return Err("No license key found".to_string()),
    };
    
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let time_since_validation = current_time - stored_license.validated_at;
    
    // If within offline grace period, accept the stored license
    if time_since_validation < OFFLINE_GRACE_PERIOD {
        return Ok(true);
    }
    
    // Try online validation (might fail due to no internet)
    match validate_license_key(&stored_license.key).await {
        Ok(true) => {
            // Update validation timestamp on successful online check
            store_license(app_handle, &stored_license.key)?;
            Ok(true)
        },
        Ok(false) => {
            // License is invalid online - remove it
            remove_stored_license(app_handle)?;
            Err("License key is no longer valid".to_string())
        },
        Err(_network_error) => {
            // Network error - check if we're still within extended offline grace period
            // Give extra time (14 days total) for network issues
            if time_since_validation < (OFFLINE_GRACE_PERIOD * 2) {
                Ok(true) // Allow continued offline usage
            } else {
                Err("License validation required - please connect to internet".to_string())
            }
        }
    }
}
