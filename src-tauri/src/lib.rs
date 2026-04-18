mod ai_client;
mod guardian_lock;
mod watcher;
// V2 Modules
mod agent_protocol;
mod auth;
mod baseline;
mod ci;
mod config;
mod context;
mod executor;
mod history_logger;
mod kernel;
mod patcher;
mod prompt_loader;
mod provider;
mod rag_lite;
mod redaction;
mod release_decision;
mod semantic_index;
mod skills;
mod storage;
#[cfg(test)]
mod tests_watcher;
mod triage;
mod undo;
mod updates;
mod user_preferences;
mod validation;
mod workspace_manager;

use anyhow::{Context, Result as AnyhowResult};
use guardian_scan_policy::{ReleaseDecision, ScanProfile};
use keyring::{Entry, Error as KeyringError};
use once_cell::sync::Lazy;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock as StdRwLock};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::RwLock;
use tracing::{error, info, warn};

struct WatcherSupervisor {
    shutdown: Arc<AtomicBool>,
    handle: RwLock<Option<tauri::async_runtime::JoinHandle<()>>>,
}

const SESSION_MAX_HOURS: i64 = 4;
const TOKEN_ROTATION_HOURS: i64 = 24;

struct AuthSessionState {
    user: auth::github::GithubUser,
    verified_at: chrono::DateTime<chrono::Utc>,
}

struct AuthState {
    session: RwLock<Option<AuthSessionState>>,
}

impl AuthState {
    fn new() -> Self {
        Self {
            session: RwLock::new(None),
        }
    }

    async fn set_session(&self, user: auth::github::GithubUser) {
        self.set_session_at(user, chrono::Utc::now()).await;
    }

    async fn set_session_at(
        &self,
        user: auth::github::GithubUser,
        verified_at: chrono::DateTime<chrono::Utc>,
    ) {
        let mut guard = self.session.write().await;
        *guard = Some(AuthSessionState { user, verified_at });
    }

    async fn clear(&self) {
        let mut guard = self.session.write().await;
        *guard = None;
    }

    async fn get_user(&self) -> Option<auth::github::GithubUser> {
        // Fast path: read lock only (allows concurrent readers)
        {
            let guard = self.session.read().await;
            if let Some(session) = guard.as_ref() {
                let age_hours = chrono::Utc::now()
                    .signed_duration_since(session.verified_at)
                    .num_hours();
                if age_hours <= SESSION_MAX_HOURS {
                    return Some(session.user.clone());
                }
            } else {
                return None;
            }
        }
        // Slow path: session expired — acquire write lock to clear it
        let mut guard = self.session.write().await;
        // Re-check under write lock (another task may have already cleared/refreshed)
        if let Some(session) = guard.as_ref() {
            let age_hours = chrono::Utc::now()
                .signed_duration_since(session.verified_at)
                .num_hours();
            if age_hours <= SESSION_MAX_HOURS {
                return Some(session.user.clone());
            }
        }
        *guard = None;
        None
    }
}

#[derive(Serialize)]
struct AuthSessionView {
    user: auth::github::GithubUser,
    verified: bool,
    warning: Option<String>,
}

#[derive(Serialize)]
struct AuthLoginResult {
    user: auth::github::GithubUser,
    warning: Option<String>,
}

#[derive(Serialize)]
struct ApiKeyStatus {
    has_key: bool,
    source: String,
    warning: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
struct EmbeddingRuntimeConfig {
    mode: String,
    openai_base_url: Option<String>,
    ollama_base_url: Option<String>,
    openai_model: Option<String>,
    ollama_model: Option<String>,
}

/// Thread-safe in-process embedding config store.
/// Replaces unsafe `std::env::set_var` calls in async context.
#[derive(Default, Clone)]
struct EmbeddingRuntimeConfigStore {
    mode: Option<String>,
    provider: Option<String>,
    openai_base_url: Option<String>,
    ollama_base_url: Option<String>,
    openai_model: Option<String>,
    ollama_model: Option<String>,
}

static EMBEDDING_RUNTIME_STORE: Lazy<StdRwLock<EmbeddingRuntimeConfigStore>> =
    Lazy::new(|| StdRwLock::new(EmbeddingRuntimeConfigStore::default()));

#[derive(Serialize, Deserialize, Clone)]
struct ScanProfileConfig {
    profile: String,
}

fn scan_profile_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("scan_profile.json"))
}

fn normalize_scan_profile(value: &str) -> Result<ScanProfile, String> {
    value.parse::<ScanProfile>().map_err(|e| e.to_string())
}

fn load_scan_profile_config(app: &AppHandle) -> Result<ScanProfileConfig, String> {
    let path = scan_profile_path(app)?;
    if !path.exists() {
        return Ok(ScanProfileConfig {
            profile: ScanProfile::Source.as_str().to_string(),
        });
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let parsed: ScanProfileConfig = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    let profile = normalize_scan_profile(&parsed.profile)?
        .as_str()
        .to_string();
    Ok(ScanProfileConfig { profile })
}

fn save_scan_profile_config(
    app: &AppHandle,
    cfg: &ScanProfileConfig,
) -> Result<ScanProfileConfig, String> {
    let profile = normalize_scan_profile(&cfg.profile)?.as_str().to_string();
    let normalized = ScanProfileConfig { profile };
    let path = scan_profile_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let payload = serde_json::to_string(&normalized).map_err(|e| e.to_string())?;
    fs::write(&path, payload).map_err(|e| e.to_string())?;
    Ok(normalized)
}

#[tauri::command]
async fn get_scan_profile_config(app: AppHandle) -> Result<ScanProfileConfig, String> {
    load_scan_profile_config(&app)
}

#[tauri::command]
async fn set_scan_profile_config(
    app: AppHandle,
    config: ScanProfileConfig,
) -> Result<ScanProfileConfig, String> {
    save_scan_profile_config(&app, &config)
}

#[derive(Serialize, Deserialize)]
struct StoredAuthUser {
    user: auth::github::GithubUser,
    #[serde(default)]
    token_hash: Option<String>,
    #[serde(default)]
    verified_at: Option<String>,
    #[serde(default)]
    issued_at: Option<String>,
}

fn auth_user_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("github_user.json"))
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new("guardian", "github_access_token").map_err(|e| e.to_string())
}

fn store_access_token(token: &str) -> Result<(), String> {
    let entry = keyring_entry()?;
    entry.set_password(token).map_err(|e| e.to_string())
}

