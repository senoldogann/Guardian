use crate::ai_client::AiClient;
use crate::config;
use crate::context::ProjectContext;
use crate::executor;
use crate::history_logger::{append_critique_event, append_history_event, HistoryEvent};
use crate::storage::StorageManager;
use chrono::Utc;
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use similar::{ChangeTag, TextDiff};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::fs::OpenOptions;
use std::io::BufRead;
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
static LAST_AUDITED_CONTENTS: Lazy<Arc<RwLock<HashMap<String, String>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

#[derive(Debug, Clone, Serialize)]
pub struct AiContextFile {
    pub file_path: String,
    pub token_estimate: u64,
    pub redacted: bool,
    pub truncated: bool,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiContextSnapshot {
    pub timestamp: String,
    pub root: String,
    pub provider_id: String,
    pub model: String,
    pub tokens_in: u64,
    pub files: Vec<AiContextFile>,
}

static LAST_AI_CONTEXT: Lazy<Arc<RwLock<Option<AiContextSnapshot>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

#[derive(Debug, Clone, Serialize)]
pub struct FixProposal {
    pub proposal_id: String,
    pub timestamp: String,
    pub status: String,
    pub file_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finding_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proposed_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_content_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proposed_content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FixProposalsSnapshot {
    pub timestamp: String,
    pub root: String,
    pub source_path: String,
    pub proposals: Vec<FixProposal>,
}

static LAST_FIX_PROPOSALS: Lazy<Arc<RwLock<Option<FixProposalsSnapshot>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

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

const MAX_AGENT_QUEUE_BYTES: u64 = 1 * 1024 * 1024;
const MAX_AGENT_QUEUE_ARCHIVES: usize = 5;
const FIX_PROPOSALS_DIR: &str = ".guardian-proposals";
const FIX_PROPOSALS_FILE: &str = "fix_proposals.jsonl";
const DIFF_MAX_HUNKS: usize = 6;

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
    let severity = critique.severity.trim().to_lowercase();
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

fn is_fix_proposals_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    if name != FIX_PROPOSALS_FILE {
        return false;
    }
    let Some(parent) = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
    else {
        return false;
    };
    parent == FIX_PROPOSALS_DIR || parent == ".guardian"
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

fn normalize_rel_file_path(workspace_root: &Path, file_path: &str) -> String {
    let input = Path::new(file_path);

    if !input.is_absolute() {
        let rel = file_path.trim().trim_start_matches("./").to_string();
        return rel.replace('\\', "/");
    }

    if let Ok(rel) = input.strip_prefix(workspace_root) {
        return rel
            .to_string_lossy()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string();
    }

    let canonical_root =
        dunce::canonicalize(workspace_root).unwrap_or_else(|_| workspace_root.to_path_buf());
    let canonical_input = dunce::canonicalize(input).unwrap_or_else(|_| input.to_path_buf());
    if let Ok(rel) = canonical_input.strip_prefix(&canonical_root) {
        return rel
            .to_string_lossy()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string();
    }

    file_path.trim().replace('\\', "/")
}

fn fix_proposals_preferred_path(root: &Path) -> PathBuf {
    root.join(FIX_PROPOSALS_DIR).join(FIX_PROPOSALS_FILE)
}

fn fix_proposals_legacy_path(root: &Path) -> PathBuf {
    root.join(".guardian").join(FIX_PROPOSALS_FILE)
}

fn migrate_fix_proposals_if_needed(root: &Path) -> PathBuf {
    let preferred = fix_proposals_preferred_path(root);
    if preferred.exists() {
        return preferred;
    }

    let legacy = fix_proposals_legacy_path(root);
    if !legacy.exists() {
        return preferred;
    }

    if let Some(parent) = preferred.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if fs::rename(&legacy, &preferred).is_ok() {
        return preferred;
    }

    if let Ok(raw) = fs::read(&legacy) {
        if fs::write(&preferred, raw).is_ok() {
            let _ = fs::remove_file(&legacy);
        }
    }

    preferred
}

pub(crate) fn fix_proposals_path_for_root(root: &str) -> PathBuf {
    migrate_fix_proposals_if_needed(Path::new(root))
}

pub(crate) fn refresh_fix_proposals_for_root(root: &str) -> FixProposalsSnapshot {
    let snapshot = load_fix_proposals_snapshot(root);
    if let Ok(mut lock) = LAST_FIX_PROPOSALS.write() {
        *lock = Some(snapshot.clone());
    }
    snapshot
}

#[derive(Debug, Deserialize)]
struct CritiquesSnapshotV1 {
    protocol_version: u64,
    #[serde(default)]
    critiques: Vec<crate::ai_client::Critique>,
}

fn absolutize_snapshot_path(root_path: &Path, file_path: &str) -> String {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let path = Path::new(trimmed);
    if path.is_absolute() {
        return trimmed.to_string();
    }
    root_path
        .join(trimmed.trim_start_matches("./"))
        .to_string_lossy()
        .to_string()
}

pub(crate) fn critiques_from_snapshot_for_root(root: &str) -> Vec<crate::ai_client::Critique> {
    let root_path = Path::new(root);
    let snapshot_path = root_path.join(".guardian").join("critiques.json");
    let raw = match fs::read_to_string(snapshot_path) {
        Ok(raw) => raw,
        Err(_) => return Vec::new(),
    };

    let mut parsed = match serde_json::from_str::<CritiquesSnapshotV1>(&raw) {
        Ok(parsed) => parsed,
        Err(_) => return Vec::new(),
    };

    if parsed.protocol_version != 1 {
        return Vec::new();
    }

    parsed.critiques.retain(|critique| !critique.file_path.trim().is_empty());
    for critique in &mut parsed.critiques {
        critique.file_path = absolutize_snapshot_path(root_path, &critique.file_path);
    }

    parsed.critiques
}

fn load_fix_proposals_snapshot(root: &str) -> FixProposalsSnapshot {
    let root_path = Path::new(root);
    let proposals_path = migrate_fix_proposals_if_needed(root_path);
    let mut map: HashMap<String, FixProposal> = HashMap::new();

    let timestamp_now = Utc::now().to_rfc3339();
    let source_path = proposals_path.to_string_lossy().to_string();

    let file = match fs::File::open(&proposals_path) {
        Ok(file) => file,
        Err(_) => {
            return FixProposalsSnapshot {
                timestamp: timestamp_now,
                root: root.to_string(),
                source_path,
                proposals: Vec::new(),
            }
        }
    };

    let reader = std::io::BufReader::new(file);
    for line in reader.lines().flatten() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let value: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let proposal_id = value
            .get("proposal_id")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string());
        let Some(proposal_id) = proposal_id.filter(|s| !s.is_empty()) else {
            continue;
        };

