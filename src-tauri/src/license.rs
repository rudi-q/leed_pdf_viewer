// ========== LICENSE MODULE ==========
// All license functionality is excluded from macOS builds for App Store compliance.
// On macOS, users pay via the App Store and get immediate full access.
// On Windows/Linux, license keys are required via Polar.sh

// Imports only needed for Windows/Linux builds
#[cfg(not(target_os = "macos"))]
use serde::{Deserialize, Serialize};
#[cfg(not(target_os = "macos"))]
use std::path::PathBuf;
#[cfg(not(target_os = "macos"))]
use tauri::{AppHandle, Manager};

// These types, constants, and functions only exist in Windows/Linux builds
#[cfg(not(target_os = "macos"))]
mod license_impl {
    use super::*;

    #[derive(Debug, Serialize, Deserialize)]
    pub(super) struct LicenseValidationRequest {
        pub key: String,
        pub organization_id: String,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub(super) struct LicenseActivationRequest {
        pub key: String,
        pub organization_id: String,
        pub label: String,
    }

    #[derive(Debug, Deserialize)]
    pub(super) struct LicenseValidationResponse {
        pub status: String,
    }

    #[derive(Debug, Deserialize)]
    pub(super) struct LicenseKeyNested {
        pub status: String,
    }

    #[derive(Debug, Deserialize)]
    pub(super) struct LicenseActivationResponse {
        pub license_key: LicenseKeyNested,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct StoredLicense {
        pub key: String,
        pub validated_at: u64,
        pub activated_at: u64,
        pub device_id: String,
    }

    pub(super) const POLAR_VALIDATION_URL: &str = "https://api.polar.sh/v1/customer-portal/license-keys/validate";
    pub(super) const POLAR_ACTIVATION_URL: &str = "https://api.polar.sh/v1/customer-portal/license-keys/activate";
    pub(super) const ORGANIZATION_ID: &str = "2ec4183f-eaad-4089-b9dc-9008f3748460";
    pub(super) const OFFLINE_GRACE_PERIOD: u64 = 7 * 24 * 60 * 60;

    pub(super) fn get_device_id() -> Result<String, String> {
        machine_uid::get().map_err(|e| format!("Failed to get device ID: {}", e))
    }

    pub(super) fn is_valid_license_key_prefix(license_key: &str) -> bool {
        if license_key.starts_with("LEEDUMMY") {
            return true;
        }
        
        #[cfg(target_os = "windows")]
        {
            license_key.starts_with("LEEDWIN")
        }
        #[cfg(not(target_os = "windows"))]
        {
            license_key.starts_with("LEEDWIN") || license_key.starts_with("LEEDMAC")
        }
    }
}

// Public functions - only compiled for Windows/Linux
#[cfg(not(target_os = "macos"))]
pub async fn activate_license_key(license_key: &str) -> Result<bool, String> {
    use license_impl::*;
    
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

    if response.status().is_client_error() {
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
        return Err("License server is temporarily unavailable. Please try again later.".to_string());
    }

    let activation_response: LicenseActivationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))?;

    if activation_response.license_key.status == "granted" {
        Ok(true)
    } else {
        Err(format!("License activation was rejected. Status: {}. Please verify your license key is valid and not expired.", activation_response.license_key.status))
    }
}

#[cfg(not(target_os = "macos"))]
pub async fn validate_license_key(license_key: &str) -> Result<bool, String> {
    use license_impl::*;
    
    if !is_valid_license_key_prefix(license_key) {
        #[cfg(target_os = "windows")]
        {
            return Err("This license key is not valid for Windows. Please ensure you have a Windows license key that starts with 'LEEDWIN'.".to_string());
        }
        #[cfg(not(target_os = "windows"))]
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

    if response.status().is_client_error() {
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
        return Err("License server is temporarily unavailable. Please try again later.".to_string());
    }

    let validation_response: LicenseValidationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse server response: {}", e))?;

    if validation_response.status == "granted" {
        Ok(true)
    } else {
        Err(format!("License validation was rejected. Status: {}. Your license may be expired or invalid.", validation_response.status))
    }
}

#[cfg(not(target_os = "macos"))]
fn get_license_file_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir.join("license.json"))
}

#[cfg(not(target_os = "macos"))]
pub fn get_stored_license(app_handle: &AppHandle) -> Result<Option<license_impl::StoredLicense>, String> {
    use license_impl::*;
    
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

#[cfg(not(target_os = "macos"))]
pub fn store_activated_license(app_handle: &AppHandle, license_key: &str) -> Result<(), String> {
    use license_impl::*;
    
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

#[cfg(not(target_os = "macos"))]
pub fn store_license(app_handle: &AppHandle, license_key: &str) -> Result<(), String> {
    use license_impl::*;
    
    let existing_license = get_stored_license(app_handle)?;
    
    match existing_license {
        Some(license) => {
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
            store_activated_license(app_handle, license_key)
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn remove_stored_license(app_handle: &AppHandle) -> Result<(), String> {
    
    let license_file = get_license_file_path(app_handle)?;
    
    if license_file.exists() {
        std::fs::remove_file(&license_file)
            .map_err(|e| format!("Failed to remove license file: {}", e))?;
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub async fn check_license_smart(app_handle: &AppHandle) -> Result<bool, String> {
    use license_impl::*;
    
    let stored_license = match get_stored_license(app_handle)? {
        Some(license) => license,
        None => return Err("No license key found".to_string()),
    };
    
    let current_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    
    let time_since_validation = current_time - stored_license.validated_at;
    
    if time_since_validation < OFFLINE_GRACE_PERIOD {
        return Ok(true);
    }
    
    match validate_license_key(&stored_license.key).await {
        Ok(true) => {
            store_license(app_handle, &stored_license.key)?;
            Ok(true)
        },
        Ok(false) => {
            remove_stored_license(app_handle)?;
            Err("License key is no longer valid".to_string())
        },
        Err(_network_error) => {
            if time_since_validation < (OFFLINE_GRACE_PERIOD * 2) {
                Ok(true)
            } else {
                Err("License validation required - please connect to internet".to_string())
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn get_license_requirement_info() -> serde_json::Value {
    serde_json::json!({
        "requires_license": true,
        "platform": std::env::consts::OS,
        "reason": "License key validation required for this platform"
    })
}