fn load_access_token() -> Result<Option<String>, String> {
    let entry = keyring_entry()?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

fn clear_access_token() -> Result<(), String> {
    let entry = keyring_entry()?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn token_hash(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

fn persist_auth_user(
    app: &AppHandle,
    user: &auth::github::GithubUser,
    token: &str,
) -> Result<(), String> {
    let path = auth_user_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let now = chrono::Utc::now();
    let new_hash = token_hash(token);
    let previous = load_cached_user(app).ok().flatten();
    let issued_at = previous
        .as_ref()
        .filter(|p| p.token_hash.as_deref() == Some(new_hash.as_str()))
        .and_then(|p| p.issued_at.clone().or(p.verified_at.clone()))
        .unwrap_or_else(|| now.to_rfc3339());
    let stored = StoredAuthUser {
        user: user.clone(),
        token_hash: Some(new_hash),
        verified_at: Some(now.to_rfc3339()),
        issued_at: Some(issued_at),
    };
    let payload = serde_json::to_string(&stored).map_err(|e| e.to_string())?;
    fs::write(path, payload).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_cached_user(app: &AppHandle) -> Result<Option<StoredAuthUser>, String> {
    let path = auth_user_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let stored: StoredAuthUser = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(Some(stored))
}

fn clear_auth_session(app: &AppHandle) -> Result<(), String> {
    let path = auth_user_path(app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    clear_access_token()
}

impl WatcherSupervisor {
    fn new() -> Self {
        Self {
            shutdown: Arc::new(AtomicBool::new(false)),
            handle: RwLock::new(None),
        }
    }

    async fn start(&self, app: AppHandle, config: watcher::WatcherRuntimeConfig) {
        self.stop().await;
        self.shutdown.store(false, Ordering::Relaxed);

        let shutdown = self.shutdown.clone();
        let handle = tauri::async_runtime::spawn(async move {
            watcher::start_watching(app, config, shutdown).await;
        });

        let mut guard = self.handle.write().await;
        *guard = Some(handle);
    }

    async fn stop(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
        let mut guard = self.handle.write().await;
        if let Some(handle) = guard.take() {
            handle.abort();
        }
    }
}

#[tauri::command]
async fn start_monitoring(
    app: AppHandle,
    path: String,
    auto_verify_enabled: Option<bool>,
    language: Option<String>,
    watcher: tauri::State<'_, WatcherSupervisor>,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<(), String> {
    let path_buf = std::path::Path::new(&path);
    if !path_buf.exists() {
        return Err("Workspace path does not exist.".to_string());
    }
    if !path_buf.is_dir() {
        return Err("Workspace path is not a directory.".to_string());
    }
    if auth_state.get_user().await.is_none() {
        let refreshed = refresh_auth_session(app.clone(), auth_state).await?;
        if refreshed.is_none() {
            return Err("GitHub login is required before starting monitoring.".to_string());
        }
    }

    info!(target: "guardian", "Starting monitoring on: {}", path);
    let provider = provider::resolve_provider_config(&app).map_err(|e| e.to_string())?;
    let api_key =
        config::api_key_for_provider_or_empty(&provider.provider_id).map_err(|e| e.to_string())?;
    let scan_profile_cfg = load_scan_profile_config(&app)?;
    let scan_profile = normalize_scan_profile(&scan_profile_cfg.profile)?;
    let user_preferences =
        user_preferences::load_user_preferences(&app).unwrap_or_else(|err| {
            warn!(
                target: "guardian::settings",
                "Falling back to default user preferences for monitoring start: {}",
                err
            );
            user_preferences::UserPreferencesV1::default()
        });
    let effective_auto_verify =
        auto_verify_enabled.unwrap_or(user_preferences.auto_verify_enabled);
    let effective_language = language
        .unwrap_or_else(|| user_preferences.language.clone())
        .trim()
        .to_lowercase();

    watcher
        .start(
            app,
            watcher::WatcherRuntimeConfig {
                target_path: path,
                api_key,
                model: provider.model,
                host: provider.base_url,
                provider_id: provider.provider_id,
                auto_verify_enabled: effective_auto_verify,
                scan_profile,
                language: effective_language,
                scan_tuning: user_preferences.scan_tuning,
                model_custom_instructions: user_preferences.model_custom_instructions,
            },
        )
        .await;

    Ok(())
}

#[tauri::command]
async fn stop_monitoring(watcher: tauri::State<'_, WatcherSupervisor>) -> Result<(), String> {
    watcher.stop().await;
    Ok(())
}

// --- Multi-workspace commands ---

#[tauri::command]
async fn add_monitored_workspace(
    app: AppHandle,
    path: String,
    auto_verify_enabled: Option<bool>,
    language: Option<String>,
    ws_manager: tauri::State<'_, workspace_manager::WorkspaceManager>,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<String, String> {
    let path_buf = std::path::Path::new(&path);
    if !path_buf.exists() {
        return Err("Workspace path does not exist.".to_string());
    }
    if !path_buf.is_dir() {
        return Err("Workspace path is not a directory.".to_string());
    }
    if auth_state.get_user().await.is_none() {
        let refreshed = refresh_auth_session(app.clone(), auth_state).await?;
        if refreshed.is_none() {
            return Err("GitHub login is required before starting monitoring.".to_string());
        }
    }

    let provider = provider::resolve_provider_config(&app).map_err(|e| e.to_string())?;
    let api_key =
        config::api_key_for_provider_or_empty(&provider.provider_id).map_err(|e| e.to_string())?;
    let scan_profile_cfg = load_scan_profile_config(&app)?;
    let scan_profile = normalize_scan_profile(&scan_profile_cfg.profile)?;
    let user_preferences =
        user_preferences::load_user_preferences(&app).unwrap_or_else(|err| {
            warn!(
                target: "guardian::settings",
                "Falling back to default user preferences for workspace add: {}",
                err
            );
            user_preferences::UserPreferencesV1::default()
        });
    let effective_auto_verify =
        auto_verify_enabled.unwrap_or(user_preferences.auto_verify_enabled);
    let effective_language = language
        .unwrap_or_else(|| user_preferences.language.clone())
        .trim()
        .to_lowercase();

    let id = ws_manager
        .add_workspace(
            app,
            watcher::WatcherRuntimeConfig {
                target_path: path,
                api_key,
                model: provider.model,
                host: provider.base_url,
                provider_id: provider.provider_id,
                auto_verify_enabled: effective_auto_verify,
                scan_profile,
                language: effective_language,
                scan_tuning: user_preferences.scan_tuning,
                model_custom_instructions: user_preferences.model_custom_instructions,
            },
        )
        .await;

    Ok(id)
}

#[tauri::command]
async fn remove_monitored_workspace(
    workspace_id: String,
    ws_manager: tauri::State<'_, workspace_manager::WorkspaceManager>,
) -> Result<bool, String> {
    Ok(ws_manager.remove_workspace(&workspace_id).await)
}

#[tauri::command]
async fn list_monitored_workspaces(
    ws_manager: tauri::State<'_, workspace_manager::WorkspaceManager>,
) -> Result<Vec<workspace_manager::WorkspaceInfo>, String> {
    Ok(ws_manager.list_workspaces().await)
}

#[tauri::command]
async fn get_workspace_status(
    workspace_id: String,
    ws_manager: tauri::State<'_, workspace_manager::WorkspaceManager>,
) -> Result<Option<workspace_manager::WorkspaceInfo>, String> {
    Ok(ws_manager.get_workspace_status(&workspace_id).await)
}

#[tauri::command]
async fn get_baseline(root: String) -> Result<Option<baseline::Baseline>, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    let manager = baseline::BaselineManager::new(root_path.to_path_buf());
    manager.load().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_baseline(root: String) -> Result<baseline::BaselineStatusView, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }

    let manager = baseline::BaselineManager::new(root_path.to_path_buf());
    let critiques = watcher::active_critiques_for_root(&root);
    let baseline = manager
        .create_baseline(&critiques)
        .map_err(|e| e.to_string())?;
    history_logger::append_history_event(
        &root,
        history_logger::HistoryEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            event: "baseline_created".to_string(),
            finding_id: None,
            file_path: None,
            model: None,
            provider: None,
            redacted: None,
            tokens_in: None,
            tokens_out: None,
            details: Some(serde_json::json!({
                "schema_version": baseline.schema_version,
                "finding_ids": baseline.finding_ids.len(),
                "rules_hash": baseline.rules_hash.clone(),
            })),
        },
    );
    manager
        .status(&baseline, &critiques)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_baseline(root: String) -> Result<(), String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    let manager = baseline::BaselineManager::new(root_path.to_path_buf());
    manager.delete().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_baseline_status(root: String) -> Result<Option<baseline::BaselineStatusView>, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }

    let manager = baseline::BaselineManager::new(root_path.to_path_buf());
    let Some(baseline) = manager.load().map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let critiques = watcher::active_critiques_for_root(&root);
    let status = manager
        .status(&baseline, &critiques)
        .map_err(|e| e.to_string())?;
    Ok(Some(status))
}

#[tauri::command]
async fn get_monitor_critiques(root: String) -> Result<Vec<ai_client::Critique>, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }

    let active = watcher::active_critiques_for_root(&root);
    if !active.is_empty() {
        return Ok(active);
    }
    Ok(watcher::critiques_from_snapshot_for_root(&root))
}

