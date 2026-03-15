use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

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
            download_url: Some(update.download_url.to_string()),
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