        let kind = value
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_lowercase();
        let has_content = value
            .get("proposed_content")
            .and_then(|v| v.as_str())
            .is_some();

        let status = value
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or(if has_content { "pending" } else { "" })
            .trim()
            .to_lowercase();

        let ts = value
            .get("timestamp")
            .and_then(|v| v.as_str())
            .unwrap_or(&timestamp_now)
            .to_string();

        let file_path = value
            .get("file_path")
            .and_then(|v| v.as_str())
            .map(|s| normalize_rel_file_path(root_path, s))
            .unwrap_or_default();

        if kind == "proposal" || has_content {
            let proposed_content = value
                .get("proposed_content")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let current = FixProposal {
                proposal_id: proposal_id.clone(),
                timestamp: ts,
                status: if status.is_empty() {
                    "pending".to_string()
                } else {
                    status
                },
                file_path,
                finding_id: value
                    .get("finding_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                proposed_by: value
                    .get("proposed_by")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                original_content_hash: value
                    .get("original_content_hash")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                suggestion: value
                    .get("suggestion")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                proposed_content,
                confidence: value
                    .get("confidence")
                    .and_then(|v| v.as_f64())
                    .map(|n| n as f32),
                reasoning: value
                    .get("reasoning")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            };

            map.insert(proposal_id, current);
            continue;
        }

        if kind == "status" || !status.is_empty() {
            let entry = map.entry(proposal_id.clone()).or_insert(FixProposal {
                proposal_id,
                timestamp: ts.clone(),
                status: "pending".to_string(),
                file_path,
                finding_id: None,
                proposed_by: None,
                original_content_hash: None,
                suggestion: None,
                proposed_content: None,
                confidence: None,
                reasoning: None,
            });

            entry.timestamp = ts;
            if !status.is_empty() {
                entry.status = status;
            }
        }
    }

    let mut proposals: Vec<FixProposal> = map.into_values().collect();
    proposals.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    FixProposalsSnapshot {
        timestamp: timestamp_now,
        root: root.to_string(),
        source_path,
        proposals,
    }
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

    // Scope is single-root; avoid leaking stale critiques across roots.
    if let Ok(mut lock) = ACTIVE_CRITIQUES.write() {
        lock.clear();
    }
    if let Ok(mut lock) = LAST_AUDITED_CONTENTS.write() {
        lock.clear();
    }

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

    let agent_instructions_path = guardian_path.join("AGENT_INSTRUCTIONS.md");
    if !agent_instructions_path.exists() {
        let instructions = r#"# Guardian Agent Integration

This workspace is monitored by Guardian. Files under `.guardian/` are generated and owned by Guardian.

## Read
- `.guardian/critiques.json` - machine-readable snapshot of active critiques
- `.guardian/agent_queue.jsonl` - append-only event stream (use `tail -f`)
- `.guardian/chat.md` - optional human-to-Guardian notes
- `.guardian-proposals/fix_proposals.jsonl` - optional fix proposal queue (append-only JSONL)

## Rules
1. Prioritize: critical > warning > info
2. Make minimal, safe changes (avoid large refactors unless requested)
3. Run tests after changes

## Forbidden
- Do not edit any `.guardian/*` files
- Do not read or exfiltrate secrets (`.env`, keys, credentials)
- Do not auto-commit or auto-push

## Fix Proposals
- If you want Guardian to review a fix, append a proposal to `.guardian-proposals/fix_proposals.jsonl`.
- Proposals MUST include `proposal_id`, `timestamp`, `file_path`, and `proposed_content` (FULL updated file content).
"#;
        let _ = tokio::fs::write(&agent_instructions_path, instructions).await;
    }
    if let Ok(existing) = tokio::fs::read_to_string(&agent_instructions_path).await {
        if !existing.contains("fix_proposals.jsonl") {
            let mut updated = existing;
            updated.push_str(
                "\n\n## Fix Proposals\n- Append proposals to `.guardian-proposals/fix_proposals.jsonl` (append-only JSONL).\n- Required fields: `proposal_id`, `timestamp`, `file_path`, `proposed_content` (FULL updated file content).\n",
            );
            let _ = tokio::fs::write(&agent_instructions_path, updated).await;
        }
    }

    let proposals_dir = Path::new(&target_path).join(FIX_PROPOSALS_DIR);
    if !proposals_dir.exists() {
        let _ = fs::create_dir_all(&proposals_dir);
    }

    let proposals_snapshot = refresh_fix_proposals_for_root(&target_path);
    app.emit("guardian:fix-proposals", proposals_snapshot).ok();

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
        if is_fix_proposals_file(&path) {
            let snapshot = refresh_fix_proposals_for_root(&root);
            app.emit("guardian:fix-proposals", snapshot).ok();
            continue;
        }