#[tauri::command]
async fn get_guardian_lock_status(
    root: String,
) -> Result<guardian_lock::GuardianLockStatus, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    guardian_lock::status(root_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ensure_guardian_lock(root: String) -> Result<guardian_lock::GuardianLockStatus, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    guardian_lock::sync_guardian_lock(root_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_last_ai_context(root: String) -> Result<Option<watcher::AiContextSnapshot>, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }

    Ok(watcher::last_ai_context_for_root(&root))
}

#[tauri::command]
async fn get_fix_proposals(root: String) -> Result<watcher::FixProposalsSnapshot, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }

    Ok(watcher::refresh_fix_proposals_for_root(&root))
}

#[tauri::command]
async fn set_fix_proposal_status(
    root: String,
    proposal_id: String,
    status: String,
    note: Option<String>,
) -> Result<watcher::FixProposalsSnapshot, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }

    let path = watcher::fix_proposals_path_for_root(&root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "type": "status",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "proposal_id": proposal_id,
        "status": status,
        "note": note,
        "actor": "user",
    });
    let encoded = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
    use std::io::Write;
    writeln!(file, "{}", encoded).map_err(|e| e.to_string())?;

    Ok(watcher::refresh_fix_proposals_for_root(&root))
}

#[tauri::command]
async fn get_release_decision(
    root: String,
) -> Result<release_decision::ReleaseDecisionView, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    release_decision::get_release_decision(&root).map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_release_decision(
    root: String,
    decision: String,
    approver: String,
    reason: Option<String>,
) -> Result<release_decision::ReleaseDecisionView, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    let parsed = decision
        .parse::<ReleaseDecision>()
        .map_err(|e| format!("Invalid release decision: {}", e))?;
    release_decision::set_release_decision(&root, parsed, approver, reason)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn override_release_block(
    root: String,
    approver: String,
    reason: String,
) -> Result<release_decision::ReleaseDecisionView, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    release_decision::override_release_block(&root, approver, reason).map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_github_login() -> Result<auth::github::DeviceCodeResponse, String> {
    let client_id = config::github_client_id().map_err(|e| e.to_string())?;
    auth::github::request_device_code(&client_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn complete_github_login(
    app: AppHandle,
    device_code: String,
    max_wait_seconds: Option<u64>,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<AuthLoginResult, String> {
    let client_id = config::github_client_id().map_err(|e| e.to_string())?;
    let client_secret = config::github_client_secret();
    let session = auth::github::complete_device_flow(
        &client_id,
        client_secret
            .map(|s| s.expose_secret().to_string())
            .as_deref(),
        &device_code,
        max_wait_seconds,
    )
    .await
    .map_err(|e| e.to_string())?;

    let user = session.user.clone();
    auth_state.set_session(user.clone()).await;
    let mut warning: Option<String> = None;
    if let Err(err) = store_access_token(&session.access_token) {
        warning = Some(format!("Keychain error: {}", err));
    }
    if let Err(err) = persist_auth_user(&app, &session.user, &session.access_token) {
        let extra = format!("Session cache error: {}", err);
        warning = match warning {
            Some(mut msg) => {
                msg.push_str(" | ");
                msg.push_str(&extra);
                Some(msg)
            }
            None => Some(extra),
        };
    }
    Ok(AuthLoginResult { user, warning })
}

#[tauri::command]
async fn logout_github(
    app: AppHandle,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<(), String> {
    auth_state.clear().await;
    if let Err(err) = clear_auth_session(&app) {
        warn!(target: "guardian::auth", "Failed to clear GitHub session: {}", err);
    }
    Ok(())
}

/// Shared helper: checks cached token age, verifies with GitHub, and handles
/// all verify outcomes (success, unauthorized, offline, other).
async fn verify_and_store_session(
    app: &AppHandle,
    auth_state: &AuthState,
    token: &str,
) -> Result<Option<AuthSessionView>, String> {
    const OFFLINE_MAX_HOURS: i64 = 72;

    if let Ok(Some(cached)) = load_cached_user(app) {
        if cached.token_hash.as_deref() == Some(token_hash(token).as_str()) {
            if let Some(issued_at) = cached.issued_at.as_ref().or(cached.verified_at.as_ref()) {
                if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(issued_at) {
                    let age_hours = chrono::Utc::now()
                        .signed_duration_since(parsed.with_timezone(&chrono::Utc))
                        .num_hours();
                    if age_hours > TOKEN_ROTATION_HOURS {
                        let _ = clear_auth_session(app);
                        return Ok(None);
                    }
                }
            }
        }
    }

    match auth::github::verify_access_token(token).await {
        Ok(user) => {
            auth_state.set_session(user.clone()).await;
            let _ = persist_auth_user(app, &user, token);
            Ok(Some(AuthSessionView {
                user,
                verified: true,
                warning: None,
            }))
        }
        Err(auth::github::VerifyError::Unauthorized) => {
            let _ = clear_auth_session(app);
            Ok(None)
        }
        Err(auth::github::VerifyError::Offline(detail)) => {
            if let Ok(Some(cached)) = load_cached_user(app) {
                let current_hash = token_hash(token);
                let cached_hash = cached.token_hash.unwrap_or_default();
                if cached_hash != current_hash {
                    return Ok(None);
                }

                let verified_at = cached.verified_at.clone().unwrap_or_default();
                let verified_at = chrono::DateTime::parse_from_rfc3339(&verified_at)
                    .map_err(|_| {
                        "Offline cache expired. Connect to the internet to re-verify.".to_string()
                    })?
                    .with_timezone(&chrono::Utc);
                let age_hours = chrono::Utc::now()
                    .signed_duration_since(verified_at)
                    .num_hours();
                if age_hours > OFFLINE_MAX_HOURS {
                    let _ = clear_auth_session(app);
                    return Err(
                        "Offline verification expired. Connect to the internet to re-verify."
                            .to_string(),
                    );
                }

                auth_state.set_session(cached.user.clone()).await;
                return Ok(Some(AuthSessionView {
                    user: cached.user,
                    verified: false,
                    warning: Some(format!(
                        "Offline verification (last verified {}h ago). {}",
                        age_hours, detail
                    )),
                }));
            }
            Ok(None)
        }
        Err(auth::github::VerifyError::Other(detail)) => {
            Err(format!("GitHub verification failed: {}", detail))
        }
    }
}

#[tauri::command]
async fn get_auth_session(
    app: AppHandle,
    auth_state: tauri::State<'_, AuthState>,
    cached_only: Option<bool>,
) -> Result<Option<AuthSessionView>, String> {
    let cached_only = cached_only.unwrap_or(false);
    if auth_state.get_user().await.is_none() {
        if let Ok(Some(cached)) = load_cached_user(&app) {
            let mut allow_cached = false;
            if let Some(issued_at) = cached.issued_at.as_ref().or(cached.verified_at.as_ref()) {
                if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(issued_at) {
                    let age_hours = chrono::Utc::now()
                        .signed_duration_since(parsed.with_timezone(&chrono::Utc))
                        .num_hours();
                    if age_hours <= TOKEN_ROTATION_HOURS {
                        allow_cached = true;
                    } else {
                        let _ = clear_auth_session(&app);
                    }
                }
            }

            if allow_cached {
                return Ok(Some(AuthSessionView {
                    user: cached.user,
                    verified: false,
                    warning: if cached_only {
                        None
                    } else {
                        Some("Cached session. Verify online to refresh GitHub access.".to_string())
                    },
                }));
            }
        }
        if cached_only {
            return Ok(None);
        }
        let token = load_access_token()?;
        if let Some(token) = token {
            return verify_and_store_session(&app, &auth_state, &token).await;
        }
    }

    Ok(auth_state.get_user().await.map(|user| AuthSessionView {
        user,
        verified: true,
        warning: None,
    }))
}

#[tauri::command]
async fn refresh_auth_session(
    app: AppHandle,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<Option<AuthSessionView>, String> {
    let token = load_access_token()?;
    if let Some(token) = token {
        return verify_and_store_session(&app, &auth_state, &token).await;
    }

    Ok(None)
}

#[tauri::command]
async fn apply_fix(
    state_bus: tauri::State<'_, Arc<kernel::bus::EventBus>>,
    file_path: String,
    new_content: String,
) -> Result<String, String> {
    info!(target: "guardian::autopilot", "Fix requested for: {}", file_path);

    // Publish RequestReview event to the Kernel
    state_bus
        .publish(kernel::bus::GuardianEvent::RequestReview {
            file_path: file_path.clone(),
            diff: new_content,
        })
        .await;

    Ok("Governance Review Initiated...".to_string())
}

#[derive(Debug, Clone, Serialize)]
struct ApplyFixNowResult {
    message: String,
    undo_available: bool,
}

#[tauri::command]
async fn apply_fix_now(
    file_path: String,
    new_content: String,
    root: String,
) -> Result<ApplyFixNowResult, String> {
    info!(target: "guardian::autopilot", "Applying fix now: {}", file_path);

    undo::apply_fix_now(&root, &file_path, &new_content).map_err(|e| e.to_string())?;

    let rel_path = std::path::Path::new(&file_path)
        .strip_prefix(std::path::Path::new(&root))
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_path.clone());

    history_logger::append_history_event(
        &root,
        history_logger::HistoryEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            event: "fix_applied".to_string(),
            finding_id: None,
            file_path: Some(rel_path),
            model: None,
            provider: None,
            redacted: None,
            tokens_in: None,
            tokens_out: None,
            details: Some(serde_json::json!({
                "bytes": new_content.len(),
                "undo": true,
            })),
        },
    );

    Ok(ApplyFixNowResult {
        message: "Patch applied successfully.".to_string(),
        undo_available: true,
    })
}

#[tauri::command]
async fn undo_fix(file_path: String, root: String) -> Result<String, String> {
    info!(target: "guardian::autopilot", "Undoing fix for: {}", file_path);
    undo::undo_fix(&root, &file_path).map_err(|e| e.to_string())?;

    let rel_path = std::path::Path::new(&file_path)
        .strip_prefix(std::path::Path::new(&root))
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_path.clone());

    history_logger::append_history_event(
        &root,
        history_logger::HistoryEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            event: "fix_undone".to_string(),
            finding_id: None,
            file_path: Some(rel_path),
            model: None,
            provider: None,
            redacted: None,
            tokens_in: None,
            tokens_out: None,
            details: None,
        },
    );

    Ok("Undo complete.".to_string())
}

#[tauri::command]
async fn get_fix_history(root: String) -> Result<Vec<undo::FixHistoryEntry>, String> {
    let root_path = std::path::Path::new(&root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    undo::list_fix_history(&root).map_err(|e| e.to_string())
}

#[tauri::command]
async fn confirm_fix(
    file_path: String,
    new_content: String,
    root: String,
) -> Result<String, String> {
    info!(target: "guardian::autopilot", "Fix confirmed, applying to: {}", file_path);
    let res = patcher::apply_patch(&file_path, &new_content, &root).map_err(|e| e.to_string())?;

    let rel_path = std::path::Path::new(&file_path)
        .strip_prefix(std::path::Path::new(&root))
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| file_path.clone());

    history_logger::append_history_event(
        &root,
        history_logger::HistoryEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            event: "fix_applied".to_string(),
            finding_id: None,
            file_path: Some(rel_path),
            model: None,
            provider: None,
            redacted: None,
            tokens_in: None,
            tokens_out: None,
            details: Some(serde_json::json!({
                "bytes": new_content.len(),
            })),
        },
    );

    Ok(res)
}

