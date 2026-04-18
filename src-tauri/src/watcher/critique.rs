use crate::history_logger::append_critique_event;
use crate::storage::StorageManager;
use chrono::Utc;
use guardian_scan_policy::{is_infra_relevant_path, ScanProfile};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;
use std::sync::{Arc, Mutex, RwLock};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{debug, warn};

use super::normalize_rel_file_path;
use super::safe_path_label;
use super::ui_text;
use super::verify::run_auto_verify;
use super::BatchItem;

pub(super) const MAX_AGENT_QUEUE_BYTES: u64 = 1 * 1024 * 1024;
pub(super) const MAX_AGENT_QUEUE_ARCHIVES: usize = 5;

// GLOBAL STATE for active critiques to enable "real-time sync/delete"
// OPTIMIZATION: Using RwLock instead of Mutex for better read concurrency
pub(super) static ACTIVE_CRITIQUES: Lazy<Arc<RwLock<HashMap<String, crate::ai_client::Critique>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

#[derive(Clone)]
pub(super) struct StallInfo {
    pub(super) file_path: String,
    pub(super) reason: String,
}

pub(super) fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}

pub(super) fn is_significant_warning(critique: &crate::ai_client::Critique) -> bool {
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

fn allow_low_signal_warnings() -> bool {
    std::env::var("GUARDIAN_ALLOW_LOW_SIGNAL_WARNINGS")
        .ok()
        .map(|raw| {
            let value = raw.trim().to_lowercase();
            value == "1" || value == "true" || value == "yes" || value == "on"
        })
        .unwrap_or(false)
}

pub(super) fn warning_signal_score(critique: &crate::ai_client::Critique) -> i32 {
    let message = critique.message.to_lowercase();
    let suggestion = critique
        .suggestion
        .as_ref()
        .map(|value| value.to_lowercase())
        .unwrap_or_default();
    let combined = format!("{} {}", message, suggestion);

    let high_risk_terms = [
        "security",
        "vulnerability",
        "exploit",
        "injection",
        "auth",
        "permission",
        "secret",
        "credential",
        "token leak",
        "password",
        "path traversal",
        "privilege",
        "sandbox escape",
        "rce",
        "xss",
        "csrf",
        "güvenlik",
        "yetki",
        "izin",
        "sızıntı",
    ];
    let reliability_terms = [
        "panic",
        "crash",
        "deadlock",
        "race",
        "data loss",
        "corruption",
        "timeout",
        "availability",
        "dos",
        "fail open",
        "retry storm",
        "çök",
        "yarış",
        "veri kaybı",
        "zaman aşımı",
    ];
    let architecture_terms = [
        "architectural drift",
        "boundary",
        "layer violation",
        "coupling",
        "policy violation",
        "release gate",
        "mimari",
        "katman ihlali",
        "bağımlılık ihlali",
    ];
    let noise_terms = [
        "consider",
        "might improve",
        "could improve",
        "readability",
        "naming",
        "style",
        "minor",
        "nit",
        "nice to have",
        "add more comments",
        "best practice in general",
        "genel en iyi uygulama",
        "okunabilirlik",
        "isimlendirme",
        "stili",
        "iyileştirilebilir",
        "önerilir",
    ];

    let mut score = 0;
    if contains_any(&combined, &high_risk_terms) {
        score += 4;
    }
    if contains_any(&combined, &reliability_terms) {
        score += 3;
    }
    if contains_any(&combined, &architecture_terms) {
        score += 2;
    }
    if critique.message.contains("->")
        || critique.message.contains("because")
        || critique.message.contains("risk")
        || critique.message.contains("neden")
        || critique.message.contains("etki")
    {
        score += 1;
    }
    if !critique.file_path.trim().is_empty() {
        score += 1;
    }
    if contains_any(&combined, &noise_terms) {
        score -= 3;
    }
    if critique.message.trim().len() < 48 {
        score -= 1;
    }
    if critique
        .suggestion
        .as_ref()
        .map(|value| value.trim().len() < 24)
        .unwrap_or(true)
    {
        score -= 1;
    }
    score
}

pub(super) fn is_low_signal_warning(critique: &crate::ai_client::Critique) -> bool {
    warning_signal_score(critique) < 2
}

fn suggestion_is_generic(suggestion: &str) -> bool {
    let normalized = suggestion.trim().to_lowercase();
    if normalized.is_empty() {
        return true;
    }
    let generic_terms = [
        "consider improving",
        "consider adding",
        "best practice",
        "review this",
        "improve readability",
        "add more logging",
        "add tests",
        "gözden geçir",
        "iyileştirilebilir",
        "en iyi uygulama",
        "log ekle",
    ];
    contains_any(&normalized, &generic_terms)
}

fn contextual_suggestion(language: &str, file_path: &str, combined: &str) -> String {
    let path_lower = file_path.to_lowercase();

    if contains_any(
        combined,
        &["secret", "credential", "token", "password", "api key"],
    ) {
        return ui_text(
            language,
            "Move secrets to secure storage (env/Keychain), rotate exposed tokens, and add a startup guard that fails fast when required secrets are missing.",
            "Secret bilgilerini güvenli depoya (env/Keychain) taşıyın, sızmış tokenları döndürün ve zorunlu secret yoksa hızlı fail veren bir başlangıç kontrolü ekleyin.",
        )
        .to_string();
    }

    if contains_any(
        combined,
        &["timeout", "rate limit", "retry", "backoff", "zaman aşımı"],
    ) {
        return ui_text(
            language,
            "Add bounded retries with exponential backoff + jitter, set provider-specific timeout, and surface a user-safe fallback message.",
            "Sınırlı retry + exponential backoff + jitter ekleyin, provider bazlı timeout tanımlayın ve kullanıcıya güvenli fallback mesajı gösterin.",
        )
        .to_string();
    }

    if path_lower.ends_with(".rs") {
        return ui_text(
            language,
            "Replace panic-prone paths (`unwrap/expect`) with `Result` propagation, add a negative-path unit test, and return an actionable error context.",
            "Panik üretebilecek yolları (`unwrap/expect`) `Result` propagasyonu ile değiştirin, negatif-path unit test ekleyin ve aksiyon alınabilir hata bağlamı döndürün.",
        )
        .to_string();
    }

    if path_lower.ends_with(".ts")
        || path_lower.ends_with(".tsx")
        || path_lower.ends_with(".js")
        || path_lower.ends_with(".jsx")
    {
        return ui_text(
            language,
            "Apply strict input validation at the boundary, avoid unsafe HTML rendering, and add an integration test covering the risky branch.",
            "Sınır katmanda sıkı input doğrulaması uygulayın, unsafe HTML render'dan kaçının ve riskli dalı kapsayan bir integration test ekleyin.",
        )
        .to_string();
    }

    if path_lower.ends_with(".py") {
        return ui_text(
            language,
            "Harden exception handling for file/network operations, validate untrusted input early, and add regression tests for malformed data.",
            "Dosya/ağ işlemlerinde exception handling'i güçlendirin, güvenilmeyen girdiyi erken doğrulayın ve bozuk veri için regression test ekleyin.",
        )
        .to_string();
    }

    if path_lower.ends_with(".swift") {
        return ui_text(
            language,
            "Guard permission-sensitive paths (Keychain/Accessibility), avoid hardcoded secrets, and add tests for denied-permission scenarios.",
            "İzin hassas yolları (Keychain/Accessibility) guard edin, hardcoded secret kullanmayın ve izin reddi senaryoları için test ekleyin.",
        )
        .to_string();
    }

    if path_lower.ends_with(".json")
        || path_lower.ends_with(".yaml")
        || path_lower.ends_with(".yml")
        || path_lower.ends_with(".toml")
        || path_lower.contains("config")
        || path_lower.contains("settings")
    {
        return ui_text(
            language,
            "Enforce schema-based config validation, reject unknown keys, and fail closed when required security fields are missing.",
            "Şema tabanlı config doğrulaması uygulayın, bilinmeyen anahtarları reddedin ve zorunlu güvenlik alanları eksikse fail-closed davranın.",
        )
        .to_string();
    }

    ui_text(
        language,
        "Tie this finding to a concrete release risk, patch the risky code path, and add a test that reproduces the failure mode.",
        "Bu bulguyu somut release riskine bağlayın, riskli kod yolunu yamalayın ve hata modunu yeniden üreten bir test ekleyin.",
    )
    .to_string()
}

pub(super) fn normalize_severity_token(raw: &str) -> String {
    let normalized = raw.trim().to_lowercase();
    match normalized.as_str() {
        "critical" => "Critical".to_string(),
        "warning" => "Warning".to_string(),
        "info" => "Info".to_string(),
        "lgtm" => "LGTM".to_string(),
        _ => "Warning".to_string(),
    }
}

fn has_strong_critical_signal(critique: &crate::ai_client::Critique) -> bool {
    let combined = format!(
        "{} {} {}",
        critique.file_path.to_lowercase(),
        critique.message.to_lowercase(),
        critique
            .suggestion
            .as_ref()
            .map(|value| value.to_lowercase())
            .unwrap_or_default()
    );
    let critical_terms = [
        "critical",
        "security",
        "vulnerability",
        "exploit",
        "rce",
        "token leak",
        "secret",
        "credential",
        "privilege",
        "auth bypass",
        "injection",
        "xss",
        "csrf",
        "panic",
        "crash",
        "data loss",
        "corruption",
        "deadlock",
        "race condition",
        "production outage",
        "güvenlik",
        "kritik",
        "sızıntı",
        "çök",
    ];
    contains_any(&combined, &critical_terms)
}

pub(super) fn calibrate_critique_for_precision(
    critique: &mut crate::ai_client::Critique,
    language: &str,
) -> bool {
    critique.severity = normalize_severity_token(&critique.severity);

    if critique.message.trim().is_empty() {
        return false;
    }

    if critique.severity.eq_ignore_ascii_case("critical") && !has_strong_critical_signal(critique) {
        critique.severity = "Warning".to_string();
        let note = ui_text(
            language,
            "Severity auto-calibrated from Critical to Warning due to weak exploit/failure evidence.",
            "Exploit/hata etkisi kanıtı zayıf olduğu için seviye Critical'dan Warning'e otomatik kalibre edildi.",
        );
        if !critique.message.contains(note) {
            critique.message = format!("{} {}", critique.message.trim(), note);
        }
    }

    if critique.severity.eq_ignore_ascii_case("warning")
        && is_low_signal_warning(critique)
        && !allow_low_signal_warnings()
    {
        return false;
    }

    let combined = format!(
        "{} {}",
        critique.message.to_lowercase(),
        critique
            .suggestion
            .as_ref()
            .map(|value| value.to_lowercase())
            .unwrap_or_default()
    );
    if critique
        .suggestion
        .as_ref()
        .map(|value| suggestion_is_generic(value))
        .unwrap_or(true)
    {
        critique.suggestion = Some(contextual_suggestion(
            language,
            &critique.file_path,
            &combined,
        ));
    }

    true
}

pub(super) fn should_surface_critique(critique: &crate::ai_client::Critique, profile: ScanProfile) -> bool {
    let severity = critique.severity.trim().to_lowercase();
    // Critical is always shown.
    if severity == "critical" {
        return true;
    }

    let msg = critique.message.to_lowercase();
    let suggestion = critique
        .suggestion
        .as_ref()
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let combined = format!("{} {}", msg, suggestion);

    let has_infra_security_keywords = || {
        let infra_security_keywords = [
            "security",
            "vulnerability",
            "injection",
            "secret",
            "credential",
            "token",
            "password",
            "root user",
            "privilege",
            "permission",
            "sandbox",
            "exposed",
            "leak",
        ];
        infra_security_keywords
            .iter()
            .any(|keyword| combined.contains(keyword))
    };

    let is_significant_info = || {
        // Full mode can be noisy; keep Info gated to high-signal topics.
        let keywords = [
            "breaking",
            "deprecated",
            "deprecation",
            "removed",
            "migration",
            "security",
            "vulnerability",
            "cve",
            "performance",
            "slow",
            "latency",
            "memory",
            "leak",
            "outdated",
            "dependency",
            "version",
            "upgrade",
            "update",
        ];
        keywords.iter().any(|k| combined.contains(k))
    };

    match profile {
        ScanProfile::Source => {
            // Source: keep noise low.
            severity == "warning"
                && is_significant_warning(critique)
                && (!is_low_signal_warning(critique) || allow_low_signal_warnings())
        }
        ScanProfile::Extended => {
            // Extended: allow significant warnings everywhere, and infra/security warnings only for infra-like files.
            if severity == "warning" && is_significant_warning(critique) {
                return !is_low_signal_warning(critique) || allow_low_signal_warnings();
            }
            if severity == "warning" && is_infra_relevant_path(Path::new(&critique.file_path)) {
                return has_infra_security_keywords()
                    && (!is_low_signal_warning(critique) || allow_low_signal_warnings());
            }
            false
        }
        ScanProfile::Full => {
            // Full: show warnings unless explicitly classified as low-signal.
            if severity == "warning" {
                return !is_low_signal_warning(critique) || allow_low_signal_warnings();
            }
            if severity == "info" {
                return is_significant_info();
            }
            false
        }
    }
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

    parsed
        .critiques
        .retain(|critique| !critique.file_path.trim().is_empty());
    for critique in &mut parsed.critiques {
        critique.file_path = absolutize_snapshot_path(root_path, &critique.file_path);
    }

    parsed.critiques
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

pub(super) fn handle_critiques(
    app: &AppHandle,
    root: &str,
    language: &str,
    items: &[BatchItem],
    hash_by_path: &HashMap<String, String>,
    critiques: Vec<crate::ai_client::Critique>,
    estimated_tokens: u64,
    api_calls: u64,
    files_analyzed: usize,
    auto_verify_enabled: bool,
    scan_profile: ScanProfile,
    queue_wait_ms: u64,
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
        let path_key = critique.file_path.clone();
        if !calibrate_critique_for_precision(&mut critique, language) {
            if active_lock.remove(&path_key).is_some() {
                app.emit("guardian:clear", path_key.clone()).ok();
                let rel_path = normalize_rel_file_path(workspace_root, &path_key);
                append_agent_event(
                    root,
                    &json!({
                        "timestamp": Utc::now().to_rfc3339(),
                        "event": "clear",
                        "file_path": rel_path,
                        "finding_id": null,
                        "reason": "precision_filtered"
                    }),
                );
            }
            continue;
        }
        critique.finding_id = Some(crate::baseline::manager::finding_id_for_critique(
            workspace_root,
            &critique,
            &rules_hash,
        ));
        // Critiques for specific files
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
        } else if !should_surface_critique(&critique, scan_profile) {
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
                run_auto_verify(app.clone(), root.to_string(), language.to_string());
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

    // Update fingerprints after successful audit (used to skip unchanged files without reading).
    if let Ok(storage) = storage_state.lock() {
        for item in items.iter() {
            let _ = storage.upsert_file_fingerprint(
                &item.path.to_string_lossy(),
                &item.hash,
                item.mtime_ms,
                item.bytes,
                item.triage_risk_score,
            );
            debug!(
                target: "guardian::watcher",
                "Memory Guard: fingerprint updated (file={})",
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
        json!({
            "tokens": estimated_tokens,
            "calls": api_calls,
            "files": files_analyzed,
            "queue_wait_ms": queue_wait_ms
        }),
    )
    .ok();
}

pub(super) fn schedule_semantic_indexing(
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
        let context = super::context::prepare_ai_context_file(item);
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
            || !should_surface_critique(&critique, ScanProfile::Source)
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

                crate::history_logger::append_history_event(
                    &root,
                    crate::history_logger::HistoryEvent {
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

pub(super) fn append_agent_event(root: &str, payload: &serde_json::Value) {
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

pub(super) fn rotate_agent_queue_if_needed(queue_path: &Path) {
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

pub(super) fn prune_agent_queue_archives(dir: &Path) {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };

    let mut archives: Vec<(std::time::SystemTime, std::path::PathBuf)> = Vec::new();
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

fn write_governance_summary(
    root_path: &Path,
    guardian_dir: &Path,
    workspace_id: &str,
    rules_hash: &str,
    critiques: &HashMap<String, crate::ai_client::Critique>,
) {
    let summary_json_path = guardian_dir.join("governance_summary.json");
    let summary_md_path = guardian_dir.join("governance_summary.md");

    let mut entries: Vec<(String, &crate::ai_client::Critique)> = critiques
        .iter()
        .map(|(path, critique)| (normalize_rel_file_path(root_path, path), critique))
        .collect();
    entries.sort_by(|(a, _), (b, _)| a.cmp(b));

    let mut critical = 0usize;
    let mut warning = 0usize;
    let mut info = 0usize;
    let mut findings_payload = Vec::with_capacity(entries.len());

    for (rel_path, critique) in &entries {
        let severity = normalize_severity_token(&critique.severity);
        match severity.as_str() {
            "Critical" => critical += 1,
            "Warning" => warning += 1,
            _ => info += 1,
        }
        let finding_id = critique.finding_id.clone().unwrap_or_else(|| {
            crate::baseline::manager::finding_id_for_critique(root_path, critique, rules_hash)
        });
        findings_payload.push(json!({
            "finding_id": finding_id,
            "file_path": rel_path,
            "severity": severity,
            "message": critique.message,
            "suggestion": critique.suggestion,
            "why": critique.why
        }));
    }

    let total = critical + warning + info;
    let release_recommendation = if critical > 0 {
        "BLOCK_UNTIL_APPROVED"
    } else if warning > 0 {
        "PASS_WITH_WARNING"
    } else {
        "PASS"
    };

    let payload = json!({
        "schema_version": 1,
        "generated_at": Utc::now().to_rfc3339(),
        "root": root_path.to_string_lossy(),
        "workspace_id": workspace_id,
        "rules_hash": rules_hash,
        "summary": {
            "total_findings": total,
            "critical": critical,
            "warning": warning,
            "info": info,
            "release_recommendation": release_recommendation
        },
        "consumer_guides": {
            "ide": "Read highest severity first. Resolve Critical before merge. Treat Warning as risk debt with due date.",
            "cli": "Use guardian-cli scan --release-gate strict for release checks and persist report as .guardian/release_gate_report.json.",
            "llm_agents": "Read .guardian/critiques.json and .guardian/release_gate_report.json first. Do not auto-approve release based only on fix suggestions."
        },
        "findings": findings_payload
    });

    if let Ok(mut json_file) = fs::File::create(&summary_json_path) {
        let _ = writeln!(
            json_file,
            "{}",
            serde_json::to_string_pretty(&payload).unwrap_or_default()
        );
    }

    if let Ok(mut md_file) = fs::File::create(&summary_md_path) {
        let _ = writeln!(md_file, "# Guardian Governance Summary");
        let _ = writeln!(md_file, "Updated: {}", Utc::now().to_rfc3339());
        let _ = writeln!(md_file, "");
        let _ = writeln!(md_file, "- Root: `{}`", root_path.to_string_lossy());
        let _ = writeln!(md_file, "- Workspace ID: `{}`", workspace_id);
        let _ = writeln!(md_file, "- Rules Hash: `{}`", rules_hash);
        let _ = writeln!(
            md_file,
            "- Release Recommendation: `{}`",
            release_recommendation
        );
        let _ = writeln!(
            md_file,
            "- Counts: critical=`{}` warning=`{}` info=`{}` total=`{}`",
            critical, warning, info, total
        );
        let _ = writeln!(md_file, "");
        let _ = writeln!(md_file, "## Agent Notes");
        let _ = writeln!(
            md_file,
            "- IDE: show highest-severity findings first and link directly to file paths."
        );
        let _ = writeln!(
            md_file,
            "- CLI: prefer `guardian-cli scan --release-gate strict --format json` in CI."
        );
        let _ = writeln!(
            md_file,
            "- LLM Agents: do not auto-approve releases from suggestions; require explicit human decision."
        );
        let _ = writeln!(md_file, "");
        let _ = writeln!(md_file, "## Findings");
        if entries.is_empty() {
            let _ = writeln!(md_file, "- No active findings.");
        } else {
            for (rel_path, critique) in entries.iter().take(50) {
                let _ = writeln!(
                    md_file,
                    "- [{}] `{}`: {}",
                    normalize_severity_token(&critique.severity),
                    rel_path,
                    critique.message
                );
            }
            if entries.len() > 50 {
                let _ = writeln!(
                    md_file,
                    "- ... {} more findings in `governance_summary.json`",
                    entries.len().saturating_sub(50)
                );
            }
        }
    }
}

pub(super) fn sync_guardian_logs(
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

    write_governance_summary(
        root_path,
        &guardian_dir,
        &workspace_id,
        &rules_hash,
        critiques,
    );

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
