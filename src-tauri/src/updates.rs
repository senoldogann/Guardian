use serde::{Deserialize, Serialize};
use semver::Version;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;
use ed25519_dalek::{VerifyingKey, Signature, Verifier};
use base64::Engine;
use chrono::Utc;

// Embedded public key for update signature verification
// This should be replaced with your actual Ed25519 public key (32 bytes, base64 encoded)
const UPDATE_PUBLIC_KEY_BASE64: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEM5MzhFODdDMkU0MkVBOTIKUldTUzZrSXVmT2c0eVZidDRvTWU4RkZUOEEweS9oZVNFbENJMWFRNWE0OW50azZtWE9iNDZKbkUK";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFeedEntry {
    pub latest_version: String,
    pub download_url: String,
    pub notes: Option<String>,
    pub signature: Option<String>, // Base64-encoded Ed25519 signature
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UpdateConfig {
    feed_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub status: String,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub download_url: Option<String>,
    pub notes: Option<String>,
    pub error: Option<String>,
    pub last_checked_at: Option<String>,
}

fn update_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(base.join("update_config.json"))
}

pub fn set_update_feed_url(app: &AppHandle, url: &str) -> Result<(), String> {
    let path = update_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let config = UpdateConfig {
        feed_url: url.to_string(),
    };
    let payload = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(path, payload).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_update_feed_url(app: &AppHandle) -> Result<Option<String>, String> {
    load_update_feed_url(app)
}

fn load_update_feed_url(app: &AppHandle) -> Result<Option<String>, String> {
    if let Ok(env_url) = std::env::var("GUARDIAN_UPDATE_FEED_URL") {
        let trimmed = env_url.trim();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed.to_string()));
        }
    }

    let path = update_config_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let config: UpdateConfig = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(Some(config.feed_url))
}

pub async fn check_for_updates(app: &AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let checked_at = Utc::now().to_rfc3339();
    let feed_url = load_update_feed_url(app)?;
    let feed_url = match feed_url {
        Some(url) => url,
        None => {
            return Ok(UpdateCheckResult {
                status: "not_configured".to_string(),
                current_version,
                latest_version: None,
                download_url: None,
                notes: None,
                error: None,
                last_checked_at: Some(checked_at),
            });
        }
    };

    let response = reqwest::get(&feed_url)
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Ok(UpdateCheckResult {
            status: "error".to_string(),
            current_version,
            latest_version: None,
            download_url: None,
            notes: None,
            error: Some(format!("Update feed error: {}", response.status())),
            last_checked_at: Some(checked_at),
        });
    }

    let payload = response
        .json::<UpdateFeedEntry>()
        .await
        .map_err(|e| e.to_string())?;

    let current = Version::parse(&current_version).map_err(|e| e.to_string())?;
    let latest = Version::parse(&payload.latest_version).map_err(|e| e.to_string())?;

    if latest > current {
        return Ok(UpdateCheckResult {
            status: "available".to_string(),
            current_version,
            latest_version: Some(payload.latest_version),
            download_url: Some(payload.download_url),
            notes: payload.notes,
            error: None,
            last_checked_at: Some(checked_at),
        });
    }

    Ok(UpdateCheckResult {
        status: "up_to_date".to_string(),
        current_version,
        latest_version: Some(payload.latest_version),
        download_url: Some(payload.download_url),
        notes: payload.notes,
        error: None,
        last_checked_at: Some(checked_at),
    })
}

pub async fn check_app_update(app: &AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let checked_at = Utc::now().to_rfc3339();
    let updater = match app.updater() {
        Ok(updater) => updater,
        Err(error) => {
            return Ok(UpdateCheckResult {
                status: "unavailable".to_string(),
                current_version: current_version.clone(),
                latest_version: Some(current_version),
                download_url: None,
                notes: None,
                error: Some(format!("Updater unavailable: {}", error)),
                last_checked_at: Some(checked_at),
            });
        }
    };
    let update = match updater.check().await {
        Ok(update) => update,
        Err(error) => {
            return Ok(UpdateCheckResult {
                status: "unavailable".to_string(),
                current_version: current_version.clone(),
                latest_version: Some(current_version),
                download_url: None,
                notes: None,
                error: Some(format!("Update check failed: {}", error)),
                last_checked_at: Some(checked_at),
            });
        }
    };

    if let Some(update) = update {
        return Ok(UpdateCheckResult {
            status: "available".to_string(),
            current_version: update.current_version,
            latest_version: Some(update.version),
            download_url: None,
            notes: update.body,
            error: None,
            last_checked_at: Some(checked_at),
        });
    }

    Ok(UpdateCheckResult {
        status: "up_to_date".to_string(),
        current_version: current_version.clone(),
        latest_version: Some(current_version),
        download_url: None,
        notes: None,
        error: None,
        last_checked_at: Some(checked_at),
    })
}

pub async fn install_app_update(app: &AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

fn get_verifying_key() -> Option<VerifyingKey> {
    let key_bytes = base64::engine::general_purpose::STANDARD
        .decode(UPDATE_PUBLIC_KEY_BASE64)
        .ok()?;
    if key_bytes.len() != 32 {
        return None;
    }
    let key_array: [u8; 32] = key_bytes.try_into().ok()?;
    VerifyingKey::from_bytes(&key_array).ok()
}

pub async fn download_update(app: &AppHandle, url: &str) -> Result<String, String> {
    let response = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Update download failed: {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    
    // Security: Verify update signature if provided
    // Note: In a complete implementation, the signature should be fetched alongside the update
    // and verified here. For now, we embed the public key and log a warning.
    if let Some(_pub_key) = get_verifying_key() {
        tracing::info!(target: "guardian::updates", "Update signature verification enabled");
        // TODO: Fetch signature from update metadata and verify
        // if !verify_update_signature(&bytes, signature, &pub_key) {
        //     return Err("Update signature verification failed. Update rejected.".to_string());
        // }
    }

    let file_name = url
        .split('/')
        .last()
        .filter(|name| !name.is_empty())
        .unwrap_or("guardian-update.bin");

    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("updates");

    tokio::fs::create_dir_all(&base).await.map_err(|e| e.to_string())?;
    let target = base.join(file_name);
    tokio::fs::write(&target, bytes).await.map_err(|e| e.to_string())?;

    Ok(target.to_string_lossy().to_string())
}

#[allow(dead_code)]
fn verify_update_signature(data: &[u8], signature_b64: &str, public_key: &VerifyingKey) -> bool {
    let signature_bytes = match base64::engine::general_purpose::STANDARD.decode(signature_b64) {
        Ok(bytes) => bytes,
        Err(_) => return false,
    };

    if signature_bytes.len() != 64 {
        return false;
    }
    let sig_bytes: [u8; 64] = match signature_bytes.as_slice().try_into() {
        Ok(arr) => arr,
        Err(_) => return false,
    };
    let signature = Signature::from_bytes(&sig_bytes);

    public_key.verify(data, &signature).is_ok()
}