#[tauri::command]
async fn ask_guru(
    app: AppHandle,
    path: String,
    query: String,
    web_search: Option<bool>,
    web_search_depth: Option<String>,
    language: Option<String>,
    storage: tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) -> Result<String, String> {
    let root_path = std::path::Path::new(&path);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(format!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            path
        ));
    }
    // 1. Get Context via RagLite
    let scan_profile = load_scan_profile_config(&app)
        .ok()
        .and_then(|cfg| normalize_scan_profile(&cfg.profile).ok())
        .unwrap_or(ScanProfile::Source);

    let (clean_query, force_web) = normalize_web_query(&query);
    let mut guru_context = String::new();
    let intent_pack = context::cached_intent_pack(&path, scan_profile);
    if !intent_pack.trim().is_empty() {
        guru_context.push_str(&intent_pack);
        guru_context.push_str("\n\n---\n\n");
    }

    guru_context.push_str(&rag_lite::search_context(&path, &clean_query));
    append_issue_file_context(&mut guru_context, &path, &storage);
    if semantic_index::should_use_semantic_search(&clean_query) {
        match semantic_index::search_similar_for_query(
            storage.inner().clone(),
            &path,
            &clean_query,
            5,
        )
        .await
        {
            Ok(matches) if !matches.is_empty() => {
                guru_context.push_str("\n\n");
                guru_context.push_str(&semantic_index::render_semantic_matches(&matches));
            }
            Ok(_) => {}
            Err(err) => {
                warn!(
                    target: "guardian::semantic",
                    "Semantic search context skipped: {}",
                    err
                );
            }
        }
    }

    // 1.5 Optional Web Search (Tavily)
    // 1.5 Optional Web Search (Tavily)
    // If frontend explicitly requests web_search (via toggle) OR uses a slash command (/web), we force search.
    // We REMOVE the heuristic check to make this behavior 100% deterministic and controllable.
    let ui_enabled = web_search.unwrap_or(false);
    let slash_command = force_web;

    if ui_enabled || slash_command {
        let searcher = skills::web_search::WebSearch::new()?;
        let depth = skills::web_search::SearchDepth::from_user_value(web_search_depth.as_deref());
        let results = searcher
            .search_with_options(&clean_query, skills::web_search::WebSearchOptions { depth })
            .await
            .map_err(|e| format!("Web search failed: {}", e))?;
        guru_context.push_str("\n\n### Web Search (Tavily)\n");
        guru_context.push_str(&results);
    }

    // 2. Init AI Client
    let provider = provider::resolve_provider_config(&app).map_err(|e| e.to_string())?;
    let api_key =
        config::api_key_for_provider_or_empty(&provider.provider_id).map_err(|e| e.to_string())?;
    let client = ai_client::AiClient::new(
        provider.provider_id.clone(),
        provider.base_url,
        provider.model,
        api_key,
    )
    .map_err(|e| e.to_string())?;
    let model_custom_instruction = user_preferences::load_user_preferences(&app)
        .ok()
        .and_then(|prefs| prefs.model_custom_instructions);

    // 3. Ask
    let result = client
        .ask_question(
            &guru_context,
            &clean_query,
            language.as_deref().unwrap_or("en"),
            model_custom_instruction.as_deref(),
        )
        .await
        .map_err(|e| e.to_string())?;

    let estimated_tokens = (((guru_context.len() + clean_query.len()) as f64) / 4.0).ceil() as u64;
    app.emit(
        "guardian:usage",
        serde_json::json!({
            "tokens": estimated_tokens.max(1),
            "calls": 1,
            "files": 0,
            "queue_wait_ms": result.queue_wait_ms,
        }),
    )
    .ok();

    Ok(result.value)
}

