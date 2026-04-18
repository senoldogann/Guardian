use crate::ai_client::AiClient;
use crate::config;
use crate::user_preferences::ScanTuning;

use guardian_scan_policy::ScanProfile;
use once_cell::sync::Lazy;
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;
use tracing::{debug, error, info, warn};

use super::context::{
    append_ai_request_history, build_prompt_data, emit_ai_context, update_last_audited_contents,
};
use super::critique::{handle_critiques, schedule_semantic_indexing};
use super::is_auth_error;
use super::is_send_failure_error;
use super::is_timeout_error;
use super::is_transient_send_failure;
use super::is_turkish;
use super::normalize_rel_file_path;
use super::ui_text;
use super::{effective_batch_prompt_token_budget, effective_batch_size_limit, BatchItem};

#[derive(Debug, Clone)]
struct AuditBackoffState {
    consecutive_failures: u32,
    cooldown_until: Instant,
    last_error: String,
    last_notice_at: Instant,
}

static AUDIT_BACKOFF_BY_ROOT: Lazy<Arc<RwLock<HashMap<String, AuditBackoffState>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

fn compute_audit_backoff_secs(consecutive_failures: u32) -> u64 {
    // Progressive cooldown to stop endless retries when a provider is down/misconfigured.
    // Keep it human-friendly and cap at 10 minutes.
    match consecutive_failures {
        0 | 1 => 60,
        2 => 120,
        3 => 300,
        _ => 600,
    }
}

pub(super) fn audit_backoff_remaining(root: &str) -> Option<Duration> {
    let Ok(lock) = AUDIT_BACKOFF_BY_ROOT.read() else {
        return None;
    };
    let state = lock.get(root)?;
    let now = Instant::now();
    if now >= state.cooldown_until {
        return None;
    }
    Some(state.cooldown_until.duration_since(now))
}

fn reset_audit_backoff(root: &str) {
    if let Ok(mut lock) = AUDIT_BACKOFF_BY_ROOT.write() {
        lock.remove(root);
    }
}

fn bump_audit_backoff(root: &str, err: &str) -> (Duration, bool) {
    // Returns: (backoff_duration, should_emit_notice)
    let now = Instant::now();
    let mut should_emit = false;
    let backoff_secs;

    if let Ok(mut lock) = AUDIT_BACKOFF_BY_ROOT.write() {
        let entry = lock
            .entry(root.to_string())
            .or_insert_with(|| AuditBackoffState {
                consecutive_failures: 0,
                cooldown_until: now,
                last_error: String::new(),
                last_notice_at: now - Duration::from_secs(3600),
            });

        entry.consecutive_failures = entry.consecutive_failures.saturating_add(1);
        backoff_secs = compute_audit_backoff_secs(entry.consecutive_failures);
        entry.cooldown_until = now + Duration::from_secs(backoff_secs);

        let err_changed = entry.last_error != err;
        entry.last_error = err.to_string();

        if err_changed || now.duration_since(entry.last_notice_at) > Duration::from_secs(45) {
            entry.last_notice_at = now;
            should_emit = true;
        }
    } else {
        backoff_secs = 300;
        should_emit = true;
    }

    (Duration::from_secs(backoff_secs), should_emit)
}

pub(super) fn is_rate_limit_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("too many requests") || lower.contains("rate limit") || lower.contains("429")
}

pub(super) fn is_token_limit_error(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("tokens_limit_reached") || lower.contains("request body too large")
}

pub(super) struct BatchPathResolver {
    root: PathBuf,
    single_abs: Option<String>,
    abs_set: HashSet<String>,
    rel_to_abs: HashMap<String, String>,
    basename_to_abs: HashMap<String, String>,
    canonical_to_abs: HashMap<String, String>,
}

