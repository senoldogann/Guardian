
mod watcher;
mod ai_client;
// V2 Modules
mod executor;
mod context;
mod config;
mod auth;
mod provider;
mod updates;
#[cfg(test)]
mod tests_watcher;
mod patcher;
mod rag_lite;
mod kernel;
mod storage;
mod skills;
mod history_logger;
mod validation;

use tauri::{AppHandle, Manager};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use std::sync::atomic::{AtomicBool, Ordering};
use anyhow::{Context, Result as AnyhowResult};
use serde::{Serialize, Deserialize};
use std::fs;
use keyring::{Entry, Error as KeyringError};
use secrecy::ExposeSecret;
use sha2::{Digest, Sha256};
use hex;
use tracing::{info, warn, error};

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

    async fn set_session_at(&self, user: auth::github::GithubUser, verified_at: chrono::DateTime<chrono::Utc>) {
        let mut guard = self.session.write().await;
        *guard = Some(AuthSessionState { user, verified_at });
    }

    async fn clear(&self) {
        let mut guard = self.session.write().await;
        *guard = None;
    }

    async fn get_user(&self) -> Option<auth::github::GithubUser> {
        let mut guard = self.session.write().await;
        if let Some(session) = guard.as_ref() {
            let age_hours = chrono::Utc::now()
                .signed_duration_since(session.verified_at)
                .num_hours();
            if age_hours > SESSION_MAX_HOURS {
                *guard = None;
                return None;
            }
            return Some(session.user.clone());
        }
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
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
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

fn persist_auth_user(app: &AppHandle, user: &auth::github::GithubUser, token: &str) -> Result<(), String> {
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

    async fn start(&self, app: AppHandle, path: String, api_key: String, model: String, host: String, provider_id: String) {
        self.stop().await;
        self.shutdown.store(false, Ordering::Relaxed);

        let shutdown = self.shutdown.clone();
        let handle = tauri::async_runtime::spawn(async move {
            watcher::start_watching(app, path, api_key, model, host, provider_id, shutdown).await;
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
    let api_key = config::api_key_for_provider(&provider.provider_id).map_err(|e| e.to_string())?;

    watcher
        .start(
            app,
            path,
            api_key.expose_secret().to_string(),
            provider.model,
            provider.base_url,
            provider.provider_id,
        )
        .await;

    Ok(())
}

#[tauri::command]
async fn stop_monitoring(watcher: tauri::State<'_, WatcherSupervisor>) -> Result<(), String> {
    watcher.stop().await;
    Ok(())
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
        client_secret.map(|s| s.expose_secret().to_string()).as_deref(),
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

#[tauri::command]
async fn get_auth_session(
    app: AppHandle,
    auth_state: tauri::State<'_, AuthState>,
    cached_only: Option<bool>,
) -> Result<Option<AuthSessionView>, String> {
    const OFFLINE_MAX_HOURS: i64 = 72;
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
            if let Ok(Some(cached)) = load_cached_user(&app) {
                if cached.token_hash.as_deref() == Some(token_hash(&token).as_str()) {
                    if let Some(issued_at) = cached.issued_at.as_ref().or(cached.verified_at.as_ref()) {
                        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(issued_at) {
                            let age_hours = chrono::Utc::now()
                                .signed_duration_since(parsed.with_timezone(&chrono::Utc))
                                .num_hours();
                            if age_hours > TOKEN_ROTATION_HOURS {
                                let _ = clear_auth_session(&app);
                                return Ok(None);
                            }
                        }
                    }
                }
            }
            match auth::github::verify_access_token(&token).await {
                Ok(user) => {
                    auth_state.set_session(user.clone()).await;
                    let _ = persist_auth_user(&app, &user, &token);
                    return Ok(Some(AuthSessionView { user, verified: true, warning: None }));
                }
                Err(auth::github::VerifyError::Unauthorized) => {
                    let _ = clear_auth_session(&app);
                    return Ok(None);
                }
                Err(auth::github::VerifyError::Offline(detail)) => {
                    if let Ok(Some(cached)) = load_cached_user(&app) {
                        let current_hash = token_hash(&token);
                        let cached_hash = cached.token_hash.unwrap_or_default();
                        if cached_hash != current_hash {
                            return Ok(None);
                        }

                        let verified_at = cached.verified_at.clone().unwrap_or_default();
                        let verified_at = chrono::DateTime::parse_from_rfc3339(&verified_at)
                            .map_err(|_| "Offline cache expired. Connect to the internet to re-verify.".to_string())?
                            .with_timezone(&chrono::Utc);
                        let age_hours = chrono::Utc::now()
                            .signed_duration_since(verified_at)
                            .num_hours();
                        if age_hours > OFFLINE_MAX_HOURS {
                            let _ = clear_auth_session(&app);
                            return Err("Offline verification expired. Connect to the internet to re-verify.".to_string());
                        }

                        auth_state.set_session(cached.user.clone()).await;
                        return Ok(Some(AuthSessionView {
                            user: cached.user,
                            verified: false,
                            warning: Some(format!("Offline verification (last verified {}h ago). {}", age_hours, detail)),
                        }));
                    }
                    return Ok(None);
                }
                Err(auth::github::VerifyError::Other(detail)) => {
                    return Err(format!("GitHub verification failed: {}", detail));
                }
            }
        }
    }

    Ok(auth_state.get_user().await.map(|user| AuthSessionView { user, verified: true, warning: None }))
}

#[tauri::command]
async fn refresh_auth_session(
    app: AppHandle,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<Option<AuthSessionView>, String> {
    const OFFLINE_MAX_HOURS: i64 = 72;
    let token = load_access_token()?;
    if let Some(token) = token {
        if let Ok(Some(cached)) = load_cached_user(&app) {
            if cached.token_hash.as_deref() == Some(token_hash(&token).as_str()) {
                if let Some(issued_at) = cached.issued_at.as_ref().or(cached.verified_at.as_ref()) {
                    if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(issued_at) {
                        let age_hours = chrono::Utc::now()
                            .signed_duration_since(parsed.with_timezone(&chrono::Utc))
                            .num_hours();
                        if age_hours > TOKEN_ROTATION_HOURS {
                            let _ = clear_auth_session(&app);
                            return Ok(None);
                        }
                    }
                }
            }
        }
        match auth::github::verify_access_token(&token).await {
            Ok(user) => {
                auth_state.set_session(user.clone()).await;
                let _ = persist_auth_user(&app, &user, &token);
                return Ok(Some(AuthSessionView { user, verified: true, warning: None }));
            }
            Err(auth::github::VerifyError::Unauthorized) => {
                let _ = clear_auth_session(&app);
                return Ok(None);
            }
            Err(auth::github::VerifyError::Offline(detail)) => {
                if let Ok(Some(cached)) = load_cached_user(&app) {
                    let current_hash = token_hash(&token);
                    let cached_hash = cached.token_hash.unwrap_or_default();
                    if cached_hash != current_hash {
                        return Ok(None);
                    }

                    let verified_at = cached.verified_at.clone().unwrap_or_default();
                    let verified_at = chrono::DateTime::parse_from_rfc3339(&verified_at)
                        .map_err(|_| "Offline cache expired. Connect to the internet to re-verify.".to_string())?
                        .with_timezone(&chrono::Utc);
                    let age_hours = chrono::Utc::now()
                        .signed_duration_since(verified_at)
                        .num_hours();
                    if age_hours > OFFLINE_MAX_HOURS {
                        let _ = clear_auth_session(&app);
                        return Err("Offline verification expired. Connect to the internet to re-verify.".to_string());
                    }

                    auth_state.set_session(cached.user.clone()).await;
                    return Ok(Some(AuthSessionView {
                        user: cached.user,
                        verified: false,
                        warning: Some(format!("Offline verification (last verified {}h ago). {}", age_hours, detail)),
                    }));
                }
                return Ok(None);
            }
            Err(auth::github::VerifyError::Other(detail)) => {
                return Err(format!("GitHub verification failed: {}", detail));
            }
        }
    }

    Ok(None)
}

#[tauri::command]
async fn apply_fix(
    state_bus: tauri::State<'_, Arc<kernel::bus::EventBus>>, 
    file_path: String, 
    new_content: String
) -> Result<String, String> {
    info!(target: "guardian::autopilot", "Fix requested for: {}", file_path);
    
    // Publish RequestReview event to the Kernel
    state_bus.publish(kernel::bus::GuardianEvent::RequestReview { 
        file_path: file_path.clone(), 
        diff: new_content 
    }).await;

    Ok("Governance Review Initiated...".to_string())
}

#[tauri::command]
async fn confirm_fix(file_path: String, new_content: String, root: String) -> Result<String, String> {
    info!(target: "guardian::autopilot", "Fix confirmed, applying to: {}", file_path);
    patcher::apply_patch(&file_path, &new_content, &root)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ask_guru(
    app: AppHandle,
    path: String,
    query: String,
    web_search: Option<bool>,
    storage: tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) -> Result<String, String> {
    // 1. Get Context via RagLite
    let (clean_query, force_web) = normalize_web_query(&query);
    let mut context = rag_lite::search_context(&path, &clean_query);
    append_issue_file_context(&mut context, &path, &storage);

    // 1.5 Optional Web Search (Tavily)
    if web_search.unwrap_or(false) {
        let should_use = force_web || should_use_web_search(&clean_query);
        if should_use {
            let searcher = skills::web_search::WebSearch::new()?;
            let results = searcher
                .search(&clean_query)
                .await
                .map_err(|e| format!("Web search failed: {}", e))?;
            context.push_str("\n\n### Web Search (Tavily)\n");
            context.push_str(&results);
        }
    }
    
    // 2. Init AI Client
    let provider = provider::resolve_provider_config(&app).map_err(|e| e.to_string())?;
    let api_key = config::api_key_for_provider(&provider.provider_id).map_err(|e| e.to_string())?;
    let client = ai_client::AiClient::new(provider.provider_id.clone(), provider.base_url, provider.model, api_key)
        .map_err(|e| e.to_string())?;

    // 3. Ask
    client.ask_question(&context, &clean_query).await.map_err(|e| e.to_string())
}

fn normalize_web_query(query: &str) -> (String, bool) {
    let trimmed = query.trim();
    let lower = trimmed.to_lowercase();
    if lower.starts_with("/web ") {
        return (trimmed[4..].trim().to_string(), true);
    }
    (trimmed.to_string(), false)
}

fn should_use_web_search(query: &str) -> bool {
    let q = query.to_lowercase();
    if q.contains("http://") || q.contains("https://") {
        return true;
    }
    let triggers = [
        "latest",
        "current",
        "today",
        "news",
        "release",
        "version",
        "changelog",
        "docs",
        "documentation",
        "pricing",
        "policy",
        "terms",
        "github",
        "repo",
        "website",
        "link",
        "compare",
        "benchmark",
        "cve",
        "security advisory",
        "vulnerability",
    ];
    triggers.iter().any(|t| q.contains(t))
}

fn append_issue_file_context(
    context: &mut String,
    root: &str,
    storage: &tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) {
    let Ok(storage) = storage.lock() else { return; };
    let Ok(issues) = storage.get_active_issues() else { return; };

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
        let Ok(meta) = std::fs::metadata(path) else { continue; };
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
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with(".env"))
        .unwrap_or(false)
}

// Security: Detect binary files by extension and content analysis
fn is_binary_file(path: &std::path::Path) -> bool {
    const BINARY_EXTENSIONS: &[&str] = &[
        "exe", "dll", "so", "dylib", "bin", "o", "a", "lib",
        "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg",
        "mp3", "mp4", "wav", "avi", "mov", "mkv",
        "zip", "tar", "gz", "rar", "7z", "bz2",
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        "wasm", "class", "jar", "pyc", "pyo"
    ];

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if BINARY_EXTENSIONS.iter().any(|&bin_ext| ext.eq_ignore_ascii_case(bin_ext)) {
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
async fn get_project_context(path: String) -> Result<context::ProjectContext, String> {
    Ok(context::ProjectContext::index_path(&path))
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
async fn get_api_key_status(provider_id: Option<String>, app: AppHandle) -> Result<ApiKeyStatus, String> {
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
                    warning: Some("Environment API key is ignored. Set your own key in Settings.".to_string()),
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
async fn set_user_api_key(provider_id: Option<String>, api_key: String, app: AppHandle) -> Result<(), String> {
    let id = provider_id.unwrap_or_else(|| provider::load_provider_config(&app).map(|c| c.provider_id).unwrap_or_else(|_| "ollama".to_string()));
    config::set_user_api_key_for_provider(&id, &api_key).map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_user_api_key(provider_id: Option<String>, app: AppHandle) -> Result<(), String> {
    let id = provider_id.unwrap_or_else(|| provider::load_provider_config(&app).map(|c| c.provider_id).unwrap_or_else(|_| "ollama".to_string()));
    config::clear_user_api_key_for_provider(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<updates::UpdateCheckResult, String> {
    updates::check_for_updates(&app).await
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
async fn set_update_feed_url(app: AppHandle, url: String) -> Result<(), String> {
    updates::set_update_feed_url(&app, &url)
}

#[tauri::command]
async fn download_update(app: AppHandle, url: String) -> Result<String, String> {
    updates::download_update(&app, &url).await
}

#[tauri::command]
async fn get_update_feed_url(app: AppHandle) -> Result<Option<String>, String> {
    updates::get_update_feed_url(&app)
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
    let storage = storage.lock().map_err(|_| "Storage lock poisoned".to_string())?;
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
    let storage = storage.lock().map_err(|_| "Storage lock poisoned".to_string())?;
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
            return Ok(TavilyKeyStatus { has_key: true, source: "user".to_string() });
        }
    }
    Ok(TavilyKeyStatus { has_key: false, source: "none".to_string() })
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
async fn clear_chat_history(
    path: String,
    storage: tauri::State<'_, Arc<Mutex<storage::StorageManager>>>,
) -> Result<(), String> {
    let storage = storage.lock().map_err(|_| "Storage lock poisoned".to_string())?;
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
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("guardian=info,warn"));
    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .compact()
        .init();

    // 1. Initialize Memory (Storage)
    let home = dirs::home_dir().context("Could not find home directory")?;
    let storage = Arc::new(Mutex::new(
        storage::StorageManager::init(&home.to_string_lossy())
        .context("CRITICAL: Failed to initialize Guardian Memory (SQLite)")?
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
                    provider
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
            start_github_login,
            complete_github_login,
            logout_github,
            get_auth_session,
            refresh_auth_session,
            apply_fix,
            ask_guru,
            search_web,
            confirm_fix,
            ping,
            get_project_context,
            get_provider_config,
            set_provider_config,
            list_provider_models,
            get_api_key_status,
            set_user_api_key,
            clear_user_api_key,
            check_for_updates,
            check_app_update,
            set_update_feed_url,
            download_update,
            get_update_feed_url,
            get_app_version,
            install_app_update,
            get_chat_history,
            append_chat_message,
            clear_chat_history,
            get_tavily_key_status,
            set_tavily_key,
            clear_tavily_key
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
            (kernel::bus::GuardianEvent::FileModified { path: p1 }, kernel::bus::GuardianEvent::FileModified { path: p2 }) => {
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
        assert!(state.get_user().await.is_none(), "Expired session should be cleared");
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
        let res = patcher::apply_patch("/tmp/this_file_does_not_exist_12345.txt", "content", root.to_str().unwrap());
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
