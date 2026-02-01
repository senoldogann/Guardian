
mod watcher;
mod ai_client;
// V2 Modules
mod executor;
mod context;
mod config;
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
use anyhow::{Context, Result as AnyhowResult};


#[tauri::command]
async fn start_monitoring(app: AppHandle, path: String) -> Result<(), String> {
    println!("Starting monitoring on: {}", path);
    let api_key = config::api_key().map_err(|e| e.to_string())?;
    let model = config::DEFAULT_MODEL.to_string();
    let host = config::DEFAULT_HOST.to_string();
    
    tauri::async_runtime::spawn(async move {
        watcher::start_watching(app, path, api_key, model, host).await;
    });

    Ok(())
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

// request_fix_review is now redundant if apply_fix does the same thing, 
// but keeping it if we want explicit separation later. 
// For now, let's strictly use apply_fix as the entry point from UI to keep UI changes minimal.
#[tauri::command]
async fn request_fix_review(state_bus: tauri::State<'_, Arc<kernel::bus::EventBus>>, file_path: String, new_content: String) -> Result<String, String> {
     state_bus.publish(kernel::bus::GuardianEvent::RequestReview { 
        file_path: file_path.clone(), 
        diff: new_content 
    }).await;
    Ok("Review Started".to_string())
}

#[tauri::command]
async fn confirm_fix(file_path: String, new_content: String) -> Result<String, String> {
    println!("Autopilot: Fix Confirmed. Applying to {}", file_path);
    patcher::apply_patch(&file_path, &new_content)
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
        .invoke_handler(tauri::generate_handler![start_monitoring, apply_fix, ask_guru, search_web, request_fix_review, confirm_fix, get_project_context])
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
        
        let res = patcher::apply_patch(path_str, new_content);
        assert!(res.is_ok(), "Patch failed: {:?}", res);

        let final_content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(final_content, new_content);
        
        // Cleanup
        let _ = fs::remove_file(&file_path);
    }

    #[test]
    fn test_patcher_file_not_found() {
        let res = patcher::apply_patch("/tmp/this_file_does_not_exist_12345.txt", "content");
        assert!(res.is_err());
        let err_msg = res.unwrap_err().to_string();
        assert!(err_msg.contains("Security Violation"));
    }
}