impl BatchPathResolver {
    pub(super) fn new(workspace_root: &Path, items: &[BatchItem]) -> Self {
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

    pub(super) fn resolve(&self, raw: &str) -> Option<String> {
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
        if let Some(abs) = self
            .canonical_to_abs
            .get(canonical.to_string_lossy().as_ref())
        {
            return Some(abs.clone());
        }

        None
    }
}

pub(super) fn normalize_batch_critique_file_paths(
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

pub(super) fn upsert_batch_item(batch: &mut Vec<BatchItem>, item: BatchItem) {
    if let Some(idx) = batch.iter().position(|existing| existing.path == item.path) {
        batch[idx] = item;
        return;
    }
    batch.push(item);
}

pub(super) fn merge_project_intent_with_recent_fix_history(
    project_intent_pack: Option<&str>,
    root: &str,
    items: &[BatchItem],
) -> Option<String> {
    let mut sections = Vec::new();
    if let Some(pack) = project_intent_pack {
        let trimmed = pack.trim();
        if !trimmed.is_empty() {
            sections.push(trimmed.to_string());
        }
    }

    let Ok(history) = crate::undo::list_fix_history(root) else {
        return if sections.is_empty() {
            None
        } else {
            Some(sections.join("\n\n"))
        };
    };

    let workspace_root = Path::new(root);
    let batch_paths: std::collections::HashSet<String> = items
        .iter()
        .map(|item| normalize_rel_file_path(workspace_root, &item.path.to_string_lossy()))
        .collect();
    let mut recent_fix_history = Vec::new();
    for entry in history {
        if !batch_paths.contains(&entry.file_path) {
            continue;
        }
        recent_fix_history.push(format!("- `{}` patched at {}", entry.file_path, entry.applied_at));
        if recent_fix_history.len() >= 8 {
            break;
        }
    }

    if !recent_fix_history.is_empty() {
        let mut section = String::from("RECENT FIX HISTORY:\n");
        section.push_str(
            "Treat these as recently applied patches and do not report stale duplicates unless the current diff still proves the issue exists.\n",
        );
        section.push_str(&recent_fix_history.join("\n"));
        sections.push(section);
    }

    if sections.is_empty() {
        None
    } else {
        Some(sections.join("\n\n"))
    }
}

pub(super) async fn batch_processing_loop(
    mut rx: tokio::sync::mpsc::Receiver<BatchItem>,
    app: AppHandle,
    client: Arc<AiClient>,
    _context: Arc<crate::context::ProjectContext>,
    intent_pack: Arc<String>,
    root: String,
    auto_verify_enabled: bool,
    shutdown: Arc<std::sync::atomic::AtomicBool>,
    scan_profile: ScanProfile,
    language: String,
    scan_tuning: ScanTuning,
    model_custom_instructions: Option<String>,
) {
    let mut batch: Vec<BatchItem> = Vec::new();
    let flush_interval = Duration::from_secs(crate::config::batch_flush_interval_secs());
    let mut interval = tokio::time::interval(flush_interval);
    let mut last_request = Instant::now() - Duration::from_secs(10);

    loop {
        if shutdown.load(std::sync::atomic::Ordering::Acquire) {
            break;
        }
        tokio::select! {
            _ = interval.tick() => {
                if !batch.is_empty() {
                    process_batch(
                        &mut batch,
                        &app,
                        &client,
                        Some(intent_pack.as_str()),
                        &root,
                        auto_verify_enabled,
                        scan_profile,
                        language.as_str(),
                        &scan_tuning,
                        model_custom_instructions.as_deref(),
                        &mut last_request,
                    )
                    .await;
                }
            },
            Some(item) = rx.recv() => {
                // Keep the freshest content per path; do not keep stale pre-debounce snapshots.
                upsert_batch_item(&mut batch, item);

                let effective_batch_size = effective_batch_size_limit(scan_profile, &scan_tuning);
                if batch.len() >= effective_batch_size {
                    // FLUSH
                    process_batch(
                        &mut batch,
                        &app,
                        &client,
                        Some(intent_pack.as_str()),
                        &root,
                        auto_verify_enabled,
                        scan_profile,
                        language.as_str(),
                        &scan_tuning,
                        model_custom_instructions.as_deref(),
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
    project_intent_pack: Option<&str>,
    root: &str,
    auto_verify_enabled: bool,
    scan_profile: ScanProfile,
    language: &str,
    scan_tuning: &ScanTuning,
    model_custom_instructions: Option<&str>,
    last_request: &mut Instant,
) {
    if batch.is_empty() {
        return;
    }

    if let Some(remaining) = audit_backoff_remaining(root) {
        // Avoid hammering the provider when it's down/misconfigured; keep the batch in memory.
        // We emit a single, low-noise hint via the backoff bump path (on the first failure).
        debug!(
            target: "guardian::watcher",
            "Audit backoff active (remaining={}s, profile={})",
            remaining.as_secs(),
            scan_profile.as_str()
        );
        return;
    }

    let elapsed = last_request.elapsed();
    let min_batch_interval = Duration::from_secs(config::min_batch_interval_secs());
    if elapsed < min_batch_interval {
        sleep(min_batch_interval - elapsed).await;
    }

    let items = std::mem::take(batch);
    info!(
        target: "guardian::watcher",
        "Batch processor flushing {} files (profile={})",
        items.len(),
        scan_profile.as_str()
    );

    // Prepare Prompt Data
    let (prompt_data, estimated_tokens, hash_by_path, context_files) = build_prompt_data(&items, std::path::Path::new(root));
    let enriched_project_context =
        merge_project_intent_with_recent_fix_history(project_intent_pack, root, &items);
    emit_ai_context(app, root, client, estimated_tokens, &context_files);
    append_ai_request_history(root, client, estimated_tokens, &context_files);

    let max_batch_prompt_tokens = effective_batch_prompt_token_budget(scan_tuning);
    if estimated_tokens > max_batch_prompt_tokens && items.len() > 1 {
        app.emit(
            "guardian:warning",
            format!(
                "{} {} > {}. {}",
                ui_text(
                    language,
                    "Batch prompt is heavy (estimated tokens). Falling back to per-file audit.",
                    "Batch prompt agir (tahmini token). Dosya bazli audit'e dusuluyor.",
                ),
                estimated_tokens,
                max_batch_prompt_tokens,
                ui_text(
                    language,
                    "Tune with GUARDIAN_MAX_BATCH_PROMPT_TOKENS / GUARDIAN_MAX_CONTENT_CHARS if needed.",
                    "Gerekirse GUARDIAN_MAX_BATCH_PROMPT_TOKENS / GUARDIAN_MAX_CONTENT_CHARS ile ayarlayin.",
                )
            ),
        )
        .ok();
        process_items_per_file_fallback(
            items,
            app,
            client,
            enriched_project_context.as_deref(),
            root,
            auto_verify_enabled,
            scan_profile,
            language,
            model_custom_instructions,
            last_request,
        )
        .await;
        return;
    }

    let mut attempt = 0;
    loop {
        let call = client
            .analyze_batch_with_intent(
                enriched_project_context.as_deref(),
                language,
                model_custom_instructions,
                prompt_data.clone(),
            )
            .await;
        *last_request = Instant::now();
        match call {
            Ok(result) => {
                reset_audit_backoff(root);
                let queue_wait_ms = result.queue_wait_ms;
                let critiques =
                    normalize_batch_critique_file_paths(Path::new(root), &items, result.value);
                let critiques_for_semantic = critiques.clone();
                handle_critiques(
                    app,
                    root,
                    language,
                    &items,
                    &hash_by_path,
                    critiques,
                    estimated_tokens,
                    1,
                    items.len(),
                    auto_verify_enabled,
                    scan_profile,
                    queue_wait_ms,
                );
                app.emit(
                    "guardian:info",
                    if is_turkish(language) {
                        format!(
                            "Tarama kapsamı: {} (batch={})",
                            scan_profile.as_str(),
                            items.len()
                        )
                    } else {
                        format!(
                            "Scan scope: {} (batch={})",
                            scan_profile.as_str(),
                            items.len()
                        )
                    },
                )
                .ok();
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
                // Use full anyhow chain for actionable root cause ("connection refused", "timed out", etc.).
                let err = format!("{e:#}");
                if is_rate_limit_error(&err) && attempt < config::rate_limit_retries() {
                    let backoff = Duration::from_secs(
                        config::rate_limit_backoff_secs().saturating_mul((attempt + 1) as u64),
                    );
                    let notice = if is_turkish(language) {
                        format!(
                            "Rate limit. {}sn sonra tekrar deneniyor...",
                            backoff.as_secs()
                        )
                    } else {
                        format!("Rate limited. Retrying in {}s...", backoff.as_secs())
                    };
                    app.emit("guardian:warning", notice).ok();
                    sleep(backoff).await;
                    attempt += 1;
                    continue;
                }

                if is_transient_send_failure(&err) && attempt < config::send_failure_retries() {
                    let multiplier = 1u64 << attempt.min(6);
                    let backoff = Duration::from_secs(
                        config::send_failure_backoff_secs().saturating_mul(multiplier),
                    );
                    app.emit(
                        "guardian:warning",
                        format!(
                            "{} {}s ({}/{})",
                            ui_text(
                                language,
                                "Transient provider/network failure. Retrying in",
                                "Gecici provider/ag hatasi. Tekrar deneme",
                            ),
                            backoff.as_secs(),
                            attempt + 1,
                            config::send_failure_retries()
                        ),
                    )
                    .ok();
                    sleep(backoff).await;
                    attempt += 1;
                    continue;
                }

                if (is_token_limit_error(&err)
                    || (is_timeout_error(&err) && is_send_failure_error(&err)))
                    && items.len() > 1
                {
                    app.emit(
                        "guardian:warning",
                        if is_token_limit_error(&err) {
                            ui_text(
                                language,
                                "Batch too large. Falling back to per-file audit.",
                                "Batch çok büyük. Dosya bazlı audit'e düşülüyor.",
                            )
                            .to_string()
                        } else {
                            ui_text(
                                language,
                                "Batch request timed out. Falling back to per-file audit.",
                                "Batch isteği zaman aşımına uğradı. Dosya bazlı audit'e düşülüyor.",
                            )
                            .to_string()
                        },
                    )
                    .ok();
                    process_items_per_file_fallback(
                        items,
                        app,
                        client,
                        enriched_project_context.as_deref(),
                        root,
                        auto_verify_enabled,
                        scan_profile,
                        language,
                        model_custom_instructions,
                        last_request,
                    )
                    .await;
                    return;
                }

                let (cooldown, should_notice) = bump_audit_backoff(root, &err);
                if should_notice {
                    let provider = client.provider_id();
                    let base_url = client.base_url();
                    let hint = if provider == "ollama"
                        && is_send_failure_error(&err)
                        && is_timeout_error(&err)
                    {
                        ui_text(
                            language,
                            "Ollama request timed out. Try a smaller model or increase the timeout (GUARDIAN_TIMEOUT_OLLAMA).",
                            "Ollama isteği zaman aşımına uğradı. Daha küçük bir model deneyin veya timeout'u artırın (GUARDIAN_TIMEOUT_OLLAMA).",
                        )
                    } else if provider == "openai"
                        && is_send_failure_error(&err)
                        && is_timeout_error(&err)
                    {
                        ui_text(
                            language,
                            "OpenAI request timed out. Reduce batch size/context (GUARDIAN_MAX_BATCH_SIZE, GUARDIAN_MAX_CONTENT_CHARS, GUARDIAN_MAX_BATCH_PROMPT_TOKENS) or increase timeout (GUARDIAN_TIMEOUT_OPENAI).",
                            "OpenAI isteği zaman aşımına uğradı. Batch/context boyutunu azaltın (GUARDIAN_MAX_BATCH_SIZE, GUARDIAN_MAX_CONTENT_CHARS, GUARDIAN_MAX_BATCH_PROMPT_TOKENS) veya timeout'u artırın (GUARDIAN_TIMEOUT_OPENAI).",
                        )
                    } else if provider == "ollama" && is_send_failure_error(&err) {
                        ui_text(
                            language,
                            "Ollama appears unreachable. Start Ollama (local server), verify the base URL, or switch provider in Settings.",
                            "Ollama erişilemiyor görünüyor. Ollama'yı (local server) başlatın, base URL'i doğrulayın veya Settings'ten provider değiştirin.",
                        )
                    } else if is_auth_error(&err) {
                        ui_text(
                            language,
                            "Authentication looks invalid. Check your provider API key in Settings.",
                            "Kimlik doğrulama geçersiz görünüyor. Settings'ten provider API key'inizi kontrol edin.",
                        )
                    } else if is_send_failure_error(&err) {
                        ui_text(
                            language,
                            "Provider endpoint appears unreachable. Check network/base URL and provider status.",
                            "Provider endpoint erişilemiyor. Ağ/base URL ve provider durumunu kontrol edin.",
                        )
                    } else {
                        ui_text(
                            language,
                            "Provider request failed. Check provider status and configuration.",
                            "Provider isteği başarısız. Provider durumu ve ayarlarını kontrol edin.",
                        )
                    };
                    error!(
                        target: "guardian::watcher",
                        "Batch audit failed (provider={}, base_url={}): {}",
                        provider,
                        base_url,
                        err
                    );
                    let notice = if is_turkish(language) {
                        format!(
                            "Batch audit {}sn duraklatıldı. {} (provider={}, base_url={})",
                            cooldown.as_secs(),
                            hint,
                            provider,
                            base_url
                        )
                    } else {
                        format!(
                            "Batch audit paused for {}s. {} (provider={}, base_url={})",
                            cooldown.as_secs(),
                            hint,
                            provider,
                            base_url
                        )
                    };
                    app.emit("guardian:warning", notice).ok();
                } else {
                    debug!(target: "guardian::watcher", "Batch audit failed (debounced): {}", err);
                }

                // Requeue the items so we can resume automatically after the backoff window.
                *batch = items;

                // Cost metrics: if we couldn't even send the HTTP request, count as 0 provider calls.
                let calls = if is_send_failure_error(&err) { 0 } else { 1 };
                app.emit(
                    "guardian:usage",
                    json!({ "tokens": if calls == 0 { 0 } else { estimated_tokens }, "calls": calls, "files": if calls == 0 { 0 } else { batch.len() }, "queue_wait_ms": 0 }),
                )
                .ok();
                return;
            }
        }
    }
}

async fn process_items_per_file_fallback(
    items: Vec<BatchItem>,
    app: &AppHandle,
    client: &Arc<AiClient>,
    project_intent_pack: Option<&str>,
    root: &str,
    auto_verify_enabled: bool,
    scan_profile: ScanProfile,
    language: &str,
    model_custom_instructions: Option<&str>,
    last_request: &mut Instant,
) {
    for item in items {
        let single_items = vec![item];
        let (single_prompt, single_tokens, single_hash, single_context) =
            build_prompt_data(&single_items, std::path::Path::new(root));
        emit_ai_context(app, root, client, single_tokens, &single_context);
        append_ai_request_history(root, client, single_tokens, &single_context);
        match client
            .analyze_batch_with_intent(
                project_intent_pack,
                language,
                model_custom_instructions,
                single_prompt,
            )
            .await
        {
            Ok(result) => {
                let queue_wait_ms = result.queue_wait_ms;
                let critiques = normalize_batch_critique_file_paths(
                    Path::new(root),
                    &single_items,
                    result.value,
                );
                let critiques_for_semantic = critiques.clone();
                handle_critiques(
                    app,
                    root,
                    language,
                    &single_items,
                    &single_hash,
                    critiques,
                    single_tokens,
                    1,
                    single_items.len(),
                    auto_verify_enabled,
                    scan_profile,
                    queue_wait_ms,
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
                    format!(
                        "{} {}",
                        ui_text(
                            language,
                            "Single-file audit failed.",
                            "Tek dosya audit'i başarısız.",
                        ),
                        err
                    ),
                )
                .ok();
                app.emit(
                    "guardian:usage",
                    json!({ "tokens": single_tokens, "calls": 1, "files": 1, "queue_wait_ms": 0 }),
                )
                .ok();
            }
        }
        *last_request = Instant::now();
    }
}