fn normalize_web_query(query: &str) -> (String, bool) {
    let trimmed = query.trim();
    let lower = trimmed.to_lowercase();

    // Support "/web " prefix
    if lower.starts_with("/web ") {
        return (trimmed[4..].trim().to_string(), true);
    }

    // Support "@web" anywhere
    if lower.contains("@web") {
        let clean = query
            .replace("@web", "")
            .replace("@Web", "")
            .replace("@WEB", "");
        return (clean.trim().to_string(), true);
    }

    (trimmed.to_string(), false)
}

fn append_issue_file_context(
    context: &mut String,
    root: &str,
    storage: &tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) {
    // Minimize lock scope: only hold the Mutex for the DB query, then release
    // before doing file I/O which can block.
    let issues = {
        let Ok(storage) = storage.lock() else {
            return;
        };
        match storage.get_active_issues() {
            Ok(issues) => issues,
            Err(_) => return,
        }
    };

    let mut critical_files: Vec<String> = Vec::new();
    let mut warning_files: Vec<String> = Vec::new();

    for (file_path, severity, _message) in issues {
        let sev = severity.to_lowercase();
        if sev.contains("critical") {
            critical_files.push(file_path);
        } else if sev.contains("warning") {
            warning_files.push(file_path);
        }
    }

    let mut files = Vec::new();
    for file in critical_files.into_iter().chain(warning_files.into_iter()) {
        if files.len() >= 3 {
            break;
        }
        if files.contains(&file) {
            continue;
        }
        files.push(file);
    }

    if files.is_empty() {
        return;
    }

    context.push_str("\n### Active Issue File Context:\n\n");
    let root_path = std::path::Path::new(root);
    for file in files {
        let path = std::path::Path::new(&file);
        if !path.starts_with(root_path) {
            continue;
        }
        if is_sensitive_path(path) {
            context.push_str(&format!("#### File: {} (skipped: sensitive)\n\n", file));
            continue;
        }
        let Ok(meta) = std::fs::metadata(path) else {
            continue;
        };
        // Security: Limit file size to 50KB to prevent DoS and reduce token usage
        if meta.len() > 50_000 {
            context.push_str(&format!("#### File: {} (skipped: large file)\n\n", file));
            continue;
        }
        // Security: Detect and skip binary files
        if is_binary_file(path) {
            context.push_str(&format!("#### File: {} (skipped: binary file)\n\n", file));
            continue;
        }
        if let Ok(content) = std::fs::read_to_string(path) {
            let truncated: String = content.lines().take(260).collect::<Vec<_>>().join("\n");
            context.push_str(&format!("#### File: {}\n```\n{}\n```\n\n", file, truncated));
        }
    }
}

fn is_sensitive_path(path: &std::path::Path) -> bool {
    crate::redaction::gate::is_sensitive_file(path)
}

