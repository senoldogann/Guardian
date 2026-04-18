mod context;
mod critique;
mod fix;
mod pipeline;
mod search;
mod verify;

use crate::ai_client::AiClient;
use crate::config;
use crate::context::ProjectContext;
use crate::storage::StorageManager;
use crate::triage;
use crate::user_preferences::ScanTuning;
use chrono::Utc;
use guardian_scan_policy::{classify_path, ScanProfile, SkipReason};
use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use secrecy::SecretString;
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Semaphore;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

// Re-export public API
pub use context::AiContextSnapshot;
pub use fix::FixProposalsSnapshot;

// Re-export pub(crate) functions
pub(crate) use context::last_ai_context_for_root;
pub(crate) use critique::{active_critiques_for_root, critiques_from_snapshot_for_root};
pub(crate) use fix::{fix_proposals_path_for_root, refresh_fix_proposals_for_root};

// --- Shared utility functions used across sub-modules ---

fn is_turkish(language: &str) -> bool {
    language.trim().eq_ignore_ascii_case("tr")
}

fn ui_text<'a>(language: &str, en: &'a str, tr: &'a str) -> &'a str {
    if is_turkish(language) {
        tr
    } else {
        en
    }
}

fn is_send_failure_error(err: &str) -> bool {
    // Most providers wrap reqwest::Error via `.context("Failed to send ... request")`.
    // Treat these as "no call made" for cost metrics.
    let e = err.to_lowercase();
    e.contains("failed to send request")
        || e.contains("failed to send openai request")
        || e.contains("failed to send anthropic request")
        || e.contains("failed to send gemini request")
        || e.contains("failed to send github models request")
}

fn is_timeout_error(err: &str) -> bool {
    let e = err.to_lowercase();
    e.contains("timed out") || e.contains("timeout") || e.contains("deadline exceeded")
}

fn is_transient_send_failure(err: &str) -> bool {
    if !is_send_failure_error(err) {
        return false;
    }
    let e = err.to_lowercase();
    is_timeout_error(&e)
        || e.contains("connection reset")
        || e.contains("connection refused")
        || e.contains("network is unreachable")
        || e.contains("temporary failure")
        || e.contains("temporarily unavailable")
}

fn is_auth_error(err: &str) -> bool {
    let e = err.to_lowercase();
    e.contains("unauthorized")
        || e.contains("forbidden")
        || e.contains("api key")
        || e.contains("missing or still a placeholder")
        || e.contains("invalid api key")
}

fn effective_batch_size_limit(scan_profile: ScanProfile, scan_tuning: &ScanTuning) -> usize {
    let hinted = usize::from(scan_tuning.max_batch_size_hint).max(1);
    let profile_cap = scan_profile.max_batch_size().max(1);
    let configured = config::max_batch_size().max(1);
    let bounded_by_config = if configured == config::DEFAULT_MAX_BATCH_SIZE {
        hinted
    } else {
        hinted.min(configured)
    };
    bounded_by_config.min(profile_cap).max(1)
}

fn effective_batch_prompt_token_budget(scan_tuning: &ScanTuning) -> u64 {
    let hinted = u64::from(scan_tuning.token_budget_hint).max(1500);
    let configured = config::max_batch_prompt_tokens().max(1);
    if configured == config::DEFAULT_MAX_BATCH_PROMPT_TOKENS {
        hinted
    } else {
        hinted.min(configured)
    }
}

fn effective_initial_scan_limit(scan_profile: ScanProfile, scan_tuning: &ScanTuning) -> usize {
    let hinted = usize::from(scan_tuning.max_files_per_scan).max(1);
    let profile_cap = scan_profile.initial_scan_limit().max(1);
    hinted.min(profile_cap).max(1)
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

fn safe_path_label(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "<unknown>".to_string())
}

