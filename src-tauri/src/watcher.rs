use crate::ai_client::AiClient;
use crate::config;
use crate::context::ProjectContext;
use crate::executor;
use crate::history_logger::{append_critique_event, append_history_event, HistoryEvent};
use crate::storage::StorageManager;
use crate::triage;
use chrono::Utc;
use guardian_scan_policy::{classify_path, is_infra_relevant_path, ScanProfile, SkipReason};
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

#[derive(Debug, Clone)]
struct AuditBackoffState {
    consecutive_failures: u32,
    cooldown_until: Instant,
    last_error: String,
    last_notice_at: Instant,
}

static AUDIT_BACKOFF_BY_ROOT: Lazy<Arc<RwLock<HashMap<String, AuditBackoffState>>>> =
    Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

const MAX_AGENT_QUEUE_BYTES: u64 = 1 * 1024 * 1024;
const MAX_AGENT_QUEUE_ARCHIVES: usize = 5;
const FIX_PROPOSALS_DIR: &str = ".guardian-proposals";
const FIX_PROPOSALS_FILE: &str = "fix_proposals.jsonl";
const DIFF_MAX_HUNKS: usize = 6;

// Note: Configuration constants moved to config.rs, accessed via config::*() functions

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

fn audit_backoff_remaining(root: &str) -> Option<Duration> {
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

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
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

fn warning_signal_score(critique: &crate::ai_client::Critique) -> i32 {
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

fn is_low_signal_warning(critique: &crate::ai_client::Critique) -> bool {
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

fn normalize_severity_token(raw: &str) -> String {
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

fn calibrate_critique_for_precision(
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

fn should_surface_critique(critique: &crate::ai_client::Critique, profile: ScanProfile) -> bool {
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

    parsed
        .critiques
        .retain(|critique| !critique.file_path.trim().is_empty());
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
    pub scan_profile: ScanProfile,
    pub language: String,
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
        scan_profile,
        language,
    } = config;

    let (batch_tx, batch_rx) = tokio::sync::mpsc::channel(100);

    let client = match AiClient::new(provider_id, host, model, api_key.into()) {
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
    let batch_intent = intent_pack.clone();
    let batch_root = target_path.clone();
    let batch_auto_verify_enabled = auto_verify_enabled;
    let batch_shutdown = shutdown.clone();
    let batch_profile = scan_profile;
    let batch_language = language.clone();
    tokio::spawn(async move {
        batch_processing_loop(
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

        let scan_limit = scan_profile_copy.initial_scan_limit();
        info!(
            target: "guardian::watcher",
            "Performing initial scan (profile={}, limit={})",
            scan_profile_copy.as_str(),
            scan_limit
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
            if scan_shutdown.load(Ordering::Relaxed) {
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
                let _ = storage.remove_file_fingerprint(&path_key);
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

#[derive(Clone)]
struct BatchItem {
    path: PathBuf,
    content: String,
    hash: String,
    mtime_ms: i64,
    bytes: i64,
    triage_risk_score: i64,
    triage_signals: Vec<&'static str>,
    triage_kind: triage::FileKind,
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
        if let Some(abs) = self
            .canonical_to_abs
            .get(canonical.to_string_lossy().as_ref())
        {
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
    intent_pack: Arc<String>,
    root: String,
    auto_verify_enabled: bool,
    shutdown: Arc<AtomicBool>,
    scan_profile: ScanProfile,
    language: String,
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
                        Some(intent_pack.as_str()),
                        &root,
                        auto_verify_enabled,
                        scan_profile,
                        language.as_str(),
                        &mut last_request,
                    )
                    .await;
                }
            },
            Some(item) = rx.recv() => {
                // Keep the freshest content per path; do not keep stale pre-debounce snapshots.
                upsert_batch_item(&mut batch, item);

                let effective_batch_size = std::cmp::min(config::max_batch_size(), scan_profile.max_batch_size());
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
                        &mut last_request,
                    )
                    .await;
                    interval.reset();
                }
            }
        }
    }
}

fn upsert_batch_item(batch: &mut Vec<BatchItem>, item: BatchItem) {
    if let Some(idx) = batch.iter().position(|existing| existing.path == item.path) {
        batch[idx] = item;
        return;
    }
    batch.push(item);
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
    let (prompt_data, estimated_tokens, hash_by_path, context_files) = build_prompt_data(&items);
    emit_ai_context(app, root, client, estimated_tokens, &context_files);
    append_ai_request_history(root, client, estimated_tokens, &context_files);

    let max_batch_prompt_tokens = config::max_batch_prompt_tokens();
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
            project_intent_pack,
            root,
            auto_verify_enabled,
            scan_profile,
            language,
            last_request,
        )
        .await;
        return;
    }

    let mut attempt = 0;
    loop {
        let call = client
            .analyze_batch_with_intent(project_intent_pack, language, prompt_data.clone())
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
                        project_intent_pack,
                        root,
                        auto_verify_enabled,
                        scan_profile,
                        language,
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
    last_request: &mut Instant,
) {
    for item in items {
        let single_items = vec![item];
        let (single_prompt, single_tokens, single_hash, single_context) =
            build_prompt_data(&single_items);
        emit_ai_context(app, root, client, single_tokens, &single_context);
        append_ai_request_history(root, client, single_tokens, &single_context);
        match client
            .analyze_batch_with_intent(project_intent_pack, language, single_prompt)
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
                let r_clone = root.to_string();
                let a_clone = app.clone();
                let lang = language.to_string();
                tokio::task::spawn_blocking(move || {
                    a_clone
                        .emit(
                            "guardian:analyzing",
                            ui_text(
                                lang.as_str(),
                                "Running Automatic Verification...",
                                "Otomatik doğrulama çalıştırılıyor...",
                            )
                            .to_string(),
                        )
                        .ok();
                    let verify_res = executor::auto_verify_project(&r_clone);
                    match verify_res {
                        Ok(msg) => {
                            if msg.contains("Passed") {
                                a_clone
                                    .emit(
                                        "guardian:info",
                                        if is_turkish(lang.as_str()) {
                                            format!("DOĞRULAMA BAŞARILI: {}", msg)
                                        } else {
                                            format!("VERIFICATION PASSED: {}", msg)
                                        },
                                    )
                                    .ok();
                            }
                        }
                        Err(err) => {
                            a_clone
                                .emit(
                                    "guardian:verification",
                                    if is_turkish(lang.as_str()) {
                                        format!("Doğrulama başarısız: {}", err)
                                    } else {
                                        format!("Verification failed: {}", err)
                                    },
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

    let current_hash = calculate_hash(&content);
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

    let mut joined = joined;
    let mut truncated = truncated;
    if item.triage_risk_score > 0 || !item.triage_signals.is_empty() {
        let signals = if item.triage_signals.is_empty() {
            "none".to_string()
        } else {
            item.triage_signals.join(", ")
        };
        let header = format!(
            "Triage: kind={}, risk_score={}, signals=[{}]\n\n",
            item.triage_kind.as_str(),
            item.triage_risk_score,
            signals
        );
        joined = format!("{header}{joined}");
        // Header can push us over configured limits; re-apply truncation guardrails.
        let re = truncate_context(joined, max_content_lines, max_content_chars, truncated);
        joined = re.0;
        truncated = re.1;
    }

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