// Security: Detect binary files by extension and content analysis
fn is_binary_file(path: &std::path::Path) -> bool {
    const BINARY_EXTENSIONS: &[&str] = &[
        "exe", "dll", "so", "dylib", "bin", "o", "a", "lib", "png", "jpg", "jpeg", "gif", "bmp",
        "ico", "svg", "mp3", "mp4", "wav", "avi", "mov", "mkv", "zip", "tar", "gz", "rar", "7z",
        "bz2", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "wasm", "class", "jar", "pyc",
        "pyo",
    ];

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if BINARY_EXTENSIONS
            .iter()
            .any(|&bin_ext| ext.eq_ignore_ascii_case(bin_ext))
        {
            return true;
        }
    }

    if let Ok(data) = std::fs::read(path) {
        let sample = &data[..data.len().min(1024)];
        if sample.contains(&0u8) {
            return true;
        }
        if std::str::from_utf8(sample).is_err() {
            return true;
        }
    }

    false
}

#[tauri::command]
async fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

#[tauri::command]
async fn get_project_context(
    app: AppHandle,
    path: String,
) -> Result<context::ProjectContext, String> {
    let scan_profile_cfg = load_scan_profile_config(&app)?;
    let scan_profile = normalize_scan_profile(&scan_profile_cfg.profile)?;
    Ok(context::ProjectContext::index_path_with_profile(
        &path,
        scan_profile,
    ))
}

#[tauri::command]
async fn get_provider_config(app: AppHandle) -> Result<provider::ProviderConfig, String> {
    provider::load_provider_config(&app)
}

#[tauri::command]
async fn set_provider_config(
    app: AppHandle,
    config: provider::ProviderConfig,
) -> Result<provider::ProviderConfig, String> {
    provider::save_provider_config(&app, config)
}

#[derive(Serialize)]
struct ProviderConnectionTestResult {
    ok: bool,
    provider_id: String,
    base_url: String,
    model: String,
    message: String,
}

fn normalize_provider_model_id(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .trim_start_matches("models/")
        .to_string()
}

#[tauri::command]
async fn test_provider_connection(
    app: AppHandle,
    config: Option<provider::ProviderConfig>,
) -> Result<ProviderConnectionTestResult, String> {
    let config = match config {
        Some(cfg) => provider::apply_defaults(cfg),
        None => provider::load_provider_config(&app)?,
    };

    let provider_id = config.provider_id.clone();
    let base_url = config.base_url.clone();
    let model = config.model.clone();

    let api_key = config::user_api_key_for_provider(&provider_id)
        .map(|opt| opt.map(|s| s.expose_secret().to_string()))
        .map_err(|e| e.to_string())?;

    let models = provider::list_provider_models(&config, api_key).await?;
    if models.is_empty() {
        return Ok(ProviderConnectionTestResult {
            ok: true,
            provider_id,
            base_url,
            model,
            message: "Connected, but the provider returned an empty model list.".to_string(),
        });
    }

    let expected = normalize_provider_model_id(&model);
    let found = models
        .iter()
        .any(|m| normalize_provider_model_id(m) == expected);

    if !found {
        let hint = match provider_id.as_str() {
            "ollama" | "ollama-cloud" => format!(
                "Connected, but model '{model}' was not found. Click Refresh to pick an installed model, or run `ollama pull {model}` on the host."
            ),
            _ => format!(
                "Connected, but model '{model}' was not found in the provider catalog. Click Refresh and choose an available model."
            ),
        };
        return Err(hint);
    }

    Ok(ProviderConnectionTestResult {
        ok: true,
        provider_id: provider_id.clone(),
        base_url,
        model: model.clone(),
        message: format!(
            "Connection OK. Selected model '{model}' is available ({}) models listed.",
            models.len()
        ),
    })
}

fn read_optional_env(key: &str) -> Option<String> {
    // Thread-safe in-process config store (replaces std::env::set_var)
    if let Ok(store) = EMBEDDING_RUNTIME_STORE.read() {
        let value = match key {
            "GUARDIAN_EMBED_MODE" => store.mode.clone(),
            "GUARDIAN_EMBED_PROVIDER" => store.provider.clone(),
            "GUARDIAN_EMBED_BASE_URL_OPENAI" => store.openai_base_url.clone(),
            "GUARDIAN_EMBED_BASE_URL_OLLAMA" => store.ollama_base_url.clone(),
            "GUARDIAN_EMBED_MODEL" => store.openai_model.clone(),
            "GUARDIAN_EMBED_MODEL_OLLAMA" => store.ollama_model.clone(),
            _ => None,
        };
        if value.is_some() {
            return value;
        }
    }
    // Fallback to env vars (read-only, set at startup)
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn normalize_embedding_mode(mode: &str) -> Result<String, String> {
    let normalized = mode.trim().to_lowercase();
    let normalized = match normalized.as_str() {
        "" => "auto".to_string(),
        "openai" => "openai".to_string(),
        "ollama" => "ollama".to_string(),
        "local" | "local-hash" => "local".to_string(),
        "auto" => "auto".to_string(),
        other => {
            return Err(format!(
                "Unsupported embedding mode '{}'. Use auto|openai|ollama|local.",
                other
            ))
        }
    };
    Ok(normalized)
}

fn normalize_optional_url(value: Option<String>, field: &str) -> Result<Option<String>, String> {
    let Some(raw) = value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    else {
        return Ok(None);
    };
    let parsed = url::Url::parse(&raw).map_err(|e| format!("Invalid {} URL: {}", field, e))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("{} URL must use http or https.", field));
    }
    Ok(Some(raw))
}

