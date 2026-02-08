use crate::ai_client::AiClient;
use crate::config;
use crate::context::ProjectContext;
use crate::executor;
use crate::history_logger::append_history_log;
use crate::storage::StorageManager;
use chrono::Utc;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Semaphore;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

// GLOBAL STATE for active critiques to enable "real-time sync/delete"
// OPTIMIZATION: Using RwLock instead of Mutex for better read concurrency
static ACTIVE_CRITIQUES: Lazy<Arc<RwLock<HashMap<String, crate::ai_client::Critique>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

const NON_LOGIC_EXTENSIONS: &[&str] = &[
    "css", "json", "md", "svg", "lock", "log", "patch", "png", "jpg", "jpeg", "gif", "ico",
];

const IGNORED_PATH_MARKERS: &[&str] = &[
    ".git",
    "target",
    "node_modules",
    "_library",
    ".agent",
    ".shared",
    "build",
    "dist",
    ".vscode",
    "benchmarks",
    ".next",
    "coverage",
    ".guardian",
    "docs/legacy",
    ".env",
];

// Note: Configuration constants moved to config.rs, accessed via config::*() functions

fn is_significant_warning(critique: &crate::ai_client::Critique) -> bool {
    let msg = critique.message.to_lowercase();
    let suggestion = critique
        .suggestion
        .as_ref()
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let combined = format!("{} {}", msg, suggestion);

    let keywords = [
        "security",
        "vulnerability",
        "exploit",
        "injection",
        "auth",
        "permission",
        "leak",
        "secret",
        "credential",
        "token",
        "password",
        "path traversal",
        "privilege",
        "sandbox",
        "memory",
        "overflow",
        "corruption",
        "data loss",
        "deadlock",
        "race",
        "infinite",
        "crash",
        "panic",
        "performance",
        "latency",
        "architectural",
        "srp",
        "god component",
        "dependency",
        "supply chain",
    ];

    keywords.iter().any(|k| combined.contains(k))
}

fn should_surface_critique(critique: &crate::ai_client::Critique) -> bool {
    let severity = critique.severity.to_lowercase();
    if severity == "critical" {
        return true;
    }
    if severity == "warning" {
        return is_significant_warning(critique);
    }
    false
}

#[derive(Clone, Copy)]
struct DebounceState {
    last_event: Instant,
    last_emit: Instant,
    burst_count: u32,
}

#[derive(Clone)]
struct StallInfo {
    file_path: String,
    reason: String,
}

fn is_guardian_chat(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    path_str.ends_with(".guardian/chat.md") || path_str.ends_with(".guardian\\chat.md")
}

fn has_ignored_marker(path: &str) -> bool {
    IGNORED_PATH_MARKERS
        .iter()
        .any(|marker| path.contains(marker))
}

fn is_non_logic_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lowered = ext.to_lowercase();
            NON_LOGIC_EXTENSIONS.contains(&lowered.as_str())
        })
        .unwrap_or(false)
}

fn safe_path_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "<unknown>".to_string())
}

pub(crate) fn should_skip_path(path: &Path, is_chat: bool) -> bool {
    if is_chat {
        return false;
    }

    let path_str = path.to_string_lossy();
    if has_ignored_marker(&path_str) {
        return true;
    }

    is_non_logic_extension(path)
}

#[allow(dead_code)]
pub struct WatcherState {
    pub last_events: HashMap<PathBuf, Instant>,
}

#[derive(Clone)]
pub struct WatcherRuntimeConfig {
    pub target_path: String,
    pub api_key: String,
    pub model: String,
    pub host: String,
    pub provider_id: String,
    pub auto_verify_enabled: bool,
}

