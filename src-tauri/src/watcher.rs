use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::time::{Duration, Instant};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tokio::time::sleep;
use tokio::sync::{Semaphore};
use crate::ai_client::OllamaClient;
use crate::context::ProjectContext;
use crate::executor;
use crate::history_logger::append_history_log;
use crate::storage::StorageManager;
use tauri::{AppHandle, Emitter, Manager};
use std::io::Write;
use std::fs;
use once_cell::sync::Lazy;
use serde_json::json;
use sha2::{Sha256, Digest};
use hex;

// GLOBAL STATE for active critiques to enable "real-time sync/delete"
static ACTIVE_CRITIQUES: Lazy<Arc<Mutex<HashMap<String, crate::ai_client::Critique>>>> = Lazy::new(|| {
    Arc::new(Mutex::new(HashMap::new()))
});

#[allow(dead_code)]
pub struct WatcherState {
    pub last_events: HashMap<PathBuf, Instant>,
}

pub async fn start_watching(
    app: AppHandle,
    target_path: String,
    api_key: String,
    model: String,
    host: String,
) {
    let (batch_tx, batch_rx) = tokio::sync::mpsc::channel(100);
    
    let client = Arc::new(OllamaClient::new(host, model, api_key));
    let debouncer = Arc::new(Mutex::new(HashMap::new()));
    let _semaphore = Arc::new(Semaphore::new(2)); 
    
    let project_context = Arc::new(ProjectContext::index_path(&target_path));
    println!("Cognitive Indexing Complete: {} files found.", project_context.total_files);

    println!("Guardian Watcher started on: {}", target_path);

    // UNIVERSAL BOOTSTRAP: Neuro-Link
    let guardian_path = Path::new(&target_path).join(".guardian");
    if !guardian_path.exists() {
        let _ = fs::create_dir_all(&guardian_path);
    }
    let chat_link_path = guardian_path.join("chat.md");
    if !chat_link_path.exists() {
        let welcome_msg = r#"# Guardian Neuro-Link
> PROTIP: Write here to talk to Guardian directly.

**User**: System Check.
**Guardian**: I am listening.
"#;
        let _ = fs::write(&chat_link_path, welcome_msg);
    }

    // Spawn Batch Processor
    let batch_app = app.clone();
    let batch_client = client.clone();
    let batch_ctx = project_context.clone();
    let batch_root = target_path.clone();
    tokio::spawn(async move {
        batch_processing_loop(batch_rx, batch_app, batch_client, batch_ctx, batch_root).await;
    });

    // UX IMPROVEMENT: Initial Scan
    let scan_root = target_path.clone();
    let scan_app = app.clone();
    let scan_tx = batch_tx.clone();

    tokio::task::spawn_blocking(move || {
        println!("Performing Initial Scan...");
        let walker = ignore::WalkBuilder::new(&scan_root)
            .hidden(false) 
            .git_ignore(true)
            .build();

        let mut count = 0;
        for result in walker {
            if count > 200 { break; } 
            if let Ok(entry) = result {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    let path = entry.path().to_path_buf();
                    let path_str = path.to_string_lossy().to_string();
                    
                    // Comprehensive ignore list for non-essential files
                    if path_str.contains(".git") || path_str.contains("target") || path_str.contains("node_modules") ||
                       path_str.contains("_library") || path_str.contains(".agent") || path_str.contains(".shared") ||
                       path_str.contains("build") || path_str.contains("dist") || path_str.contains(".vscode") ||
                       path_str.contains("benchmarks") || path_str.contains(".next") || path_str.contains("coverage") ||
                       path_str.ends_with(".css") || path_str.ends_with(".json") || path_str.ends_with(".md") ||
                       path_str.ends_with(".patch") || path_str.ends_with(".lock") || path_str.ends_with(".log") ||
                       path_str.contains(".guardian") {
                        continue;
                    }

                    // Pre-process (Hash Check) -> Send to Batch
                    let a_app = scan_app.clone();
                    let a_tx = scan_tx.clone();
                    let a_path = path;
                    
                    tokio::spawn(async move {
                         audit_file_logic(a_path, a_app, a_tx).await;
                    });
                    
                    count += 1;
                    std::thread::sleep(Duration::from_millis(20)); // Gentle pacing
                }
            }
        }
    });

    // Notify Watcher Setup
    let (tx, rx) = channel();
    // Result Handling (SPAP v2.2): Avoid .expect() in production paths
    let mut watcher = match RecommendedWatcher::new(
        move |res| {
            if let Err(e) = tx.send(res) {
                eprintln!("[Watcher] Internal Send Error: {}", e);
            }
        },
        Config::default(),
    ) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[Watcher] Initialization Failure: {}", e);
            return;
        }
    };

    if let Err(e) = watcher.watch(Path::new(&target_path), RecursiveMode::Recursive) {
        eprintln!("[Watcher] Watch Start Failure: {}", e);
        return;
    }
    // The original line `watcher.watch(Path::new(&target_path), RecursiveMode::Recursive).expect("Failed to start watching path");`
    // is replaced by the new error-handling block above.

    let watch_app = app.clone();
    let watch_tx = batch_tx.clone();
    let watch_debouncer = debouncer.clone();

    tokio::task::spawn_blocking(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    handle_event(event, watch_app.clone(), watch_debouncer.clone(), watch_tx.clone());
                },
                Err(e) => println!("watch error: {:?}", e),
            }
        }
    });

    loop {
        sleep(Duration::from_secs(10)).await;
    }
}