fn fs_worker_count() -> usize {
    std::env::var("GUARDIAN_FS_WORKERS")
        .ok()
        .and_then(|raw| raw.trim().parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or_else(|| {
            let cpus = std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(4);
            (cpus.saturating_mul(2)).clamp(2, 8)
        })
}

fn is_guardian_chat(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    path_str.ends_with(".guardian/chat.md") || path_str.ends_with(".guardian\\chat.md")
}

fn is_fix_proposals_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    if name != fix::FIX_PROPOSALS_FILE {
        return false;
    }
    let Some(parent) = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
    else {
        return false;
    };
    parent == fix::FIX_PROPOSALS_DIR || parent == ".guardian"
}

pub(crate) fn should_skip_path(path: &Path, is_chat: bool) -> bool {
    should_skip_path_with_profile(path, is_chat, ScanProfile::Source)
}

pub(crate) fn should_skip_path_with_profile(
    path: &Path,
    is_chat: bool,
    profile: ScanProfile,
) -> bool {
    // Centralized policy: used by watcher and (now) shared with CLI.
    !classify_path(path, is_chat, profile).include
}

fn skip_reason_label(path: &Path, is_chat: bool, profile: ScanProfile) -> Option<&'static str> {
    let decision = classify_path(path, is_chat, profile);
    if decision.include {
        return None;
    }
    Some(
        decision
            .reason
            .unwrap_or(SkipReason::IgnoredPathSegment)
            .as_str(),
    )
}

// --- Shared data structures ---

#[allow(dead_code)]
pub struct WatcherState {
    pub last_events: HashMap<PathBuf, Instant>,
}

#[derive(Clone)]
pub struct WatcherRuntimeConfig {
    pub target_path: String,
    pub api_key: SecretString,
    pub model: String,
    pub host: String,
    pub provider_id: String,
    pub auto_verify_enabled: bool,
    pub scan_profile: ScanProfile,
    pub language: String,
    pub scan_tuning: ScanTuning,
    pub model_custom_instructions: Option<String>,
}

#[derive(Clone, Copy)]
struct DebounceState {
    last_event: Instant,
    last_emit: Instant,
    burst_count: u32,
}

#[derive(Clone)]
pub(super) struct BatchItem {
    pub(super) path: PathBuf,
    pub(super) content: String,
    pub(super) hash: String,
    pub(super) mtime_ms: i64,
    pub(super) bytes: i64,
    pub(super) triage_risk_score: i64,
    pub(super) triage_signals: Vec<&'static str>,
    pub(super) triage_kind: triage::FileKind,
}