pub async fn start_watching(
    app: AppHandle,
    config: WatcherRuntimeConfig,
    shutdown: Arc<AtomicBool>,
) {
    let WatcherRuntimeConfig {
        target_path,
        api_key,
        model,
        host,
        provider_id,
        auto_verify_enabled,
    } = config;

    let (batch_tx, batch_rx) = tokio::sync::mpsc::channel(100);

    let client = match AiClient::new(provider_id, host, model, api_key.into()) {
        Ok(client) => Arc::new(client),
        Err(err) => {
            error!(target: "guardian::watcher", "Failed to init AI client: {}", err);
            app.emit("guardian:info", format!("AI client init failed: {}", err))
                .ok();
            return;
        }
    };
    let debouncer: Arc<Mutex<HashMap<PathBuf, DebounceState>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let semaphore = Arc::new(Semaphore::new(4));

    let project_context = Arc::new(ProjectContext::index_path(&target_path));
    info!(target: "guardian::watcher", "Cognitive indexing complete: {} files", project_context.total_files);

    info!(target: "guardian::watcher", "Watcher started on: {}", target_path);

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
        let _ = tokio::fs::write(&chat_link_path, welcome_msg).await;
    }

    // Spawn Batch Processor
    let batch_app = app.clone();
    let batch_client = client.clone();
    let batch_ctx = project_context.clone();
    let batch_root = target_path.clone();
    let batch_auto_verify_enabled = auto_verify_enabled;
    let batch_shutdown = shutdown.clone();
    tokio::spawn(async move {
        batch_processing_loop(
            batch_rx,
            batch_app,
            batch_client,
            batch_ctx,
            batch_root,
            batch_auto_verify_enabled,
            batch_shutdown,
        )
        .await;
    });

    // UX IMPROVEMENT: Initial Scan
    let scan_root = target_path.clone();
    let scan_app = app.clone();
    let scan_tx = batch_tx.clone();

    let scan_shutdown = shutdown.clone();
    let scan_semaphore = semaphore.clone();
    tokio::task::spawn_blocking(move || {
        info!(target: "guardian::watcher", "Performing initial scan");
        let walker = ignore::WalkBuilder::new(&scan_root)
            .hidden(false)
            .git_ignore(true)
            .build();

        let mut count = 0;
        for result in walker {
            if scan_shutdown.load(Ordering::Relaxed) {
                break;
            }
            if count > 200 {
                break;
            }
            if let Ok(entry) = result {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    let path = entry.path().to_path_buf();
                    let is_chat = is_guardian_chat(&path);
                    if should_skip_path(&path, is_chat) {
                        continue;
                    }

                    // Pre-process (Hash Check) -> Send to Batch
                    let a_app = scan_app.clone();
                    let a_tx = scan_tx.clone();
                    let a_sem = scan_semaphore.clone();
                    let a_path = path;

                    tokio::spawn(async move {
                        audit_file_logic(a_path, a_app, a_tx, a_sem).await;
                    });

                    count += 1;
                    std::thread::sleep(Duration::from_millis(20));
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
                error!(target: "guardian::watcher", "Internal send error: {}", e);
            }
        },
        Config::default(),
    ) {
        Ok(w) => w,
        Err(e) => {
            error!(target: "guardian::watcher", "Initialization failure: {}", e);
            return;
        }
    };

    if let Err(e) = watcher.watch(Path::new(&target_path), RecursiveMode::Recursive) {
        error!(target: "guardian::watcher", "Watch start failure: {}", e);
        return;
    }
    // The original line `watcher.watch(Path::new(&target_path), RecursiveMode::Recursive).expect("Failed to start watching path");`
    // is replaced by the new error-handling block above.

    let watch_app = app.clone();
    let watch_root = target_path.clone();
    let watch_tx = batch_tx.clone();
    let watch_debouncer = debouncer.clone();
    let watch_semaphore = semaphore.clone();
    let watch_shutdown = shutdown.clone();

    tokio::task::spawn_blocking(move || {
        use std::sync::mpsc::RecvTimeoutError;
        loop {
            if watch_shutdown.load(Ordering::Relaxed) {
                break;
            }

            match rx.recv_timeout(Duration::from_millis(400)) {
                Ok(res) => match res {
                    Ok(event) => {
                        handle_event(
                            event,
                            watch_root.clone(),
                            watch_app.clone(),
                            watch_debouncer.clone(),
                            watch_tx.clone(),
                            watch_semaphore.clone(),
                        );
                    }
                    Err(e) => warn!(target: "guardian::watcher", "Watch error: {:?}", e),
                },
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    while !shutdown.load(Ordering::Relaxed) {
        sleep(Duration::from_secs(10)).await;
    }
}

fn handle_event(
    event: Event,
    root: String,
    app: AppHandle,
    debouncer: Arc<Mutex<HashMap<PathBuf, DebounceState>>>,
    tx: tokio::sync::mpsc::Sender<BatchItem>,
    semaphore: Arc<Semaphore>,
) {
    let should_audit = event.kind.is_modify() || event.kind.is_create();
    let should_clear = event.kind.is_remove();

    if !should_audit && !should_clear {
        return;
    }

    for path in event.paths {
        let is_chat = is_guardian_chat(&path);

        if should_clear || !path.exists() {
            let path_key = path.to_string_lossy().to_string();

            if let Ok(mut lock) = ACTIVE_CRITIQUES.write() {
                if lock.remove(&path_key).is_some() {
                    app.emit("guardian:clear", path_key.clone()).ok();
                }
            }

            let storage_state = app.state::<Arc<Mutex<StorageManager>>>();
            if let Ok(storage) = storage_state.lock() {
                let _ = storage.remove_file_hash(&path_key);
            }

            append_agent_event(
                &root,
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "clear",
                    "file_path": path_key,
                    "reason": "removed"
                }),
            );

            continue;
        }

        if should_skip_path(&path, is_chat) {
            continue;
        }

        if is_chat {
            debug!(target: "guardian::watcher", "Neuro-Link: Chat detected");
            app.emit(
                "guardian:analyzing",
                "Neuro-Link: Processing...".to_string(),
            )
            .ok();
        }

        // Adaptive Debounce Logic (vibe coding throttling)
        let now = Instant::now();
        {
            // SAFETY: Handle std::sync::Mutex poisoning gracefully
            let mut map = match debouncer.lock() {
                Ok(guard) => guard,
                Err(poisoned) => {
                    warn!(target: "guardian::watcher", "Mutex was poisoned, recovering with caution");
                    // Log the incident for monitoring
                    error!(target: "guardian::watcher", "Mutex poison detected - this may indicate a panic in the debouncer logic");
                    poisoned.into_inner()
                }
            };

            let entry = map.entry(path.clone()).or_insert(DebounceState {
                last_event: now,
                last_emit: now - Duration::from_secs(60),
                burst_count: 0,
            });

            let since_last = now.duration_since(entry.last_event);
            if since_last < Duration::from_millis(900) {
                entry.burst_count = entry.burst_count.saturating_add(1);
            } else {
                entry.burst_count = 0;
            }
            entry.last_event = now;

            let cooldown_secs = if entry.burst_count >= 5 {
                12
            } else if entry.burst_count >= 2 {
                6
            } else {
                2
            };

            if now.duration_since(entry.last_emit) < Duration::from_secs(cooldown_secs) {
                continue;
            }
            entry.last_emit = now;
        }

        debug!(target: "guardian::watcher", "Detected change: {:?}", path);
        app.emit("guardian:analyzing", path.to_string_lossy().to_string())
            .ok();

        let a_app = app.clone();
        let a_tx = tx.clone();
        let a_sem = semaphore.clone();
        tokio::spawn(async move {
            audit_file_logic(path, a_app, a_tx, a_sem).await;
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
    client: Arc<AiClient>,
    _context: Arc<ProjectContext>,
    root: String,
    auto_verify_enabled: bool,
    shutdown: Arc<AtomicBool>,
) {
    let mut batch: Vec<BatchItem> = Vec::new();
    let flush_interval = Duration::from_secs(5); // 5s timeout
    let mut interval = tokio::time::interval(flush_interval);
    let mut last_request = Instant::now() - Duration::from_secs(10);

    loop {
        if shutdown.load(Ordering::Relaxed) {
            break;
        }
        tokio::select! {
            _ = interval.tick() => {
                if !batch.is_empty() {
                    process_batch(
                        &mut batch,
                        &app,
                        &client,
                        &root,
                        auto_verify_enabled,
                        &mut last_request,
                    )
                    .await;
                }
            },
            Some(item) = rx.recv() => {
                // Add to batch
                if !batch.iter().any(|i| i.path == item.path) { // Dedup
                     batch.push(item);
                }

                if batch.len() >= config::max_batch_size() {
                    // FLUSH
                    process_batch(
                        &mut batch,
                        &app,
                        &client,
                        &root,
                        auto_verify_enabled,
                        &mut last_request,
                    )
                    .await;
                    interval.reset();
                }
            }
        }
    }
}

async fn process_batch(
    batch: &mut Vec<BatchItem>,
    app: &AppHandle,
    client: &Arc<AiClient>,
    root: &str,
    auto_verify_enabled: bool,
    last_request: &mut Instant,
) {
    if batch.is_empty() {
        return;
    }

    let elapsed = last_request.elapsed();
    let min_batch_interval = Duration::from_secs(config::min_batch_interval_secs());
    if elapsed < min_batch_interval {
        sleep(min_batch_interval - elapsed).await;
    }

    let items = std::mem::take(batch);
    info!(target: "guardian::watcher", "Batch processor flushing {} files", items.len());

    // Prepare Prompt Data
    let (prompt_data, estimated_tokens, hash_by_path) = build_prompt_data(&items);

    let mut attempt = 0;
    loop {
        let call = client.analyze_batch(prompt_data.clone()).await;
        *last_request = Instant::now();
        match call {
            Ok(critiques) => {
                handle_critiques(
                    app,
                    root,
                    &items,
                    &hash_by_path,
                    critiques,
                    estimated_tokens,
                    auto_verify_enabled,
                );
                return;
            }
            Err(e) => {
                let err = e.to_string();
                if is_rate_limit_error(&err) && attempt < config::rate_limit_retries() {
                    let backoff = Duration::from_secs(
                        config::rate_limit_backoff_secs().saturating_mul((attempt + 1) as u64),
                    );
                    app.emit(
                        "guardian:warning",
                        format!("Rate limited. Retrying in {}s...", backoff.as_secs()),
                    )
                    .ok();
                    sleep(backoff).await;
                    attempt += 1;
                    continue;
                }

                if is_token_limit_error(&err) && items.len() > 1 {
                    app.emit(
                        "guardian:warning",
                        "Batch too large. Falling back to per-file audit.".to_string(),
                    )
                    .ok();
                    for item in items {
                        let single_items = vec![item.clone()];
                        let (single_prompt, single_tokens, single_hash) =
                            build_prompt_data(&single_items);
                        match client.analyze_batch(single_prompt).await {
                            Ok(critiques) => {
                                handle_critiques(
                                    app,
                                    root,
                                    &single_items,
                                    &single_hash,
                                    critiques,
                                    single_tokens,
                                    auto_verify_enabled,
                                );
                            }
                            Err(err) => {
                                app.emit(
                                    "guardian:warning",
                                    format!("Single-file audit failed. {}", err),
                                )
                                .ok();
                            }
                        }
                        *last_request = Instant::now();
                    }
                    return;
                }

                error!(target: "guardian::watcher", "Batch audit failed: {}", err);
                app.emit("guardian:warning", format!("Batch audit failed. {}", err))
                    .ok();
                // Still count the usage because we made the call
                app.emit(
                    "guardian:usage",
                    json!({ "tokens": estimated_tokens, "calls": items.len() }),
                )
                .ok();
                return;
            }
        }
    }
}

fn handle_critiques(
    app: &AppHandle,
    root: &str,
    items: &[BatchItem],
    hash_by_path: &HashMap<String, String>,
    critiques: Vec<crate::ai_client::Critique>,
    estimated_tokens: u64,
    auto_verify_enabled: bool,
) {
    // OPTIMIZATION: Use write lock only when necessary
    let mut active_lock = match ACTIVE_CRITIQUES.write() {
        Ok(guard) => guard,
        Err(poisoned) => {
            warn!(target: "guardian::watcher", "ACTIVE_CRITIQUES rwlock poisoned, recovering");
            poisoned.into_inner()
        }
    };
    let storage_state = app.state::<Arc<Mutex<StorageManager>>>();

    let mut critical_info: Option<StallInfo> = None;
    // Process Results
    for critique in critiques {
        // Critiques for specific files
        let path_key = critique.file_path.clone();
        if critique.message.to_uppercase().trim() == "LGTM" {
            active_lock.remove(&path_key);
            app.emit("guardian:clear", path_key.clone()).ok();
            append_agent_event(
                root,
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "clear",
                    "file_path": path_key
                }),
            );
        } else if !should_surface_critique(&critique) {
            if active_lock.remove(&path_key).is_some() {
                app.emit("guardian:clear", path_key.clone()).ok();
                append_agent_event(
                    root,
                    &json!({
                        "timestamp": Utc::now().to_rfc3339(),
                        "event": "clear",
                        "file_path": path_key,
                        "reason": "suppressed"
                    }),
                );
            }
        } else {
            active_lock.insert(path_key.clone(), critique.clone());
            app.emit("guardian:critique", critique.clone()).ok();
            append_history_log(root, &critique);
            append_agent_event(
                root,
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "critique",
                    "file_path": critique.file_path,
                    "severity": critique.severity,
                    "message": critique.message,
                    "suggestion": critique.suggestion,
                    "suggested_diff": critique.suggested_diff
                }),
            );

            if let Ok(storage) = storage_state.lock() {
                let payload = json!({
                    "file_path": critique.file_path,
                    "severity": critique.severity,
                    "content_hash": hash_by_path.get(&path_key),
                    "timestamp": Utc::now().to_rfc3339()
                });
                let _ = storage.enqueue_telemetry("critique", &payload.to_string());
            }

            // Autonomous Verification Trigger
            if auto_verify_enabled && critique.severity == "Critical" && critique.message != "LGTM"
            {
                if critical_info.is_none() {
                    critical_info = Some(StallInfo {
                        file_path: critique.file_path.clone(),
                        reason: critique.message.clone(),
                    });
                }
                let r_clone = root.to_string();
                let a_clone = app.clone();
                std::thread::spawn(move || {
                    a_clone
                        .emit(
                            "guardian:analyzing",
                            "Running Automatic Verification...".to_string(),
                        )
                        .ok();
                    let verify_res = executor::auto_verify_project(&r_clone);
                    match verify_res {
                        Ok(msg) => {
                            if msg.contains("Passed") {
                                a_clone
                                    .emit("guardian:info", format!("VERIFICATION PASSED: {}", msg))
                                    .ok();
                            }
                        }
                        Err(err) => {
                            a_clone
                                .emit(
                                    "guardian:verification",
                                    format!("Verification failed: {}", err),
                                )
                                .ok();
                        }
                    }
                });
            }
        }
    }

    let stale_paths: Vec<String> = active_lock
        .keys()
        .filter(|p| !Path::new(p.as_str()).exists())
        .cloned()
        .collect();

    for path in stale_paths {
        active_lock.remove(&path);
        app.emit("guardian:clear", path.clone()).ok();
        append_agent_event(
            root,
            &json!({
                "timestamp": Utc::now().to_rfc3339(),
                "event": "clear",
                "file_path": path,
                "reason": "missing_or_moved"
            }),
        );
    }

    // Update hashes after successful audit
    if let Ok(storage) = storage_state.lock() {
        for item in items.iter() {
            let _ = storage.update_file_hash(&item.path.to_string_lossy(), &item.hash);
            debug!(
                target: "guardian::watcher",
                "Memory Guard: hash updated (file={})",
                safe_path_label(&item.path)
            );
        }
    }

    let stall = sync_guardian_logs(root, &active_lock);
    if let Some(stall) = stall.or(critical_info) {
        app.emit(
            "guardian:stall-requested",
            json!({ "file_path": stall.file_path, "reason": stall.reason }),
        )
        .ok();
    } else {
        app.emit("guardian:stall-released", json!({})).ok();
    }

    app.emit(
        "guardian:usage",
        json!({ "tokens": estimated_tokens, "calls": items.len() }),
    )
    .ok();
}

// Replaces analyze_file
async fn audit_file_logic(
    path: PathBuf,
    app: AppHandle,
    tx: tokio::sync::mpsc::Sender<BatchItem>,
    semaphore: Arc<Semaphore>,
) {
    let _permit = semaphore.acquire_owned().await;

    // PII Filter: Skip sensitive files
    if should_exclude_file(&path) {
        debug!(
            target: "guardian::watcher",
            "Skipping sensitive file: {}",
            safe_path_label(&path)
        );
        app.emit(
            "guardian:info",
            format!(
                "Skipped (Sensitive): {:?}",
                path.file_name().unwrap_or_default()
            ),
        )
        .ok();
        return;
    }

    let max_file_bytes = config::max_file_bytes();
    match tokio::fs::metadata(&path).await {
        Ok(meta) => {
            if meta.len() > max_file_bytes {
                debug!(
                    target: "guardian::watcher",
                    "Skipping large file (file={}, size_bytes={}, max_bytes={})",
                    safe_path_label(&path),
                    meta.len(),
                    max_file_bytes
                );
                app.emit(
                    "guardian:info",
                    format!(
                        "Skipped (Large): {:?} ({} KB)",
                        path.file_name().unwrap_or_default(),
                        (meta.len() / 1024).max(1)
                    ),
                )
                .ok();
                return;
            }
        }
        Err(err) => {
            debug!(
                target: "guardian::watcher",
                "Skipping file without metadata (file={}, err={})",
                safe_path_label(&path),
                err
            );
            return;
        }
    }

    let content_res = tokio::fs::read_to_string(&path).await;
    if let Ok(content) = content_res {
        // 1. Hash Check
        let current_hash = calculate_hash(&content);
        let storage_state = app.state::<Arc<Mutex<StorageManager>>>();

        let should_audit = {
            if let Ok(storage) = storage_state.lock() {
                // If check_file_hash returns Ok(true), it matches -> Skip
                // If Ok(false) -> New/Changed -> Audit
                if let Ok(true) = storage.check_file_hash(&path.to_string_lossy(), &current_hash) {
                    debug!(
                        target: "guardian::watcher",
                        "Memory Guard: skipping unchanged file (file={})",
                        safe_path_label(&path)
                    );
                    app.emit(
                        "guardian:info",
                        format!(
                            "Skipped (Unchanged): {:?}",
                            path.file_name().unwrap_or_default()
                        ),
                    )
                    .ok();
                    false
                } else {
                    true
                }
            } else {
                true // Fail safe
            }
        };

        if should_audit {
            debug!(
                target: "guardian::watcher",
                "Auditing change (file={})",
                safe_path_label(&path)
            );
            let item = BatchItem {
                path,
                content,
                hash: current_hash,
            };
            let _ = tx.send(item).await;
        }
    }
}

fn sync_guardian_logs(
    root: &str,
    critiques: &HashMap<String, crate::ai_client::Critique>,
) -> Option<StallInfo> {
    let root_path = Path::new(root);
    let guardian_dir = root_path.join(".guardian");

    if !guardian_dir.exists() {
        let _ = fs::create_dir_all(&guardian_dir);
    }

    let critiques_path = guardian_dir.join("critiques.md");
    let chat_path = guardian_dir.join("chat_queue.md");

    let mut critical_info: Option<StallInfo> = None;

    // Rewrite critiques.md
    if let Ok(mut file) = fs::File::create(&critiques_path) {
        let _ = writeln!(file, "# Guardian Active Critiques");
        let _ = writeln!(file, "Updated: {}\n", Utc::now().to_rfc3339());
        let _ = writeln!(file, "```json");
        for (path, c) in critiques {
            if critical_info.is_none() && c.severity == "Critical" && c.message != "LGTM" {
                critical_info = Some(StallInfo {
                    file_path: path.clone(),
                    reason: c.message.clone(),
                });
            }
            let json_line = json!({
                "file_path": path,
                "severity": c.severity,
                "message": c.message,
                "suggestion": c.suggestion,
                "chat_message": c.chat_message,
                "suggested_diff": c.suggested_diff
            });
            let _ = writeln!(file, "{}", json_line);
        }
        let _ = writeln!(file, "```\n");
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

    let stall_path = guardian_dir.join("STALL");
    if let Some(info) = &critical_info {
        if let Ok(mut file) = fs::File::create(&stall_path) {
            let payload = json!({
                "status": "stalled",
                "file_path": info.file_path,
                "reason": info.reason,
                "updated_at": Utc::now().to_rfc3339()
            });
            let _ = writeln!(file, "{}", payload);
        }
    } else {
        let _ = fs::remove_file(&stall_path);
    }

    // DEFENSIVE CLEANUP: Ensure root files are gone
    let _ = fs::remove_file(root_path.join(".guardian_critiques.md"));
    let _ = fs::remove_file(root_path.join(".guardian_chat_queue.md"));

    critical_info
}

fn calculate_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}

fn append_agent_event(root: &str, payload: &serde_json::Value) {
    let guardian_dir = Path::new(root).join(".guardian");
    if !guardian_dir.exists() {
        let _ = fs::create_dir_all(&guardian_dir);
    }
    let queue_path = guardian_dir.join("agent_queue.jsonl");
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&queue_path)
    {
        let _ = writeln!(file, "{}", payload);
    }
}