fn normalize_optional_model(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

#[tauri::command]
async fn get_embedding_runtime_config() -> Result<EmbeddingRuntimeConfig, String> {
    let mode = normalize_embedding_mode(
        &read_optional_env("GUARDIAN_EMBED_MODE")
            .or_else(|| read_optional_env("GUARDIAN_EMBED_PROVIDER"))
            .unwrap_or_else(|| "auto".to_string()),
    )?;

    Ok(EmbeddingRuntimeConfig {
        mode,
        openai_base_url: read_optional_env("GUARDIAN_EMBED_BASE_URL_OPENAI")
            .or_else(|| read_optional_env("GUARDIAN_EMBED_BASE_URL")),
        ollama_base_url: read_optional_env("GUARDIAN_EMBED_BASE_URL_OLLAMA")
            .or_else(|| read_optional_env("GUARDIAN_EMBED_BASE_URL")),
        openai_model: read_optional_env("GUARDIAN_EMBED_MODEL"),
        ollama_model: read_optional_env("GUARDIAN_EMBED_MODEL_OLLAMA"),
    })
}

#[tauri::command]
async fn set_embedding_runtime_config(
    config: EmbeddingRuntimeConfig,
) -> Result<EmbeddingRuntimeConfig, String> {
    let mode = normalize_embedding_mode(&config.mode)?;
    let openai_base_url = normalize_optional_url(config.openai_base_url, "OpenAI embedding")?;
    let ollama_base_url = normalize_optional_url(config.ollama_base_url, "Ollama embedding")?;
    let openai_model = normalize_optional_model(config.openai_model);
    let ollama_model = normalize_optional_model(config.ollama_model);

    // Thread-safe config update (no std::env::set_var — avoids UB in async)
    {
        let mut store = EMBEDDING_RUNTIME_STORE
            .write()
            .map_err(|_| "Failed to acquire embedding config lock".to_string())?;
        match mode.as_str() {
            "auto" => {
                store.mode = None;
                store.provider = None;
            }
            m @ ("openai" | "ollama" | "local") => {
                store.mode = Some(m.to_string());
                store.provider = Some(m.to_string());
            }
            _ => {}
        }
        store.openai_base_url = openai_base_url;
        store.ollama_base_url = ollama_base_url;
        store.openai_model = openai_model;
        store.ollama_model = ollama_model;
    }

    get_embedding_runtime_config().await
}

#[tauri::command]
async fn list_provider_models(
    app: AppHandle,
    provider_id: Option<String>,
    base_url: Option<String>,
) -> Result<Vec<String>, String> {
    let mut config = provider::load_provider_config(&app)?;
    if let Some(id) = provider_id {
        config.provider_id = id;
    }
    if let Some(url) = base_url {
        config.base_url = url;
    }
    let config = provider::apply_defaults(config);
    let api_key = config::user_api_key_for_provider(&config.provider_id)
        .map(|opt| opt.map(|s| s.expose_secret().to_string()))
        .map_err(|e| e.to_string())?;
    provider::list_provider_models(&config, api_key).await
}

#[tauri::command]
async fn get_api_key_status(
    provider_id: Option<String>,
    app: AppHandle,
) -> Result<ApiKeyStatus, String> {
    let provider_id = match provider_id {
        Some(id) => id,
        None => provider::load_provider_config(&app)?.provider_id,
    };
    match config::user_api_key_for_provider(&provider_id) {
        Ok(Some(_)) => Ok(ApiKeyStatus {
            has_key: true,
            source: "keychain".to_string(),
            warning: None,
        }),
        Ok(None) => {
            let env_key = config::env_api_key();
            let trimmed = env_key.expose_secret().trim();
            if config::is_placeholder_key(trimmed) {
                Ok(ApiKeyStatus {
                    has_key: false,
                    source: "missing".to_string(),
                    warning: None,
                })
            } else {
                Ok(ApiKeyStatus {
                    has_key: false,
                    source: "env_ignored".to_string(),
                    warning: Some(
                        "Environment API key is ignored. Set your own key in Settings.".to_string(),
                    ),
                })
            }
        }
        Err(err) => Ok(ApiKeyStatus {
            has_key: false,
            source: "error".to_string(),
            warning: Some(format!("Keychain error: {}", err)),
        }),
    }
}

#[tauri::command]
async fn set_user_api_key(
    provider_id: Option<String>,
    api_key: String,
    app: AppHandle,
) -> Result<(), String> {
    let id = provider_id.unwrap_or_else(|| {
        provider::load_provider_config(&app)
            .map(|c| c.provider_id)
            .unwrap_or_else(|_| "ollama".to_string())
    });
    config::set_user_api_key_for_provider(&id, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_user_api_key(provider_id: Option<String>, app: AppHandle) -> Result<(), String> {
    let id = provider_id.unwrap_or_else(|| {
        provider::load_provider_config(&app)
            .map(|c| c.provider_id)
            .unwrap_or_else(|_| "ollama".to_string())
    });
    config::clear_user_api_key_for_provider(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_app_update(app: AppHandle) -> Result<updates::UpdateCheckResult, String> {
    updates::check_app_update(&app).await
}

#[tauri::command]
async fn install_app_update(app: AppHandle) -> Result<(), String> {
    updates::install_app_update(&app).await
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn get_chat_history(
    path: String,
    limit: Option<u32>,
    offset: Option<u32>,
    storage: tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) -> Result<Vec<storage::ChatMessage>, String> {
    let storage = storage
        .lock()
        .map_err(|_| "Storage lock poisoned".to_string())?;
    let limit = limit.unwrap_or(500) as usize;
    let offset = offset.unwrap_or(0) as usize;
    storage
        .load_chat_messages(&path, limit, offset)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn append_chat_message(
    path: String,
    message: storage::ChatMessage,
    storage: tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) -> Result<(), String> {
    let storage = storage
        .lock()
        .map_err(|_| "Storage lock poisoned".to_string())?;
    storage
        .save_chat_message(&path, &message)
        .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct TavilyKeyStatus {
    has_key: bool,
    source: String,
}

#[tauri::command]
async fn get_tavily_key_status() -> Result<TavilyKeyStatus, String> {
    if let Some(key) = config::user_tavily_key().map_err(|e| e.to_string())? {
        if !config::is_placeholder_key(key.expose_secret()) {
            return Ok(TavilyKeyStatus {
                has_key: true,
                source: "user".to_string(),
            });
        }
    }
    Ok(TavilyKeyStatus {
        has_key: false,
        source: "none".to_string(),
    })
}

#[tauri::command]
async fn set_tavily_key(key: String) -> Result<(), String> {
    config::set_user_tavily_key(&key).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_tavily_key() -> Result<(), String> {
    config::clear_user_tavily_key().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_user_preferences(
    app: AppHandle,
) -> Result<user_preferences::UserPreferencesV1, String> {
    user_preferences::load_user_preferences(&app)
}

#[tauri::command]
async fn set_user_preferences(
    app: AppHandle,
    preferences: user_preferences::UserPreferencesV1,
) -> Result<user_preferences::UserPreferencesV1, String> {
    user_preferences::save_user_preferences(&app, preferences)
}

#[tauri::command]
async fn reset_user_preferences(
    app: AppHandle,
) -> Result<user_preferences::UserPreferencesV1, String> {
    user_preferences::reset_user_preferences(&app)
}

#[tauri::command]
async fn clear_chat_history(
    path: String,
    storage: tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) -> Result<(), String> {
    let storage = storage
        .lock()
        .map_err(|_| "Storage lock poisoned".to_string())?;
    storage
        .clear_chat_messages(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_web(query: String) -> Result<String, String> {
    let trimmed = query.trim();
    info!(
        target: "guardian::search",
        "Searching web (len={})",
        trimmed.len()
    );
    let searcher = skills::web_search::WebSearch::new()?;
    searcher.search(trimmed).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> AnyhowResult<()> {
    // 0. Initialize Environment Variables
    config::load_runtime_env();

    // 0.1 Initialize Tracing Subscriber (SPAP v2.2: Structured Logging)
    // Dev: RUST_LOG=guardian=debug for verbose. Production defaults to info+.
    use tracing_subscriber::{fmt, EnvFilter};
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("guardian=info,warn"));
    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .compact()
        .init();

    // 1. Initialize Memory (Storage)
    let home = dirs::home_dir().context("Could not find home directory")?;
    let storage = Arc::new(Mutex::new(
        storage::StorageManager::init(&home.to_string_lossy())
            .context("CRITICAL: Failed to initialize Guardian Memory (SQLite)")?,
    ));

    info!(target: "guardian", "Memory initialized at ~/.guardian/memory.db");

    // 2. Initialize Kernel (Central Nervous System)
    let bus = Arc::new(kernel::bus::EventBus::new());

    // 3. Ignite the Brain (Agent Orchestrator)
    // Needs AppHandle, so we must defer orchestrator creation until setup closure or use a lazy static?
    // Actually, we can't create it here if we need AppHandle.
    // We need to use .setup() hook!

    let bus_clone = bus.clone();
    let storage_clone = storage.clone();

    tauri::Builder::default()
        .manage(storage)
        .manage(bus) // Manage Bus so commands can use it
        .manage(WatcherSupervisor::new())
        .manage(workspace_manager::WorkspaceManager::new())
        .manage(AuthState::new())
        .setup(move |app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())
                .map_err(|e| anyhow::anyhow!(e))?;

            let handle = app.handle().clone();

            // Spawn Orchestrator Here where we have the Handle
            let orch_bus = bus_clone.clone();
            let orch_storage = storage_clone.clone();
            tauri::async_runtime::spawn(async move {
                let provider = match provider::resolve_provider_config(&handle) {
                    Ok(cfg) => cfg,
                    Err(err) => {
                        error!(target: "guardian::provider", "Config error: {}", err);
                        return;
                    }
                };
                match skills::orchestrator::AgentOrchestrator::new(
                    orch_bus,
                    orch_storage,
                    handle,
                    provider,
                ) {
                    Ok(orchestrator) => {
                        orchestrator.run().await;
                    }
                    Err(err) => {
                        error!(target: "guardian::orchestrator", "Init failed: {}", err);
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            start_monitoring,
            stop_monitoring,
            add_monitored_workspace,
            remove_monitored_workspace,
            list_monitored_workspaces,
            get_workspace_status,
            get_baseline,
            create_baseline,
            clear_baseline,
            get_baseline_status,
            get_monitor_critiques,
            get_guardian_lock_status,
            ensure_guardian_lock,
            get_last_ai_context,
            get_fix_proposals,
            set_fix_proposal_status,
            get_release_decision,
            set_release_decision,
            override_release_block,
            start_github_login,
            complete_github_login,
            logout_github,
            get_auth_session,
            refresh_auth_session,
            apply_fix,
            apply_fix_now,
            undo_fix,
            get_fix_history,
            ask_guru,
            search_web,
            confirm_fix,
            ping,
            get_project_context,
            get_provider_config,
            set_provider_config,
            test_provider_connection,
            get_embedding_runtime_config,
            set_embedding_runtime_config,
            list_provider_models,
            get_api_key_status,
            set_user_api_key,
            clear_user_api_key,
            check_app_update,
            get_app_version,
            install_app_update,
            get_chat_history,
            append_chat_message,
            clear_chat_history,
            get_tavily_key_status,
            set_tavily_key,
            clear_tavily_key,
            get_user_preferences,
            set_user_preferences,
            reset_user_preferences,
            get_scan_profile_config,
            set_scan_profile_config
        ])
        .run(tauri::generate_context!())
        .context("error while running tauri application")?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    #[tokio::test]
    async fn test_event_bus() {
        let bus = kernel::bus::EventBus::new();
        let mut rx = bus.subscribe();

        let event = kernel::bus::GuardianEvent::FileModified {
            path: "test.rs".to_string(),
        };

        bus.publish(event.clone()).await;

        let received = rx.recv().await.unwrap();
        match (event, received) {
            (
                kernel::bus::GuardianEvent::FileModified { path: p1 },
                kernel::bus::GuardianEvent::FileModified { path: p2 },
            ) => {
                assert_eq!(p1, p2);
            }
            _ => panic!("Events did not match"),
        }
    }

    #[tokio::test]
    async fn test_auth_state_expires_session() {
        let state = AuthState::new();
        let user = auth::github::GithubUser {
            login: "tester".to_string(),
            id: 1,
            avatar_url: None,
        };
        let expired_at = chrono::Utc::now() - chrono::Duration::hours(SESSION_MAX_HOURS + 1);
        state.set_session_at(user, expired_at).await;
        assert!(
            state.get_user().await.is_none(),
            "Expired session should be cleared"
        );
    }

    #[tokio::test]
    async fn test_auth_state_keeps_fresh_session() {
        let state = AuthState::new();
        let user = auth::github::GithubUser {
            login: "tester".to_string(),
            id: 2,
            avatar_url: None,
        };
        let fresh_at = chrono::Utc::now() - chrono::Duration::hours(1);
        state.set_session_at(user.clone(), fresh_at).await;
        let resolved = state.get_user().await;
        assert!(resolved.is_some(), "Fresh session should be available");
        assert_eq!(resolved.unwrap().login, user.login);
    }

    #[test]
    fn test_patcher_success() {
        use std::env;

        // Create temp file in current directory (test runs in project root)
        let temp_dir = env::current_dir().unwrap().join("target").join("test_temp");
        fs::create_dir_all(&temp_dir).ok();

        let file_path = temp_dir.join("test_file.txt");
        let mut file = fs::File::create(&file_path).unwrap();
        writeln!(file, "Original Content").unwrap();

        let new_content = "Patched Content";
        let path_str = file_path.to_str().unwrap();

        let root = env::current_dir().unwrap();
        let res = patcher::apply_patch(path_str, new_content, root.to_str().unwrap());
        assert!(res.is_ok(), "Patch failed: {:?}", res);

        let final_content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(final_content, new_content);

        // Cleanup
        let _ = fs::remove_file(&file_path);
    }

    #[test]
    fn test_patcher_file_not_found() {
        let root = std::env::current_dir().unwrap();
        let res = patcher::apply_patch(
            "/tmp/this_file_does_not_exist_12345.txt",
            "content",
            root.to_str().unwrap(),
        );
        assert!(res.is_err());
        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("Security Violation"));
    }

    #[cfg(unix)]
    #[test]
    fn test_patcher_rejects_symlink() {
        use std::env;
        use std::os::unix::fs::symlink;

        let root = env::current_dir().unwrap();
        let temp_dir = root.join("target").join("test_temp");
        fs::create_dir_all(&temp_dir).ok();

        let outside_path = env::temp_dir().join("guardian_symlink_target.txt");
        fs::write(&outside_path, "outside").unwrap();

        let link_path = temp_dir.join("symlink.txt");
        if link_path.exists() {
            let _ = fs::remove_file(&link_path);
        }
        symlink(&outside_path, &link_path).unwrap();

        let res = patcher::apply_patch(
            link_path.to_str().unwrap(),
            "content",
            root.to_str().unwrap(),
        );
        assert!(res.is_err(), "Symlink path should be rejected");

        let _ = fs::remove_file(&link_path);
        let _ = fs::remove_file(&outside_path);
    }
}
