use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize)]
struct LicenseValidationRequest {
    key: String,
    organization_id: String,
}

#[derive(Debug, Deserialize)]
struct LicenseValidationResponse {
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoredLicense {
    pub key: String,
    pub validated_at: u64,
}

const POLAR_VALIDATION_URL: &str = "https://api.polar.sh/v1/customer-portal/license-keys/validate";
const ORGANIZATION_ID: &str = "2ec4183f-eaad-4089-b9dc-9008f3748460";

// Offline grace period: 7 days (in seconds)
const OFFLINE_GRACE_PERIOD: u64 = 7 * 24 * 60 * 60;

pub async fn validate_license_key(license_key: &str) -> Result<bool, String> {
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

    if !response.status().is_success() {
        return Err(format!("API returned status: {}", response.status()));
    }

    let validation_response: LicenseValidationResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Check if status is "granted" for valid license
    if validation_response.status == "granted" {
        Ok(true)
    } else {
        Err(format!("License key is not valid. Status: {}", validation_response.status))
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

pub fn store_license(app_handle: &AppHandle, license_key: &str) -> Result<(), String> {
    let license_file = get_license_file_path(app_handle)?;
    
    let stored_license = StoredLicense {
        key: license_key.to_string(),
        validated_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };

    let content = serde_json::to_string_pretty(&stored_license)
        .map_err(|e| format!("Failed to serialize license: {}", e))?;

    std::fs::write(&license_file, content)
        .map_err(|e| format!("Failed to write license file: {}", e))?;

    Ok(())
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