fn estimate_tokens(content: &str) -> u64 {
    let rough_tokens = (content.len() as f64 / 4.0).ceil() as u64;
    rough_tokens.max(1)
}

fn build_prompt_data(items: &[BatchItem]) -> (Vec<(String, String)>, u64, HashMap<String, String>) {
    let mut prompt_data = Vec::new();
    let mut estimated_tokens: u64 = 0;
    let mut hash_by_path: HashMap<String, String> = HashMap::new();

    for item in items.iter() {
        let truncated = truncate_content(&item.content);
        estimated_tokens += estimate_tokens(&truncated);
        hash_by_path.insert(item.path.to_string_lossy().to_string(), item.hash.clone());
        prompt_data.push((item.path.to_string_lossy().to_string(), truncated));
    }

    (prompt_data, estimated_tokens, hash_by_path)
}

const SENSITIVE_FILE_NAMES: &[&str] = &[
    ".env",
    ".env.local",
    ".env.production",
    "config.json",
    "secrets.yaml",
    "secrets.yml",
    ".credentials",
    "credentials.json",
];
const SENSITIVE_EXTENSIONS: &[&str] = &["key", "pem", "p12", "pfx", "pkcs12", "jks", "keystore"];

fn should_exclude_file(path: &Path) -> bool {
    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
        if SENSITIVE_FILE_NAMES
            .iter()
            .any(|&name| file_name == name || file_name.ends_with(name))
        {
            return true;
        }
    }
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if SENSITIVE_EXTENSIONS
            .iter()
            .any(|&e| ext.eq_ignore_ascii_case(e))
        {
            return true;
        }
    }
    false
}