        if should_clear || !path.exists() {
            let path_key = path.to_string_lossy().to_string();

            let removed = if let Ok(mut lock) = ACTIVE_CRITIQUES.write() {
                lock.remove(&path_key)
            } else {
                None
            };

            if removed.is_some() {
                app.emit("guardian:clear", path_key.clone()).ok();
            }

            let storage_state = app.state::<Arc<Mutex<StorageManager>>>();
            if let Ok(storage) = storage_state.lock() {
                let _ = storage.remove_file_hash(&path_key);
            }

            let rel_path = normalize_rel_file_path(Path::new(&root), &path_key);
            append_agent_event(
                &root,
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "clear",
                    "file_path": rel_path,
                    "finding_id": removed.as_ref().and_then(|c| c.finding_id.clone()),
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

struct BatchPathResolver {
    root: PathBuf,
    single_abs: Option<String>,
    abs_set: HashSet<String>,
    rel_to_abs: HashMap<String, String>,
    basename_to_abs: HashMap<String, String>,
    canonical_to_abs: HashMap<String, String>,
}

impl BatchPathResolver {
    fn new(workspace_root: &Path, items: &[BatchItem]) -> Self {
        let mut abs_set = HashSet::with_capacity(items.len());
        let mut rel_to_abs = HashMap::with_capacity(items.len() * 2);
        let mut canonical_to_abs = HashMap::with_capacity(items.len());
        let mut basename_counts: HashMap<String, usize> = HashMap::new();
        let mut single_abs: Option<String> = None;

        for item in items {
            let abs = item.path.to_string_lossy().to_string();
            if single_abs.is_none() && items.len() == 1 {
                single_abs = Some(abs.clone());
            }
            abs_set.insert(abs.clone());

            let rel = normalize_rel_file_path(workspace_root, &abs);
            rel_to_abs.insert(rel, abs.clone());

            if let Some(name) = item
                .path
                .file_name()
                .and_then(|n| n.to_str())
                .filter(|n| !n.is_empty())
            {
                *basename_counts.entry(name.to_string()).or_insert(0) += 1;
            }

            if let Ok(canonical) = dunce::canonicalize(&item.path) {
                canonical_to_abs.insert(canonical.to_string_lossy().to_string(), abs);
            }
        }

        let mut basename_to_abs = HashMap::new();
        for item in items {
            let Some(name) = item
                .path
                .file_name()
                .and_then(|n| n.to_str())
                .filter(|n| !n.is_empty())
            else {
                continue;
            };
            if basename_counts.get(name).copied().unwrap_or(0) == 1 {
                basename_to_abs.insert(name.to_string(), item.path.to_string_lossy().to_string());
            }
        }

        Self {
            root: workspace_root.to_path_buf(),
            single_abs,
            abs_set,
            rel_to_abs,
            basename_to_abs,
            canonical_to_abs,
        }
    }

    fn resolve(&self, raw: &str) -> Option<String> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return self.single_abs.clone();
        }
        if self.abs_set.contains(trimmed) {
            return Some(trimmed.to_string());
        }

        let cleaned = trimmed.replace('\\', "/");
        let rel_key = normalize_rel_file_path(&self.root, &cleaned);
        if let Some(abs) = self.rel_to_abs.get(&rel_key) {
            return Some(abs.clone());
        }

        if let Some(name) = Path::new(&cleaned)
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.is_empty())
        {
            if let Some(abs) = self.basename_to_abs.get(name) {
                return Some(abs.clone());
            }
        }

        let candidate = if Path::new(&cleaned).is_absolute() {
            PathBuf::from(&cleaned)
        } else {
            self.root.join(&cleaned)
        };
        let canonical = dunce::canonicalize(&candidate).unwrap_or(candidate);
        if let Some(abs) = self.canonical_to_abs.get(canonical.to_string_lossy().as_ref()) {
            return Some(abs.clone());
        }

        None
    }
}

fn normalize_batch_critique_file_paths(
    workspace_root: &Path,
    items: &[BatchItem],
    critiques: Vec<crate::ai_client::Critique>,
) -> Vec<crate::ai_client::Critique> {
    if critiques.is_empty() || items.is_empty() {
        return critiques;
    }

    let resolver = BatchPathResolver::new(workspace_root, items);
    critiques
        .into_iter()
        .filter_map(|mut critique| {
            let resolved = resolver.resolve(&critique.file_path);
            let Some(resolved) = resolved else {
                let label = Path::new(critique.file_path.as_str())
                    .file_name()
                    .and_then(|n| n.to_str())
                    .filter(|n| !n.is_empty())
                    .unwrap_or("<unknown>");
                warn!(
                    target: "guardian::watcher",
                    "Dropping critique with unmapped file_path (file={})",
                    label
                );
                return None;
            };
            critique.file_path = resolved;
            Some(critique)
        })
        .collect()
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
    let (prompt_data, estimated_tokens, hash_by_path, context_files) = build_prompt_data(&items);
    emit_ai_context(app, root, client, estimated_tokens, &context_files);
    append_ai_request_history(root, client, estimated_tokens, &context_files);

    let mut attempt = 0;
    loop {
        let call = client.analyze_batch(prompt_data.clone()).await;
        *last_request = Instant::now();
        match call {
            Ok(critiques) => {
                let critiques = normalize_batch_critique_file_paths(Path::new(root), &items, critiques);
                let critiques_for_semantic = critiques.clone();
                handle_critiques(
                    app,
                    root,
                    &items,
                    &hash_by_path,
                    critiques,
                    estimated_tokens,
                    auto_verify_enabled,
                );
                schedule_semantic_indexing(
                    app.clone(),
                    root.to_string(),
                    &items,
                    &hash_by_path,
                    critiques_for_semantic,
                );
                update_last_audited_contents(&items);
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
                        let (single_prompt, single_tokens, single_hash, single_context) =
                            build_prompt_data(&single_items);
                        emit_ai_context(app, root, client, single_tokens, &single_context);
                        append_ai_request_history(root, client, single_tokens, &single_context);
                        match client.analyze_batch(single_prompt).await {
                            Ok(critiques) => {
                                let critiques = normalize_batch_critique_file_paths(
                                    Path::new(root),
                                    &single_items,
                                    critiques,
                                );
                                let critiques_for_semantic = critiques.clone();
                                handle_critiques(
                                    app,
                                    root,
                                    &single_items,
                                    &single_hash,
                                    critiques,
                                    single_tokens,
                                    auto_verify_enabled,
                                );
                                schedule_semantic_indexing(
                                    app.clone(),
                                    root.to_string(),
                                    &single_items,
                                    &single_hash,
                                    critiques_for_semantic,
                                );
                                update_last_audited_contents(&single_items);
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

fn emit_ai_context(
    app: &AppHandle,
    root: &str,
    client: &AiClient,
    tokens_in: u64,
    files: &[AiContextFile],
) {
    let snapshot = AiContextSnapshot {
        timestamp: Utc::now().to_rfc3339(),
        root: root.to_string(),
        provider_id: client.provider_id().to_string(),
        model: client.model().to_string(),
        tokens_in,
        files: files.to_vec(),
    };

    if let Ok(mut lock) = LAST_AI_CONTEXT.write() {
        *lock = Some(snapshot.clone());
    }

    app.emit("guardian:ai-context", snapshot).ok();
}

fn append_ai_request_history(
    root: &str,
    client: &AiClient,
    tokens_in: u64,
    files: &[AiContextFile],
) {
    let redacted_files = files.iter().filter(|f| f.redacted).count();
    let truncated_files = files.iter().filter(|f| f.truncated).count();

    append_history_event(
        root,
        HistoryEvent {
            timestamp: Utc::now().to_rfc3339(),
            event: "ai_request".to_string(),
            finding_id: None,
            file_path: None,
            model: Some(client.model().to_string()),
            provider: Some(client.provider_id().to_string()),
            redacted: Some(redacted_files > 0),
            tokens_in: Some(tokens_in),
            tokens_out: None,
            details: Some(json!({
                "files": files.len(),
                "redacted_files": redacted_files,
                "truncated_files": truncated_files,
            })),
        },
    );
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
    let rules_hash = crate::skills::hasher::get_rules_fingerprint(root);
    let workspace_root = Path::new(root);
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
    for mut critique in critiques {
        if critique.file_path.trim().is_empty() && items.len() == 1 {
            critique.file_path = items[0].path.to_string_lossy().to_string();
        }
        critique.finding_id = Some(crate::baseline::manager::finding_id_for_critique(
            workspace_root,
            &critique,
            &rules_hash,
        ));
        // Critiques for specific files
        let path_key = critique.file_path.clone();
        if critique.message.to_uppercase().trim() == "LGTM" {
            active_lock.remove(&path_key);
            app.emit("guardian:clear", path_key.clone()).ok();
            let rel_path = normalize_rel_file_path(workspace_root, &path_key);
            append_agent_event(
                root,
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "clear",
                    "file_path": rel_path,
                    "finding_id": critique.finding_id,
                    "reason": "lgtm"
                }),
            );
        } else if !should_surface_critique(&critique) {
            if active_lock.remove(&path_key).is_some() {
                app.emit("guardian:clear", path_key.clone()).ok();
                let rel_path = normalize_rel_file_path(workspace_root, &path_key);
                append_agent_event(
                    root,
                    &json!({
                        "timestamp": Utc::now().to_rfc3339(),
                        "event": "clear",
                        "file_path": rel_path,
                        "finding_id": critique.finding_id,
                        "reason": "suppressed"
                    }),
                );
            }
        } else {
            active_lock.insert(path_key.clone(), critique.clone());
            app.emit("guardian:critique", critique.clone()).ok();
            append_critique_event(root, &critique);
            let rel_path = normalize_rel_file_path(workspace_root, &path_key);
            append_agent_event(
                root,
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "critique",
                    "file_path": rel_path,
                    "finding_id": critique.finding_id,
                    "severity": critique.severity
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
            let is_critical = critique.severity.trim().eq_ignore_ascii_case("critical");
            if auto_verify_enabled && is_critical && critique.message != "LGTM" {
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
        let removed = active_lock.remove(&path);
        app.emit("guardian:clear", path.clone()).ok();
        let rel_path = normalize_rel_file_path(workspace_root, &path);
        append_agent_event(
            root,
            &json!({
                "timestamp": Utc::now().to_rfc3339(),
                "event": "clear",
                "file_path": rel_path,
                "finding_id": removed.as_ref().and_then(|c| c.finding_id.clone()),
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

fn schedule_semantic_indexing(
    app: AppHandle,
    root: String,
    items: &[BatchItem],
    hash_by_path: &HashMap<String, String>,
    critiques: Vec<crate::ai_client::Critique>,
) {
    if critiques.is_empty() || items.is_empty() {
        return;
    }

    let root_path = Path::new(&root);
    let rules_hash = crate::skills::hasher::get_rules_fingerprint(&root);

    let mut context_by_path: HashMap<String, String> = HashMap::new();
    let mut hash_by_key: HashMap<String, String> = HashMap::new();
    for item in items {
        let context = prepare_ai_context_file(item);
        let abs_path = context.file_path.clone();
        let rel_path = normalize_rel_file_path(root_path, &abs_path);
        context_by_path.insert(abs_path.clone(), context.content.clone());
        context_by_path
            .entry(rel_path.clone())
            .or_insert(context.content);

        if let Some(hash) = hash_by_path.get(&abs_path) {
            hash_by_key.insert(abs_path.clone(), hash.clone());
            hash_by_key.entry(rel_path).or_insert_with(|| hash.clone());
        }
    }

    let mut entries: Vec<crate::semantic_index::SemanticIndexInput> = Vec::new();
    for critique in critiques {
        if critique.message.trim().eq_ignore_ascii_case("lgtm")
            || !should_surface_critique(&critique)
        {
            continue;
        }
        let Some(context) = context_by_path.get(&critique.file_path) else {
            continue;
        };
        let critique_id = critique.finding_id.clone().unwrap_or_else(|| {
            crate::baseline::manager::finding_id_for_critique(root_path, &critique, &rules_hash)
        });
        let content_hash = hash_by_key
            .get(&critique.file_path)
            .cloned()
            .unwrap_or_default();

        let mut semantic_text = format!(
            "file_path: {}\nseverity: {}\nmessage: {}\n",
            critique.file_path, critique.severity, critique.message
        );
        if let Some(why) = &critique.why {
            semantic_text.push_str(&format!("why: {}\n", why));
        }
        if let Some(suggestion) = &critique.suggestion {
            semantic_text.push_str(&format!("suggestion: {}\n", suggestion));
        }
        semantic_text.push_str("\ncontext:\n");
        semantic_text.push_str(context);

        entries.push(crate::semantic_index::SemanticIndexInput {
            file_path: critique.file_path,
            content_hash,
            critique_id,
            severity: critique.severity,
            text: semantic_text,
        });
    }

    if entries.is_empty() {
        return;
    }

    let storage = app.state::<Arc<Mutex<StorageManager>>>().inner().clone();
    tokio::spawn(async move {
        match crate::semantic_index::index_entries_with_similarity(storage, &root, entries).await {
            Ok(outcomes) => {
                let indexed_count = outcomes.len();
                let recalled = outcomes
                    .iter()
                    .filter(|o| !o.similar_critical.is_empty())
                    .count();

                for outcome in &outcomes {
                    if !outcome.severity.eq_ignore_ascii_case("critical")
                        || outcome.similar_critical.is_empty()
                    {
                        continue;
                    }
                    let similar_files = outcome
                        .similar_critical
                        .iter()
                        .map(|m| format!("{} ({:.2})", m.file_path, m.similarity))
                        .collect::<Vec<_>>()
                        .join(", ");
                    app.emit(
                        "guardian:info",
                        format!(
                            "Semantic recall: {} [{}|{}] benzer kritik bulundu -> {}",
                            outcome.file_path,
                            outcome.critique_id,
                            outcome.source_mode,
                            similar_files
                        ),
                    )
                    .ok();
                }

                append_history_event(
                    &root,
                    HistoryEvent {
                        timestamp: Utc::now().to_rfc3339(),
                        event: "semantic_index".to_string(),
                        finding_id: None,
                        file_path: None,
                        model: None,
                        provider: None,
                        redacted: None,
                        tokens_in: None,
                        tokens_out: None,
                        details: Some(json!({
                            "indexed": indexed_count,
                            "critical_recalled": recalled,
                        })),
                    },
                );
            }
            Err(err) => {
                warn!(target: "guardian::semantic", "Semantic indexing skipped: {}", err);
            }
        }
    });
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
    if let Err(err) = crate::guardian_lock::sync_guardian_lock(root_path) {
        warn!(
            target: "guardian::watcher",
            "guardian.lock sync failed (root={}): {}",
            safe_path_label(root_path),
            err
        );
    }
    let guardian_dir = root_path.join(".guardian");

    if !guardian_dir.exists() {
        let _ = fs::create_dir_all(&guardian_dir);
    }

    let critiques_path = guardian_dir.join("critiques.md");
    let critiques_json_path = guardian_dir.join("critiques.json");
    let chat_path = guardian_dir.join("chat_queue.md");

    let mut critical_info: Option<StallInfo> = None;
    let rules_hash = crate::skills::hasher::get_rules_fingerprint(root);
    let workspace_id =
        crate::baseline::manager::compute_workspace_id(root_path).unwrap_or_default();

    // Rewrite critiques.md
    if let Ok(mut file) = fs::File::create(&critiques_path) {
        let _ = writeln!(file, "# Guardian Active Critiques");
        let _ = writeln!(file, "Updated: {}\n", Utc::now().to_rfc3339());
        let _ = writeln!(file, "```json");
        let mut entries: Vec<(String, &crate::ai_client::Critique)> = critiques
            .iter()
            .map(|(path, c)| (normalize_rel_file_path(root_path, path), c))
            .collect();
        entries.sort_by(|(a, _), (b, _)| a.cmp(b));
        for (rel_path, c) in entries {
            if critical_info.is_none()
                && c.severity.trim().eq_ignore_ascii_case("critical")
                && c.message != "LGTM"
            {
                critical_info = Some(StallInfo {
                    file_path: rel_path.clone(),
                    reason: c.message.clone(),
                });
            }
            let finding_id = c.finding_id.clone().unwrap_or_else(|| {
                crate::baseline::manager::finding_id_for_critique(root_path, c, &rules_hash)
            });
            let json_line = json!({
                "finding_id": finding_id,
                "file_path": rel_path,
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

    // Rewrite critiques.json (machine readable snapshot)
    if let Ok(mut file) = fs::File::create(&critiques_json_path) {
        let mut entries: Vec<(String, &crate::ai_client::Critique)> = critiques
            .iter()
            .map(|(path, c)| (normalize_rel_file_path(root_path, path), c))
            .collect();
        entries.sort_by(|(a, _), (b, _)| a.cmp(b));
        let mut payload_critiques = Vec::with_capacity(entries.len());
        for (rel_path, c) in entries {
            let finding_id = c.finding_id.clone().unwrap_or_else(|| {
                crate::baseline::manager::finding_id_for_critique(root_path, c, &rules_hash)
            });
            payload_critiques.push(json!({
                "finding_id": finding_id,
                "file_path": rel_path,
                "severity": c.severity,
                "message": c.message,
                "suggestion": c.suggestion,
                "chat_message": c.chat_message,
                "suggested_diff": c.suggested_diff
            }));
        }
        let payload = json!({
            "protocol_version": 1,
            "timestamp": Utc::now().to_rfc3339(),
            "workspace_id": workspace_id,
            "rules_hash": rules_hash,
            "critiques": payload_critiques
        });
        let _ = writeln!(
            file,
            "{}",
            serde_json::to_string_pretty(&payload).unwrap_or_default()
        );
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

pub(crate) fn active_critiques_for_root(root: &str) -> Vec<crate::ai_client::Critique> {
    let root_path = Path::new(root);
    let Ok(lock) = ACTIVE_CRITIQUES.read() else {
        return Vec::new();
    };
    lock.values()
        .filter(|critique| Path::new(&critique.file_path).starts_with(root_path))
        .cloned()
        .collect()
}

pub(crate) fn last_ai_context_for_root(root: &str) -> Option<AiContextSnapshot> {
    let Ok(lock) = LAST_AI_CONTEXT.read() else {
        return None;
    };
    lock.as_ref().filter(|snap| snap.root == root).cloned()
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
    rotate_agent_queue_if_needed(&queue_path);
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&queue_path)
    {
        let _ = writeln!(file, "{}", payload);
    }
}

fn rotate_agent_queue_if_needed(queue_path: &Path) {
    let Ok(meta) = fs::metadata(queue_path) else {
        return;
    };
    if meta.len() < MAX_AGENT_QUEUE_BYTES {
        return;
    }

    let Some(parent) = queue_path.parent() else {
        return;
    };

    let stamp = Utc::now().format("%Y%m%dT%H%M%S%fZ");
    let archive = parent.join(format!("agent_queue.{}.jsonl", stamp));
    let _ = fs::rename(queue_path, archive);
    prune_agent_queue_archives(parent);
}

fn prune_agent_queue_archives(dir: &Path) {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    let mut archives: Vec<(std::time::SystemTime, PathBuf)> = Vec::new();
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.file_name().and_then(|n| n.to_str()) == Some("agent_queue.jsonl") {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with("agent_queue.") || !name.ends_with(".jsonl") {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        archives.push((modified, path));
    }

    archives.sort_by(|(a, _), (b, _)| b.cmp(a));
    for (_, path) in archives.into_iter().skip(MAX_AGENT_QUEUE_ARCHIVES) {
        let _ = fs::remove_file(path);
    }
}

fn estimate_tokens(content: &str) -> u64 {
    let rough_tokens = (content.len() as f64 / 4.0).ceil() as u64;
    rough_tokens.max(1)
}

fn build_prompt_data(
    items: &[BatchItem],
) -> (
    Vec<(String, String)>,
    u64,
    HashMap<String, String>,
    Vec<AiContextFile>,
) {
    let mut prompt_data = Vec::new();
    let mut estimated_tokens: u64 = 0;
    let mut hash_by_path: HashMap<String, String> = HashMap::new();
    let mut context_files: Vec<AiContextFile> = Vec::with_capacity(items.len());

    for item in items.iter() {
        let context_file = prepare_ai_context_file(item);
        estimated_tokens += context_file.token_estimate;
        hash_by_path.insert(context_file.file_path.clone(), item.hash.clone());
        prompt_data.push((context_file.file_path.clone(), context_file.content.clone()));
        context_files.push(context_file);
    }

    (prompt_data, estimated_tokens, hash_by_path, context_files)
}

fn should_exclude_file(path: &Path) -> bool {
    crate::redaction::gate::is_sensitive_file(path)
}

fn filter_pii(content: &str) -> String {
    crate::redaction::gate::mask_inline_secrets(content)
}

fn update_last_audited_contents(items: &[BatchItem]) {
    let Ok(mut lock) = LAST_AUDITED_CONTENTS.write() else {
        return;
    };
    for item in items {
        let key = item.path.to_string_lossy().to_string();
        let filtered = filter_pii(&item.content);
        lock.insert(key, filtered);
    }
}

fn last_audited_content(path: &Path) -> Option<String> {
    let key = path.to_string_lossy().to_string();
    let Ok(lock) = LAST_AUDITED_CONTENTS.read() else {
        return None;
    };
    lock.get(&key).cloned()
}

fn prepare_ai_context_file(item: &BatchItem) -> AiContextFile {
    let max_content_lines = config::max_content_lines();
    let max_content_chars = config::max_content_chars();
    let filtered = filter_pii(&item.content);
    let redacted = filtered != item.content;
    let previous = last_audited_content(&item.path);
    let (joined, truncated) = build_diff_focused_context(
        previous.as_deref(),
        &filtered,
        max_content_lines,
        max_content_chars,
    );

    let token_estimate = estimate_tokens(&joined);

    AiContextFile {
        file_path: item.path.to_string_lossy().to_string(),
        token_estimate,
        redacted,
        truncated,
        content: joined,
    }
}

fn build_diff_focused_context(
    previous: Option<&str>,
    current: &str,
    max_content_lines: usize,
    max_content_chars: usize,
) -> (String, bool) {
    match previous {
        Some(prev) if prev != current => {
            let diff = TextDiff::from_lines(prev, current);
            let grouped = diff.grouped_ops(2);
            let mut body = String::new();
            let mut added = 0usize;
            let mut removed = 0usize;
            let mut changed = 0usize;
            let mut truncated = grouped.len() > DIFF_MAX_HUNKS;

            for (idx, group) in grouped.iter().take(DIFF_MAX_HUNKS).enumerate() {
                changed += 1;
                body.push_str(&format!("@@ hunk {} @@\n", idx + 1));
                for op in group {
                    for change in diff.iter_changes(op) {
                        let prefix = match change.tag() {
                            ChangeTag::Delete => {
                                removed += 1;
                                "-"
                            }
                            ChangeTag::Insert => {
                                added += 1;
                                "+"
                            }
                            ChangeTag::Equal => " ",
                        };
                        let mut line = change.to_string();
                        if line.ends_with('\n') {
                            line.pop();
                        }
                        if line.len() > 240 {
                            line.truncate(240);
                            line.push('…');
                            truncated = true;
                        }
                        body.push_str(prefix);
                        body.push_str(&line);
                        body.push('\n');
                    }
                }
                body.push('\n');
            }

            if changed == 0 {
                return build_snapshot_context(current, max_content_lines, max_content_chars);
            }

            let header = format!(
                "Mode: diff-focused\nDiff summary: {} hunks, +{} / -{} lines (post-redaction).\n\n",
                changed, added, removed
            );
            let mut full = String::with_capacity(header.len() + body.len());
            full.push_str(&header);
            full.push_str(&body);
            truncate_context(full, max_content_lines, max_content_chars, truncated)
        }
        _ => build_snapshot_context(current, max_content_lines, max_content_chars),
    }
}

fn build_snapshot_context(
    current: &str,
    max_content_lines: usize,
    max_content_chars: usize,
) -> (String, bool) {
    let total_lines = current.lines().count();
    let non_empty_lines = current.lines().filter(|l| !l.trim().is_empty()).count();
    let mut payload = format!(
        "Mode: snapshot-compressed\nSnapshot summary: {} lines ({} non-empty, post-redaction).\n\n",
        total_lines, non_empty_lines
    );
    payload.push_str(current);
    truncate_context(payload, max_content_lines, max_content_chars, false)
}

fn truncate_context(
    content: String,
    max_content_lines: usize,
    max_content_chars: usize,
    mut truncated: bool,
) -> (String, bool) {
    let mut lines: Vec<&str> = content.lines().collect();
    if lines.len() > max_content_lines {
        lines.truncate(max_content_lines);
        truncated = true;
    }
    let mut joined = lines.join("\n");
    if joined.len() > max_content_chars {
        joined.truncate(max_content_chars);
        joined.push_str("\n... (truncated)");
        truncated = true;
    }
    (joined, truncated)
}

fn is_rate_limit_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("too many requests") || lower.contains("rate limit") || lower.contains("429")
}

fn is_token_limit_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("tokens_limit_reached") || lower.contains("request body too large")
}

#[cfg(test)]
mod tests_protocol {
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn agent_queue_rotates_and_prunes() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("guardian dir");
        let queue_path = guardian_dir.join("agent_queue.jsonl");

        let rotations = MAX_AGENT_QUEUE_ARCHIVES + 2;
        for i in 0..rotations {
            let big = vec![b'a'; (MAX_AGENT_QUEUE_BYTES as usize) + 16];
            fs::write(&queue_path, &big).expect("seed big queue");

            append_agent_event(
                root.to_string_lossy().as_ref(),
                &json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "event": "critique",
                    "file_path": format!("src/file_{}.rs", i),
                    "finding_id": null,
                    "severity": "warning"
                }),
            );
        }

        assert!(
            queue_path.exists(),
            "agent_queue.jsonl must exist after rotation"
        );

        let archives: Vec<_> = fs::read_dir(&guardian_dir)
            .expect("read_dir")
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name();
                let name = name.to_string_lossy();
                name != "agent_queue.jsonl"
                    && name.starts_with("agent_queue.")
                    && name.ends_with(".jsonl")
            })
            .collect();

        assert!(
            !archives.is_empty(),
            "expected at least one archive after forced rotation"
        );
        assert!(
            archives.len() <= MAX_AGENT_QUEUE_ARCHIVES,
            "expected at most {} archives, got {}",
            MAX_AGENT_QUEUE_ARCHIVES,
            archives.len()
        );
    }

    #[test]
    fn critiques_snapshot_uses_relative_paths() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();

        let abs_path = root.join("src").join("main.rs");
        let abs_str = abs_path.to_string_lossy().to_string();

        let critique = crate::ai_client::Critique {
            file_path: abs_str.clone(),
            severity: "Critical".to_string(),
            message: "Issue".to_string(),
            suggestion: None,
            chat_message: None,
            suggested_diff: None,
            finding_id: Some("finding-123".to_string()),
            why: None,
        };
        let mut critiques = HashMap::new();
        critiques.insert(abs_str, critique);

        let stall = sync_guardian_logs(root.to_string_lossy().as_ref(), &critiques);
        let stall = stall.expect("expected stall info for critical critique");
        assert_eq!(stall.file_path, "src/main.rs");

        let payload_path = root.join(".guardian").join("critiques.json");
        let raw = fs::read_to_string(&payload_path).expect("read critiques.json");
        let parsed: serde_json::Value = serde_json::from_str(&raw).expect("parse critiques.json");

        assert_eq!(parsed["protocol_version"], 1);
        assert_eq!(parsed["critiques"][0]["file_path"], "src/main.rs");
        assert_eq!(parsed["critiques"][0]["finding_id"], "finding-123");
    }

    #[test]
    fn batch_critique_file_paths_are_normalized_to_analyzed_paths() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();

        let abs_path = root.join("src").join("main.rs");
        let abs_str = abs_path.to_string_lossy().to_string();

        let item = BatchItem {
            path: abs_path,
            content: String::new(),
            hash: String::new(),
        };

        let critique = crate::ai_client::Critique {
            file_path: "src/main.rs".to_string(),
            severity: "Warning".to_string(),
            message: "Issue".to_string(),
            suggestion: None,
            chat_message: None,
            suggested_diff: None,
            finding_id: None,
            why: None,
        };

        let out = normalize_batch_critique_file_paths(root, &[item], vec![critique]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].file_path, abs_str);
    }

    #[test]
    fn batch_critique_file_paths_drop_unmapped_paths_when_ambiguous() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();

        let item_a = BatchItem {
            path: root.join("a.rs"),
            content: String::new(),
            hash: String::new(),
        };
        let item_b = BatchItem {
            path: root.join("b.rs"),
            content: String::new(),
            hash: String::new(),
        };

        let critique = crate::ai_client::Critique {
            file_path: "c.rs".to_string(),
            severity: "Warning".to_string(),
            message: "Issue".to_string(),
            suggestion: None,
            chat_message: None,
            suggested_diff: None,
            finding_id: None,
            why: None,
        };

        let out = normalize_batch_critique_file_paths(root, &[item_a, item_b], vec![critique]);
        assert!(out.is_empty());
    }

    #[test]
    fn critiques_from_snapshot_loads_protocol_v1_payload() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("guardian dir");

        let payload = json!({
            "protocol_version": 1,
            "timestamp": "2026-02-10T00:00:00Z",
            "workspace_id": "workspace",
            "rules_hash": "hash",
            "critiques": [
                {
                    "finding_id": "f-1",
                    "file_path": "src/main.rs",
                    "severity": "Critical",
                    "message": "Legacy issue",
                    "suggestion": null,
                    "chat_message": null,
                    "suggested_diff": null
                }
            ]
        });
        let snapshot_path = guardian_dir.join("critiques.json");
        fs::write(&snapshot_path, serde_json::to_string_pretty(&payload).expect("serialize payload"))
            .expect("write snapshot");

        let critiques = critiques_from_snapshot_for_root(root.to_string_lossy().as_ref());
        assert_eq!(critiques.len(), 1);
        assert_eq!(critiques[0].finding_id.as_deref(), Some("f-1"));
        assert!(critiques[0].file_path.ends_with("src/main.rs"));
        assert_eq!(critiques[0].message, "Legacy issue");
    }

    #[test]
    fn critiques_from_snapshot_returns_empty_on_invalid_payload() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("guardian dir");
        let snapshot_path = guardian_dir.join("critiques.json");

        fs::write(&snapshot_path, "{\"protocol_version\":2,\"critiques\":[]}")
            .expect("write snapshot");
        let invalid_protocol = critiques_from_snapshot_for_root(root.to_string_lossy().as_ref());
        assert!(invalid_protocol.is_empty());

        fs::write(&snapshot_path, "{invalid-json").expect("write malformed snapshot");
        let malformed = critiques_from_snapshot_for_root(root.to_string_lossy().as_ref());
        assert!(malformed.is_empty());
    }

    #[test]
    fn diff_context_is_used_when_previous_snapshot_exists() {
        let previous = "fn main() {\n  let risky = true;\n}\n";
        let current = "fn main() {\n  let safe = true;\n}\n";

        let (content, truncated) = build_diff_focused_context(Some(previous), current, 120, 10_000);

        assert!(!truncated);
        assert!(content.contains("Mode: diff-focused"));
        assert!(content.contains("+  let safe = true;"));
        assert!(content.contains("-  let risky = true;"));
    }

    #[test]
    fn snapshot_context_is_used_without_previous_snapshot() {
        let current = "fn main() {\n  println!(\"hello\");\n}\n";
        let (content, truncated) = build_diff_focused_context(None, current, 120, 10_000);

        assert!(!truncated);
        assert!(content.contains("Mode: snapshot-compressed"));
        assert!(content.contains("Snapshot summary:"));
        assert!(content.contains("println!(\"hello\")"));
    }

    #[test]
    fn diff_context_reduces_token_estimate_for_localized_change() {
        let mut previous_lines: Vec<String> = Vec::new();
        for idx in 0..400 {
            previous_lines.push(format!(
                "const VALUE_{idx:03} = \"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\";"
            ));
        }
        let previous = previous_lines.join("\n");

        let mut current_lines = previous_lines;
        current_lines[198] =
            "const VALUE_198 = \"SECURITY_PATCH_APPLIED_WITH_MINIMAL_SCOPE\";".to_string();
        let current = current_lines.join("\n");

        let (snapshot_content, _) = build_diff_focused_context(None, &current, 220, 6000);
        let (diff_content, _) = build_diff_focused_context(Some(&previous), &current, 220, 6000);

        let snapshot_tokens = estimate_tokens(&snapshot_content);
        let diff_tokens = estimate_tokens(&diff_content);
        eprintln!(
            "diff-benchmark snapshot_tokens={} diff_tokens={}",
            snapshot_tokens, diff_tokens
        );

        assert!(snapshot_tokens > diff_tokens);
        let saved = snapshot_tokens - diff_tokens;
        let ratio = saved as f64 / snapshot_tokens as f64;
        assert!(ratio > 0.50);
    }
}