fn handle_event(
    event: Event, 
    app: AppHandle, 
    debouncer: Arc<Mutex<HashMap<PathBuf, Instant>>>,
    tx: tokio::sync::mpsc::Sender<BatchItem>,
) {
    if !event.kind.is_modify() {
        return;
    }

    for path in event.paths {
        let path_str = path.display().to_string();
        
        let is_chat = path_str.contains("chat.md");
        // Comprehensive ignore list for file watcher
        if !is_chat && (
           path_str.contains(".git") || 
           path_str.contains("target") || path_str.contains("node_modules") ||
           path_str.contains("_library") || path_str.contains(".agent") || path_str.contains(".shared") ||
           path_str.contains("build") || path_str.contains("dist") || path_str.contains(".vscode") ||
           path_str.contains("benchmarks") || path_str.contains(".next") || path_str.contains("coverage") ||
           path_str.ends_with(".css") || path_str.ends_with(".json") || path_str.ends_with(".md") ||
           path_str.ends_with(".patch") || path_str.ends_with(".lock") || path_str.ends_with(".log") ||
           path_str.contains(".guardian")
        ) {
            continue;
        }

        if path_str.ends_with(".guardian/chat.md") {
            println!("Neuro-Link: Chat detected!");
            app.emit("guardian:analyzing", "Neuro-Link: Processing...".to_string()).ok();
        }
        
        // Debounce Logic
        let now = Instant::now();
        {
            // SAFETY: Handle std::sync::Mutex poisoning gracefully
            let mut map = match debouncer.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    eprintln!("[WARN] Mutex was poisoned, recovering gracefully");
                    poisoned.into_inner()
                }
            };
            
            let cooldown = if let Some(last_time) = map.get(&path) {
                let diff = now.duration_since(*last_time).as_secs();
                if diff < 10 { 10 } else { 5 }
            } else { 5 };

            if let Some(last_time) = map.get(&path) {
                if now.duration_since(*last_time).as_secs() < cooldown {
                    return; 
                }
            }
            map.insert(path.clone(), now);
        }

        println!("Detected change: {:?}", path);
        app.emit("guardian:analyzing", path.to_string_lossy().to_string()).ok();
        
        let a_app = app.clone();
        let a_tx = tx.clone();
        tokio::spawn(async move {
            audit_file_logic(path, a_app, a_tx).await;
        });
    }
}

#[derive(Clone)]
struct BatchItem {
    path: PathBuf,
    content: String,
    hash: String,
}

async fn batch_processing_loop(
    mut rx: tokio::sync::mpsc::Receiver<BatchItem>,
    app: AppHandle,
    client: Arc<OllamaClient>,
    _context: Arc<ProjectContext>,
    root: String,
) {
    let mut batch: Vec<BatchItem> = Vec::new();
    let flush_interval = Duration::from_secs(5); // 5s timeout
    let mut interval = tokio::time::interval(flush_interval);

    loop {
        tokio::select! {
            _ = interval.tick() => {
                if !batch.is_empty() {
                    process_batch(&mut batch, &app, &client, &root).await;
                }
            },
            Some(item) = rx.recv() => {
                // Add to batch
                if !batch.iter().any(|i| i.path == item.path) { // Dedup
                     batch.push(item);
                }

                if batch.len() >= 3 {
                    // FLUSH
                    process_batch(&mut batch, &app, &client, &root).await;
                    interval.reset();
                }
            }
        }
    }
}

