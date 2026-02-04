
mod watcher;
mod ai_client;
// V2 Modules
mod executor;
mod context;
mod config;
mod auth;
#[cfg(test)]
mod tests_watcher;
mod patcher;
mod rag_lite;
mod kernel;
mod storage;
mod skills;
mod history_logger;

use tauri::AppHandle;
use std::sync::{Mutex, Arc};
use std::sync::atomic::{AtomicBool, Ordering};
use anyhow::{Context, Result as AnyhowResult};
use serde::Serialize;

struct WatcherSupervisor {
    shutdown: Arc<AtomicBool>,
    handle: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

struct AuthState {
    session: Mutex<Option<auth::github::AuthSession>>,
}

impl AuthState {
    fn new() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }

    fn set_session(&self, session: auth::github::AuthSession) {
        if let Ok(mut guard) = self.session.lock() {
            *guard = Some(session);
        }
    }

    fn clear(&self) {
        if let Ok(mut guard) = self.session.lock() {
            *guard = None;
        }
    }

    fn get_user(&self) -> Option<auth::github::GithubUser> {
        self.session
            .lock()
            .ok()
            .and_then(|guard| guard.as_ref().map(|s| s.user.clone()))
    }
}

#[derive(Serialize)]
struct AuthSessionView {
    user: auth::github::GithubUser,
}

impl WatcherSupervisor {
    fn new() -> Self {
        Self {
            shutdown: Arc::new(AtomicBool::new(false)),
            handle: Mutex::new(None),
        }
    }

    fn start(&self, app: AppHandle, path: String, api_key: String, model: String, host: String) {
        self.stop();
        self.shutdown.store(false, Ordering::Relaxed);

        let shutdown = self.shutdown.clone();
        let handle = tauri::async_runtime::spawn(async move {
            watcher::start_watching(app, path, api_key, model, host, shutdown).await;
        });

        if let Ok(mut guard) = self.handle.lock() {
            *guard = Some(handle);
        }
    }

    fn stop(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
        if let Ok(mut guard) = self.handle.lock() {
            if let Some(handle) = guard.take() {
                handle.abort();
            }
        }
    }
}


#[tauri::command]
async fn start_monitoring(
    app: AppHandle,
    path: String,
    watcher: tauri::State<'_, WatcherSupervisor>,
) -> Result<(), String> {
    let path_buf = std::path::Path::new(&path);
    if !path_buf.exists() {
        return Err("Workspace path does not exist.".to_string());
    }
    if !path_buf.is_dir() {
        return Err("Workspace path is not a directory.".to_string());
    }

    println!("Starting monitoring on: {}", path);
    let api_key = config::api_key().map_err(|e| e.to_string())?;
    let model = config::DEFAULT_MODEL.to_string();
    let host = config::DEFAULT_HOST.to_string();
    
    watcher.start(app, path, api_key, model, host);

    Ok(())
}

#[tauri::command]
async fn stop_monitoring(watcher: tauri::State<'_, WatcherSupervisor>) -> Result<(), String> {
    watcher.stop();
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
    device_code: String,
    auth_state: tauri::State<'_, AuthState>,
) -> Result<auth::github::GithubUser, String> {
    let client_id = config::github_client_id().map_err(|e| e.to_string())?;
    let client_secret = config::github_client_secret();
    let session = auth::github::complete_device_flow(&client_id, client_secret.as_deref(), &device_code)
        .await
        .map_err(|e| e.to_string())?;

    let user = session.user.clone();
    auth_state.set_session(session);
    Ok(user)
}

#[tauri::command]
async fn logout_github(auth_state: tauri::State<'_, AuthState>) -> Result<(), String> {
    auth_state.clear();
    Ok(())
}

#[tauri::command]
async fn get_auth_session(auth_state: tauri::State<'_, AuthState>) -> Result<Option<AuthSessionView>, String> {
    Ok(auth_state.get_user().map(|user| AuthSessionView { user }))
}

#[tauri::command]
async fn apply_fix(
    state_bus: tauri::State<'_, Arc<kernel::bus::EventBus>>, 
    file_path: String, 
    new_content: String
) -> Result<String, String> {
    println!("Autopilot: Fix Requested for {}. Initiating Governance Review...", file_path);
    
    // Publish RequestReview event to the Kernel
    state_bus.publish(kernel::bus::GuardianEvent::RequestReview { 
        file_path: file_path.clone(), 
        diff: new_content 
    }).await;

    Ok("Governance Review Initiated...".to_string())
}

#[tauri::command]
async fn confirm_fix(file_path: String, new_content: String, root: String) -> Result<String, String> {
    println!("Autopilot: Fix Confirmed. Applying to {}", file_path);
    patcher::apply_patch(&file_path, &new_content, &root)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ask_guru(path: String, query: String) -> Result<String, String> {
    // 1. Get Context via RagLite
    let context = rag_lite::search_context(&path, &query);
    
    // 2. Init AI Client
    let api_key = config::api_key().map_err(|e| e.to_string())?;
    let model = config::DEFAULT_MODEL.to_string();
    let host = config::DEFAULT_HOST.to_string();
    let client = ai_client::OllamaClient::new(host, model, api_key);

    // 3. Ask
    client.ask_question(&context, &query).await.map_err(|e| e.to_string())
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
async fn search_web(query: String) -> Result<String, String> {
    println!("Guardian: Searching Web for '{}'", query);
    let searcher = skills::web_search::WebSearch::new();
    searcher.search(&query).await
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> AnyhowResult<()> {
    // 0. Initialize Environment Variables
    dotenvy::dotenv().ok();

    // 1. Initialize Memory (Storage)
    let home = dirs::home_dir().context("Could not find home directory")?;
    let storage = Arc::new(Mutex::new(
        storage::StorageManager::init(&home.to_string_lossy())
        .context("CRITICAL: Failed to initialize Guardian Memory (SQLite)")?
    ));

    println!("Guardian Memory Initialized at ~/.guardian/memory.db");
    
 

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
            let handle = app.handle().clone();
            
            // Spawn Orchestrator Here where we have the Handle
            tauri::async_runtime::spawn(async move {
                match skills::orchestrator::AgentOrchestrator::new(
                    bus_clone,
                    storage_clone,
                    handle
                ) {
                    Ok(orchestrator) => {
                        orchestrator.run().await;
                    }
                    Err(err) => {
                        eprintln!("Orchestrator init failed: {}", err);
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
            apply_fix,
            ask_guru,
            search_web,
            confirm_fix,
            ping,
            get_project_context
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
    use tempfile::tempdir;

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
}