// --- Main watcher functions ---

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
        scan_profile,
        language,
        scan_tuning,
        model_custom_instructions,
    } = config;

    let (batch_tx, batch_rx) = tokio::sync::mpsc::channel(100);

    let client = match AiClient::new(provider_id, host, model, api_key) {
        Ok(client) => Arc::new(client),
        Err(err) => {
            error!(target: "guardian::watcher", "Failed to init AI client: {}", err);
            app.emit(
                "guardian:info",
                format!(
                    "{} {}",
                    ui_text(
                        language.as_str(),
                        "AI client init failed.",
                        "AI client başlatılamadı.",
                    ),
                    err
                ),
            )
            .ok();
            return;
        }
    };
    let debouncer: Arc<Mutex<HashMap<PathBuf, DebounceState>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let semaphore = Arc::new(Semaphore::new(4));

    let project_context = Arc::new(ProjectContext::index_path_with_profile(
        &target_path,
        scan_profile,
    ));
    let intent_pack = project_context.to_intent_pack_string(&target_path, scan_profile);
    crate::context::seed_intent_pack_cache(&target_path, scan_profile, intent_pack.clone());
    let intent_pack = Arc::new(intent_pack);
    info!(
        target: "guardian::watcher",
        "Cognitive indexing complete: {} files (profile={})",
        project_context.total_files,
        scan_profile.as_str()
    );

    info!(target: "guardian::watcher", "Watcher started on: {}", target_path);
    info!(
        target: "guardian::watcher",
        "Scan profile active: {}",
        scan_profile.as_str()
    );

    // Scope is single-root; avoid leaking stale critiques across roots.
    if let Ok(mut lock) = critique::ACTIVE_CRITIQUES.write() {
        lock.clear();
    }
    if let Ok(mut lock) = context::LAST_AUDITED_CONTENTS.write() {
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

    let proposals_dir = Path::new(&target_path).join(fix::FIX_PROPOSALS_DIR);
    if !proposals_dir.exists() {
        let _ = fs::create_dir_all(&proposals_dir);
    }

    let proposals_snapshot = refresh_fix_proposals_for_root(&target_path);
    app.emit("guardian:fix-proposals", proposals_snapshot).ok();

    // Spawn Batch Processor
    let batch_app = app.clone();
    let batch_client = client.clone();
    let batch_ctx = project_context.clone();
    let batch_intent = intent_pack.clone();
    let batch_root = target_path.clone();
    let batch_auto_verify_enabled = auto_verify_enabled;
    let batch_shutdown = shutdown.clone();
    let batch_profile = scan_profile;
    let batch_language = language.clone();
    let batch_scan_tuning = scan_tuning.clone();
    let batch_model_custom_instructions = model_custom_instructions.clone();
    tokio::spawn(async move {
        pipeline::batch_processing_loop(
            batch_rx,
            batch_app,
            batch_client,
            batch_ctx,
            batch_intent,
            batch_root,
            batch_auto_verify_enabled,
            batch_shutdown,
            batch_profile,
            batch_language,
            batch_scan_tuning,
            batch_model_custom_instructions,
        )
        .await;
    });

    // UX IMPROVEMENT: Initial Scan
    let scan_root = target_path.clone();
    let scan_app = app.clone();
    let scan_tx = batch_tx.clone();

    let scan_shutdown = shutdown.clone();
    let scan_semaphore = semaphore.clone();
    let scan_profile_copy = scan_profile;
    let scan_worker_count = fs_worker_count();
    let (scan_path_tx, scan_path_rx) = tokio::sync::mpsc::channel::<PathBuf>(64);
    let scan_path_rx = Arc::new(tokio::sync::Mutex::new(scan_path_rx));
    for _ in 0..scan_worker_count {
        let rx = scan_path_rx.clone();
        let worker_app = scan_app.clone();
        let worker_tx = scan_tx.clone();
        let worker_sem = scan_semaphore.clone();
        tokio::spawn(async move {
            loop {
                let next = { rx.lock().await.recv().await };
                let Some(path) = next else {
                    break;
                };
                audit_file_logic(
                    path,
                    worker_app.clone(),
                    worker_tx.clone(),
                    worker_sem.clone(),
                    scan_profile_copy,
                )
                .await;
            }
        });
    }

    tokio::task::spawn_blocking(move || {
        use std::collections::HashMap;

        let scan_limit = effective_initial_scan_limit(scan_profile_copy, &scan_tuning);
        info!(
            target: "guardian::watcher",
            "Performing initial scan (profile={}, limit={}, requested_max_files_per_scan={}, policy_cap={})",
            scan_profile_copy.as_str(),
            scan_limit,
            scan_tuning.max_files_per_scan,
            scan_profile_copy.initial_scan_limit()
        );
        let walker = ignore::WalkBuilder::new(&scan_root)
            .hidden(false)
            .git_ignore(true)
            // Prune ignored path segments early to avoid traversing huge folders (node_modules, target, etc.)
            // This keeps the "skipped_by_reason" counts meaningful while dramatically improving initial scan speed.
            .filter_entry(move |entry| {
                let Some(ft) = entry.file_type() else {
                    return true;
                };
                if !ft.is_dir() {
                    return true;
                }
                let is_chat = is_guardian_chat(entry.path());
                let decision = classify_path(entry.path(), is_chat, scan_profile_copy);
                decision.reason != Some(SkipReason::IgnoredPathSegment)
            })
            .build();

        let mut included_count = 0usize;
        let mut skipped_count = 0usize;
        let mut limit_reached = false;
        let mut skipped_by_reason: HashMap<&'static str, usize> = HashMap::new();

        for result in walker {
            if scan_shutdown.load(Ordering::Acquire) {
                break;
            }
            if included_count >= scan_limit {
                limit_reached = true;
                break;
            }
            if let Ok(entry) = result {
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    let path = entry.path().to_path_buf();
                    let is_chat = is_guardian_chat(&path);
                    if should_skip_path_with_profile(&path, is_chat, scan_profile_copy) {
                        skipped_count += 1;
                        if let Some(label) = skip_reason_label(&path, is_chat, scan_profile_copy) {
                            *skipped_by_reason.entry(label).or_insert(0) += 1;
                        }
                        continue;
                    }

                    if scan_path_tx.blocking_send(path).is_err() {
                        // Receiver dropped (shutdown); stop early.
                        break;
                    }

                    included_count += 1;
                }
            }
        }

        let mut reasons: Vec<(&'static str, usize)> = skipped_by_reason.into_iter().collect();
        reasons.sort_by(|a, b| b.1.cmp(&a.1));
        let reasons_preview = reasons
            .into_iter()
            .take(6)
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join(", ");

        info!(
            target: "guardian::watcher",
            "Initial scan summary (profile={}, included={}, skipped={}, limit_reached={}, skipped_by_reason=[{}])",
            scan_profile_copy.as_str(),
            included_count,
            skipped_count,
            limit_reached,
            reasons_preview
        );
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
    let watch_profile = scan_profile;

    tokio::task::spawn_blocking(move || {
        use std::sync::mpsc::RecvTimeoutError;
        loop {
            if watch_shutdown.load(Ordering::Acquire) {
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
                            watch_profile,
                        );
                    }
                    Err(e) => warn!(target: "guardian::watcher", "Watch error: {:?}", e),
                },
                Err(RecvTimeoutError::Timeout) => continue,
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    while !shutdown.load(Ordering::Acquire) {
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
    scan_profile: ScanProfile,
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

            let removed = if let Ok(mut lock) = critique::ACTIVE_CRITIQUES.write() {
                lock.remove(&path_key)
            } else {
                None
            };

            if removed.is_some() {
                app.emit("guardian:clear", path_key.clone()).ok();
            }

            let storage_state = app.state::<Arc<Mutex<StorageManager>>>();
            if let Ok(storage) = storage_state.lock() {
                let _ = storage.remove_file_fingerprint(&path_key);
            }

            let rel_path = normalize_rel_file_path(Path::new(&root), &path_key);
            critique::append_agent_event(
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

        if should_skip_path_with_profile(&path, is_chat, scan_profile) {
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
            audit_file_logic(path, a_app, a_tx, a_sem, scan_profile).await;
        });
    }
}

// Replaces analyze_file
async fn audit_file_logic(
    path: PathBuf,
    app: AppHandle,
    tx: tokio::sync::mpsc::Sender<BatchItem>,
    semaphore: Arc<Semaphore>,
    scan_profile: ScanProfile,
) {
    let _permit = semaphore.acquire_owned().await;

    // Best-effort observability: why did we skip this file?
    // Note: profile-aware skipping is enforced earlier in the pipeline. This is just a guardrail
    // in case callers bypass should_skip_path_with_profile.
    let is_chat = is_guardian_chat(&path);
    if skip_reason_label(&path, is_chat, scan_profile).is_some() {
        // Keep this in debug to avoid spamming the UI.
        debug!(
            target: "guardian::watcher",
            "audit_file_logic called for skipped path: {}",
            safe_path_label(&path)
        );
    }

    // PII Filter: Skip sensitive files
    if context::should_exclude_file(&path) {
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
    let meta = match tokio::fs::metadata(&path).await {
        Ok(meta) => meta,
        Err(err) => {
            debug!(
                target: "guardian::watcher",
                "Skipping file without metadata (file={}, err={})",
                safe_path_label(&path),
                err
            );
            return;
        }
    };

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

    let bytes = meta.len() as i64;
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(-1);

    let strict_hash = std::env::var("GUARDIAN_STRICT_HASH")
        .ok()
        .map(|v| v.trim() == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !strict_hash && mtime_ms >= 0 {
        let storage_state = app.state::<Arc<Mutex<StorageManager>>>().inner().clone();
        let unchanged = match storage_state.lock() {
            Ok(storage) => storage
                .check_file_fingerprint(&path.to_string_lossy(), mtime_ms, bytes)
                .unwrap_or(false),
            Err(_) => false,
        };

        if unchanged {
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
            return;
        }
    }

    let content = match tokio::fs::read_to_string(&path).await {
        Ok(content) => content,
        Err(_) => return,
    };

    let current_hash = context::calculate_hash(&content);
    let triage_result = triage::triage(&path, &content);

    // Mixed-gate triage: source-code is always audited; non-source surfaces are audited only
    // when they show meaningful risk signals (profile-aware thresholds).
    if !triage::should_audit(
        scan_profile,
        triage_result.file_kind,
        triage_result.risk_score,
    ) {
        debug!(
            target: "guardian::watcher",
            "Mixed gate: skipping low-signal file (file={}, kind={}, risk_score={}, profile={})",
            safe_path_label(&path),
            triage_result.file_kind.as_str(),
            triage_result.risk_score,
            scan_profile.as_str()
        );

        // Still record the fingerprint so unchanged files can be skipped without reading next time.
        let storage_state = app.state::<Arc<Mutex<StorageManager>>>().inner().clone();
        if let Ok(storage) = storage_state.lock() {
            let _ = storage.upsert_file_fingerprint(
                &path.to_string_lossy(),
                &current_hash,
                mtime_ms,
                bytes,
                triage_result.risk_score,
            );
        }
        return;
    }

    debug!(
        target: "guardian::watcher",
        "Auditing change (file={})",
        safe_path_label(&path)
    );

    let item = BatchItem {
        path,
        content,
        hash: current_hash,
        mtime_ms,
        bytes,
        triage_risk_score: triage_result.risk_score,
        triage_signals: triage_result.signals,
        triage_kind: triage_result.file_kind,
    };
    let _ = tx.send(item).await;
}

// --- Tests ---

#[cfg(test)]
mod tests_protocol {
    use super::context::*;
    use super::critique::*;
    use super::pipeline::*;
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;
    use std::fs;
    use tempfile::TempDir;

    fn sample_critique(path: &str, severity: &str, message: &str) -> crate::ai_client::Critique {
        crate::ai_client::Critique {
            file_path: path.to_string(),
            severity: severity.to_string(),
            message: message.to_string(),
            suggestion: None,
            chat_message: None,
            suggested_diff: None,
            finding_id: None,
            why: None,
            line_start: None,
            line_end: None,
            evidence_snippet: None,
            category: None,
            confidence: None,
        }
    }

    #[test]
    fn precision_calibration_filters_low_signal_warning() {
        let mut critique = sample_critique(
            "src/app.ts",
            "Warning",
            "Consider improving readability and naming for better style.",
        );
        let keep = calibrate_critique_for_precision(&mut critique, "en");
        assert!(!keep, "low-signal style warning should be filtered");
    }

    #[test]
    fn precision_calibration_downgrades_weak_critical() {
        let mut critique = sample_critique(
            "src/app.ts",
            "Critical",
            "Could be improved with additional comments and readability updates.",
        );
        let keep = calibrate_critique_for_precision(&mut critique, "en");
        assert!(!keep);
        assert_eq!(critique.severity, "Warning");
    }

    #[test]
    fn governance_summary_files_are_written_with_sync() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        let abs_path = root.join("src").join("main.rs");
        let abs_str = abs_path.to_string_lossy().to_string();

        let mut critiques = HashMap::new();
        critiques.insert(
            abs_str.clone(),
            sample_critique(&abs_str, "Critical", "Security risk detected in auth path."),
        );

        let _ = sync_guardian_logs(root.to_string_lossy().as_ref(), &critiques);
        let summary_json = root.join(".guardian").join("governance_summary.json");
        let summary_md = root.join(".guardian").join("governance_summary.md");
        assert!(summary_json.exists());
        assert!(summary_md.exists());

        let parsed: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(summary_json).expect("read governance_summary.json"),
        )
        .expect("parse governance summary");
        assert_eq!(parsed["summary"]["critical"], 1);
    }

    #[test]
    fn last_audited_cache_limit_eviction_removes_oldest_entries() {
        let mut cache: HashMap<String, AuditedContentCacheEntry> = HashMap::new();
        cache.insert(
            "a.rs".to_string(),
            AuditedContentCacheEntry {
                content: "oldest".to_string(),
                last_seen_epoch_ms: 10,
            },
        );
        cache.insert(
            "b.rs".to_string(),
            AuditedContentCacheEntry {
                content: "middle".to_string(),
                last_seen_epoch_ms: 20,
            },
        );
        cache.insert(
            "c.rs".to_string(),
            AuditedContentCacheEntry {
                content: "newest".to_string(),
                last_seen_epoch_ms: 30,
            },
        );

        enforce_last_audited_cache_limit(&mut cache, 2);
        assert_eq!(cache.len(), 2);
        assert!(!cache.contains_key("a.rs"));
        assert!(cache.contains_key("b.rs"));
        assert!(cache.contains_key("c.rs"));
    }

    #[test]
    fn timeout_error_detection_variants() {
        assert!(is_timeout_error(
            "Failed to send OpenAI request: error sending request: operation timed out"
        ));
        assert!(is_timeout_error(
            "request timeout while connecting upstream"
        ));
        assert!(!is_timeout_error("authentication failed: invalid api key"));
    }

    #[test]
    fn transient_send_failure_detects_timeout_and_connection_reset() {
        assert!(is_transient_send_failure(
            "Failed to send OpenAI request: operation timed out"
        ));
        assert!(is_transient_send_failure(
            "Failed to send request to AI provider: connection reset by peer"
        ));
        assert!(!is_transient_send_failure(
            "OpenAI request failed: 401 unauthorized"
        ));
    }

    #[test]
    fn policy_caps_initial_scan_limit_from_user_tuning() {
        let tuning = ScanTuning {
            max_files_per_scan: 400,
            max_batch_size_hint: 8,
            token_budget_hint: 9_000,
        };
        assert_eq!(
            effective_initial_scan_limit(ScanProfile::Source, &tuning),
            ScanProfile::Source.initial_scan_limit()
        );
        assert_eq!(
            effective_initial_scan_limit(ScanProfile::Extended, &tuning),
            ScanProfile::Extended.initial_scan_limit()
        );
        assert_eq!(
            effective_initial_scan_limit(ScanProfile::Full, &tuning),
            400
        );
    }

    #[test]
    fn policy_caps_batch_size_from_user_tuning() {
        let tuning = ScanTuning {
            max_files_per_scan: 300,
            max_batch_size_hint: 10,
            token_budget_hint: 9_000,
        };
        assert_eq!(effective_batch_size_limit(ScanProfile::Source, &tuning), 3);
        assert_eq!(
            effective_batch_size_limit(ScanProfile::Extended, &tuning),
            4
        );
        assert_eq!(effective_batch_size_limit(ScanProfile::Full, &tuning), 4);
    }

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
            line_start: None,
            line_end: None,
            evidence_snippet: None,
            category: None,
            confidence: None,
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
            mtime_ms: 0,
            bytes: 0,
            triage_risk_score: 0,
            triage_signals: Vec::new(),
            triage_kind: triage::FileKind::Source,
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
            line_start: None,
            line_end: None,
            evidence_snippet: None,
            category: None,
            confidence: None,
        };

        let out = normalize_batch_critique_file_paths(root, &[item], vec![critique]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].file_path, abs_str);
    }

    #[test]
    fn upsert_batch_item_replaces_existing_path_with_latest_content() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        let path = root.join("src").join("main.rs");

        let mut batch = vec![BatchItem {
            path: path.clone(),
            content: "old-content".to_string(),
            hash: "old-hash".to_string(),
            mtime_ms: 1,
            bytes: 10,
            triage_risk_score: 1,
            triage_signals: vec!["signal-old"],
            triage_kind: triage::FileKind::Source,
        }];

        upsert_batch_item(
            &mut batch,
            BatchItem {
                path: path.clone(),
                content: "new-content".to_string(),
                hash: "new-hash".to_string(),
                mtime_ms: 2,
                bytes: 11,
                triage_risk_score: 2,
                triage_signals: vec!["signal-new"],
                triage_kind: triage::FileKind::Source,
            },
        );

        assert_eq!(batch.len(), 1, "same path should not duplicate in batch");
        assert_eq!(batch[0].content, "new-content");
        assert_eq!(batch[0].hash, "new-hash");
        assert_eq!(batch[0].mtime_ms, 2);
    }

    #[test]
    fn merge_project_intent_with_recent_fix_history_includes_only_current_batch_files() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        let tracked_path = root.join("src").join("main.rs");
        let unrelated_path = root.join("src").join("other.rs");
        fs::create_dir_all(tracked_path.parent().expect("parent dir")).expect("create src");
        fs::write(&tracked_path, "fn main() {}\n").expect("seed tracked file");
        fs::write(&unrelated_path, "fn other() {}\n").expect("seed unrelated file");

        crate::undo::apply_fix_now(
            root.to_string_lossy().as_ref(),
            tracked_path.to_string_lossy().as_ref(),
            "fn main() { println!(\"patched\"); }\n",
        )
        .expect("apply tracked fix");
        crate::undo::apply_fix_now(
            root.to_string_lossy().as_ref(),
            unrelated_path.to_string_lossy().as_ref(),
            "fn other() { println!(\"patched\"); }\n",
        )
        .expect("apply unrelated fix");

        let items = vec![BatchItem {
            path: tracked_path,
            content: "fn main() { println!(\"patched\"); }\n".to_string(),
            hash: "hash".to_string(),
            mtime_ms: 1,
            bytes: 32,
            triage_risk_score: 1,
            triage_signals: Vec::new(),
            triage_kind: triage::FileKind::Source,
        }];

        let context = merge_project_intent_with_recent_fix_history(
            Some("PROJECT POLICY:\n- Keep release gates strict."),
            root.to_string_lossy().as_ref(),
            &items,
        )
        .expect("context should exist");

        assert!(context.contains("PROJECT POLICY:"));
        assert!(context.contains("RECENT FIX HISTORY:"));
        assert!(context.contains("src/main.rs"));
        assert!(!context.contains("src/other.rs"));
    }

    #[test]
    fn batch_critique_file_paths_drop_unmapped_paths_when_ambiguous() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();

        let item_a = BatchItem {
            path: root.join("a.rs"),
            content: String::new(),
            hash: String::new(),
            mtime_ms: 0,
            bytes: 0,
            triage_risk_score: 0,
            triage_signals: Vec::new(),
            triage_kind: triage::FileKind::Source,
        };
        let item_b = BatchItem {
            path: root.join("b.rs"),
            content: String::new(),
            hash: String::new(),
            mtime_ms: 0,
            bytes: 0,
            triage_risk_score: 0,
            triage_signals: Vec::new(),
            triage_kind: triage::FileKind::Source,
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
            line_start: None,
            line_end: None,
            evidence_snippet: None,
            category: None,
            confidence: None,
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
        fs::write(
            &snapshot_path,
            serde_json::to_string_pretty(&payload).expect("serialize payload"),
        )
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