fn filter_pii(content: &str) -> String {
    use regex::Regex;
    lazy_static::lazy_static! {
        static ref API_KEY_RE: Regex = Regex::new(r"[A-Za-z0-9_-]{20,}").unwrap();
        static ref EMAIL_RE: Regex = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
        static ref PHONE_RE: Regex = Regex::new(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b").unwrap();
    }

    let mut filtered = content.to_string();
    filtered = API_KEY_RE
        .replace_all(&filtered, "[REDACTED_API_KEY]")
        .to_string();
    filtered = EMAIL_RE
        .replace_all(&filtered, "[REDACTED_EMAIL]")
        .to_string();
    filtered = PHONE_RE
        .replace_all(&filtered, "[REDACTED_PHONE]")
        .to_string();
    filtered
}

fn truncate_content(content: &str) -> String {
    let max_content_lines = config::max_content_lines();
    let max_content_chars = config::max_content_chars();
    let filtered = filter_pii(content);
    let mut lines: Vec<&str> = filtered.lines().collect();
    if lines.len() > max_content_lines {
        lines.truncate(max_content_lines);
    }
    let mut joined = lines.join("\n");
    if joined.len() > max_content_chars {
        joined.truncate(max_content_chars);
        joined.push_str("\n... (truncated)");
    }
    joined
}

fn is_rate_limit_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("too many requests") || lower.contains("rate limit") || lower.contains("429")
}

fn is_token_limit_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("tokens_limit_reached") || lower.contains("request body too large")
}