async fn process_batch(
    batch: &mut Vec<BatchItem>,
    app: &AppHandle,
    client: &Arc<OllamaClient>,
    root: &str,
) {
    if batch.is_empty() { return; }

    println!("Batch Processor: Flushing {} files...", batch.len());
    
    // Prepare Prompt Data
    let mut prompt_data = Vec::new();
    for item in batch.iter() {
        // Truncate logic
        let truncated = if item.content.len() > 10000 {
             format!("{}... (truncated)", &item.content[0..10000])
        } else {
             item.content.clone()
        };
        prompt_data.push((item.path.to_string_lossy().to_string(), truncated));
    }

    // Call AI
    match client.analyze_batch(prompt_data).await {
        Ok(critiques) => {
            let mut active_lock = match ACTIVE_CRITIQUES.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    eprintln!("[WARN] ACTIVE_CRITIQUES mutex poisoned, recovering");
                    poisoned.into_inner()
                }
            };
            let storage_state = app.state::<Arc<Mutex<StorageManager>>>();
            
            // Process Results
            for critique in critiques {
                 // Critiques for specific files
                 let path_key = critique.file_path.clone();
                 if critique.message.to_uppercase().trim() == "LGTM" {
                      active_lock.remove(&path_key);
                      app.emit("guardian:clear", path_key).ok();
                 } else {
                      active_lock.insert(path_key.clone(), critique.clone());
                      app.emit("guardian:critique", critique.clone()).ok();
                      append_history_log(root, &critique);

                      // Autonomous Verification Trigger
                      if critique.severity == "Critical" && critique.message != "LGTM" {
                           let r_clone = root.to_string();
                           let a_clone = app.clone();
                           std::thread::spawn(move || {
                               a_clone.emit("guardian:analyzing", "Running Automatic Verification...".to_string()).ok();
                               let verify_res = executor::auto_verify_project(&r_clone);
                               match verify_res {
                                   Ok(msg) => {
                                       if msg.contains("Passed") {
                                           a_clone.emit("guardian:info", format!("VERIFICATION PASSED: {}", msg)).ok();
                                       }
                                   },
                                   Err(err) => {
                                       a_clone.emit("guardian:error", format!("COMPILER/LINT CONFIRMED: {}", err)).ok();
                                   }
                               }
                           });
                      }
                 }
            }
            
            // SUCCESS: Update Hashes for ALL items in batch
            // Even if no critique returned (LGTM implicit), we update hash
            if let Ok(storage) = storage_state.lock() {
                for item in batch.iter() {
                    let _ = storage.update_file_hash(&item.path.to_string_lossy(), &item.hash);
                    println!("Memory Guard: Hash Updated -> {:?}", item.path);
                }
            }
            
            sync_guardian_logs(root, &active_lock);
            app.emit("guardian:usage", json!({ "tokens": 0, "calls": batch.len() })).ok();
        },
        Err(e) => {
             println!("Batch Audit Failed: {}", e);
             app.emit("guardian:error", format!("Batch Audit Failed. Check logs. error: {}", e)).ok();
             // Still count the usage because we made the call
             app.emit("guardian:usage", json!({ "tokens": 0, "calls": batch.len() })).ok();
        }
    }
    
    batch.clear();
}

// Replaces analyze_file
async fn audit_file_logic(
    path: PathBuf,
    app: AppHandle,
    tx: tokio::sync::mpsc::Sender<BatchItem>,
) {
    let content_res = std::fs::read_to_string(&path);
    if let Ok(content) = content_res {
        // 1. Hash Check
        let current_hash = calculate_hash(&content);
        let storage_state = app.state::<Arc<Mutex<StorageManager>>>();
        
        let should_audit = {
            if let Ok(storage) = storage_state.lock() {
                // If check_file_hash returns Ok(true), it matches -> Skip
                // If Ok(false) -> New/Changed -> Audit
                if let Ok(true) = storage.check_file_hash(&path.to_string_lossy(), &current_hash) {
                    println!("Memory Guard: Skipping unchanged file -> {:?}", path);
                    app.emit("guardian:info", format!("Skipped (Unchanged): {:?}", path.file_name().unwrap_or_default())).ok();
                    false
                } else {
                    true
                }
            } else {
                true // Fail safe
            }
        };

        if should_audit {
             println!("Auditing Change: {:?}", path);
             let item = BatchItem {
                 path,
                 content,
                 hash: current_hash
             };
             let _ = tx.send(item).await;
        }
    }
}

fn sync_guardian_logs(root: &str, critiques: &HashMap<String, crate::ai_client::Critique>) {
    let root_path = Path::new(root);
    let guardian_dir = root_path.join(".guardian");
    
    if !guardian_dir.exists() {
        let _ = fs::create_dir_all(&guardian_dir);
    }

    let critiques_path = guardian_dir.join("critiques.md");
    let chat_path = guardian_dir.join("chat_queue.md");

    // Rewrite critiques.md
    if let Ok(mut file) = fs::File::create(&critiques_path) {
        let _ = writeln!(file, "# Guardian Active Critiques\n*Last Updated: {:?}\n", Instant::now());
        for (path, c) in critiques {
            let _ = writeln!(file, "---\n### {}\n**Severity**: {}\n**Message**: {}\n**Suggestion**: {:?}\n", 
                path, c.severity, c.message, c.suggestion);
        }
    }

    // Rewrite chat_queue.md
    if let Ok(mut file) = fs::File::create(&chat_path) {
        let _ = writeln!(file, "# Guardian Chat Bridge\n");
        for c in critiques.values() {
            if let Some(msg) = &c.chat_message {
                let _ = writeln!(file, "> {}\n", msg);
            }
        }
    }
    
    // DEFENSIVE CLEANUP: Ensure root files are gone
    let _ = fs::remove_file(root_path.join(".guardian_critiques.md"));
    let _ = fs::remove_file(root_path.join(".guardian_chat_queue.md"));
}

fn calculate_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}
