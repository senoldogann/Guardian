use crate::baseline::{load_baseline, resolve_baseline_path, Baseline};
use crate::guardian_lock::{self, LockMode};
use crate::output::{render_report, write_report, Finding, ReportFormat, ScanReport};
use crate::redaction::{is_sensitive_file, mask_inline_secrets};
use crate::run_manifest::{FileInventoryEntry, ManifestLimits, RunManifest};
use crate::rules_hash::get_rules_fingerprint;
use anyhow::{Context, Result};
use guardian_scan_policy::ScanProfile;
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub struct ScanConfig {
    pub root: PathBuf,
    pub format: ReportFormat,
    pub out: Option<PathBuf>,
    pub baseline_path: Option<PathBuf>,
    pub max_files: usize,
    pub max_file_bytes: u64,
    pub scan_profile: Option<ScanProfile>,
    pub offline: bool,
    pub mock: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub lock_path: Option<PathBuf>,
    pub lock_mode: LockMode,
    pub emit_manifest_path: Option<PathBuf>,
    pub emit_evidence_path: Option<PathBuf>,
    pub pr_gate: PrGateMode,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum PrGateMode {
    CriticalOnly,
    NewOnly,
    Off,
}

#[derive(Debug, Clone)]
struct ScannedFile {
    rel_path: String,
    content: String,
}

#[derive(Debug, Clone)]
struct CollectedFiles {
    scanned: Vec<ScannedFile>,
    inventory: Vec<FileInventoryEntry>,
}

#[derive(Debug, Clone)]
struct ProviderConfig {
    provider_id: String,
    base_url: String,
    model: String,
    api_key: SecretString,
}

#[derive(Debug, Clone, Deserialize)]
struct AiCritique {
    file_path: String,
    severity: String,
    message: String,
    #[serde(default)]
    suggestion: Option<String>,
    #[serde(default)]
    suggested_diff: Option<String>,
}

pub fn run_scan(cfg: ScanConfig) -> Result<i32> {
    let root = dunce::canonicalize(&cfg.root).unwrap_or_else(|_| cfg.root.clone());
    if !root.exists() || !root.is_dir() {
        anyhow::bail!("Root is not a directory: {}", root.display());
    }

    let rules_hash = get_rules_fingerprint(&root);
    if rules_hash.is_empty() {
        eprintln!(
            "guardian-cli: warning: rules hash is empty (missing .agent/rules under {}).",
            root.display()
        );
    }

    let baseline_path = resolve_baseline_path(&root, cfg.baseline_path.clone());
    let baseline = match baseline_path.as_deref() {
        Some(path) => Some(load_and_validate_baseline(path, &rules_hash)?),
        None => None,
    };
    let baseline_set: HashSet<&str> = baseline
        .as_ref()
        .map(|b| b.finding_id_set())
        .unwrap_or_default();

    let mut report = ScanReport::new(
        root.to_string_lossy().to_string(),
        rules_hash.clone(),
        baseline_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
    );

    let scan_profile = resolve_scan_profile(&cfg)?;
    report.scan_profile = Some(scan_profile.as_str().to_string());

    let resolved_lock_path = guardian_lock::resolve_lock_path(&root, cfg.lock_path.clone());
    let lock_summary =
        guardian_lock::sync_guardian_lock(&root, &rules_hash, &resolved_lock_path, cfg.lock_mode)?;
    if lock_summary.status == "synced_with_warning" {
        eprintln!("guardian-cli: warning: {}", lock_summary.message);
    }
    report.guardian_lock = Some(lock_summary);

    let mut exclude_rel_paths: HashSet<String> = HashSet::new();
    if let Some(out) = cfg.out.as_deref() {
        if let Some(rel) = rel_path_under_root(&root, out) {
            exclude_rel_paths.insert(rel);
        }
    }
    if let Some(out) = cfg.emit_manifest_path.as_deref() {
        if let Some(rel) = rel_path_under_root(&root, out) {
            exclude_rel_paths.insert(rel);
        }
    }
    if let Some(out) = cfg.emit_evidence_path.as_deref() {
        if let Some(rel) = rel_path_under_root(&root, out) {
            exclude_rel_paths.insert(rel);
        }
    }

    let collected = collect_files(
        &root,
        scan_profile,
        cfg.max_files,
        cfg.max_file_bytes,
        &exclude_rel_paths,
    )?;
    report.summary.files_scanned = collected.scanned.len();

    let manifest = RunManifest::new(
        root.to_string_lossy().to_string(),
        compute_workspace_id(&root),
        rules_hash.clone(),
        scan_profile.as_str().to_string(),
        ManifestLimits {
            max_files: cfg.max_files,
            max_file_bytes: cfg.max_file_bytes,
            max_batch_size: scan_profile.max_batch_size(),
        },
        collected.inventory.clone(),
    );
    let manifest_hash = manifest.stable_hash_hex();
    report.manifest_hash = Some(manifest_hash);

    if let Some(path) = cfg.emit_manifest_path.as_deref() {
        write_json_pretty(path, &manifest)?;
        report.manifest_path = Some(path.to_string_lossy().to_string());
    }

    let findings = if cfg.offline || cfg.mock || env_flag("GUARDIAN_MOCK") {
        offline_scan(&rules_hash, &baseline_set, &collected.scanned)
    } else {
        let provider = resolve_provider(&cfg)?;
        ai_scan(
            &root,
            &rules_hash,
            &baseline_set,
            &collected.scanned,
            &provider,
            scan_profile,
        )?
    };

    report.findings = findings;
    report.summary.findings = report.findings.len();
    report.summary.new_findings = report.findings.iter().filter(|f| f.is_new).count();
    report.summary.new_critical = report
        .findings
        .iter()
        .filter(|f| f.is_new && f.severity.eq_ignore_ascii_case("Critical"))
        .count();

    let payload = render_report(&report, cfg.format)?;
    write_report(&payload, cfg.out.as_deref())?;

    let exit_code = match cfg.pr_gate {
        PrGateMode::CriticalOnly => {
            if report.summary.new_critical > 0 {
                1
            } else {
                0
            }
        }
        PrGateMode::NewOnly => {
            if report.summary.new_findings > 0 {
                1
            } else {
                0
            }
        }
        PrGateMode::Off => 0,
    };

    Ok(exit_code)
}

fn load_and_validate_baseline(path: &Path, rules_hash: &str) -> Result<Baseline> {
    let baseline = load_baseline(path)?;
    if baseline.schema_version != 2 {
        anyhow::bail!(
            "Unsupported baseline schema_version={}. Recreate baseline with the latest Guardian.",
            baseline.schema_version
        );
    }
    if baseline.rules_hash != rules_hash {
        anyhow::bail!(
            "Baseline rules_hash mismatch. baseline={}, current={}. Recreate baseline.",
            baseline.rules_hash,
            rules_hash
        );
    }
    Ok(baseline)
}

fn env_flag(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn resolve_provider(cfg: &ScanConfig) -> Result<ProviderConfig> {
    let provider_id = cfg
        .provider
        .clone()
        .or_else(|| std::env::var("GUARDIAN_PROVIDER").ok())
        .unwrap_or_else(|| "anthropic".to_string())
        .trim()
        .to_lowercase();

    let api_key = cfg
        .api_key
        .clone()
        .or_else(|| std::env::var("GUARDIAN_API_KEY").ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    if api_key.is_empty() {
        anyhow::bail!("Missing API key. Set GUARDIAN_API_KEY or pass --api-key (not recommended).");
    }

    let model = cfg
        .model
        .clone()
        .or_else(|| std::env::var("GUARDIAN_MODEL").ok())
        .unwrap_or_default()
        .trim()
        .to_string();
    if model.is_empty() {
        anyhow::bail!("Missing model. Set GUARDIAN_MODEL or pass --model.");
    }

    let base_url = cfg
        .base_url
        .clone()
        .or_else(|| std::env::var("GUARDIAN_BASE_URL").ok())
        .unwrap_or_else(|| default_base_url(&provider_id).to_string());

    Ok(ProviderConfig {
        provider_id,
        base_url,
        model,
        api_key: SecretString::new(api_key.into()),
    })
}

fn default_base_url(provider_id: &str) -> &'static str {
    match provider_id {
        "openai" => "https://api.openai.com/v1",
        "anthropic" => "https://api.anthropic.com/v1",
        "gemini" => "https://generativelanguage.googleapis.com/v1beta",
        "ollama" => "http://localhost:11434",
        _ => "https://api.anthropic.com/v1",
    }
}

fn resolve_scan_profile(cfg: &ScanConfig) -> Result<ScanProfile> {
    if let Some(profile) = cfg.scan_profile {
        return Ok(profile);
    }
    if let Ok(value) = std::env::var("GUARDIAN_SCAN_PROFILE") {
        if !value.trim().is_empty() {
            return value.parse::<ScanProfile>().map_err(anyhow::Error::msg);
        }
    }
    Ok(ScanProfile::Source)
}

fn collect_files(
    root: &Path,
    profile: ScanProfile,
    max_files: usize,
    max_file_bytes: u64,
    exclude_rel_paths: &HashSet<String>,
) -> Result<CollectedFiles> {
    let walker = ignore::WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .build();

    let mut scanned: Vec<ScannedFile> = Vec::new();
    let mut inventory: Vec<FileInventoryEntry> = Vec::new();
    // Keep manifest output bounded even on huge workspaces.
    let max_inventory = std::cmp::min(max_files.saturating_mul(5).max(200), 2_000);

    for result in walker {
        let entry = match result {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }

        let abs_path = entry.into_path();
        let rel_path = match abs_path.strip_prefix(root) {
            Ok(rel) => rel.to_string_lossy().replace('\\', "/"),
            Err(_) => abs_path.to_string_lossy().replace('\\', "/"),
        };

        if exclude_rel_paths.contains(&rel_path) {
            continue;
        }

        // Avoid self-referential drift: guardian.lock is a tool-generated artifact that can change
        // between runs and should not affect reproducibility signals.
        if rel_path.eq_ignore_ascii_case("guardian.lock") {
            continue;
        }

        let meta_len = fs::metadata(&abs_path).map(|m| m.len()).unwrap_or(0);

        // Keep collecting skip reasons (up to max_inventory), but stop scanning file contents once
        // the scanned file limit is reached.
        if scanned.len() >= max_files {
            if inventory.len() < max_inventory {
                inventory.push(FileInventoryEntry {
                    path_rel: rel_path.clone(),
                    reason: "max_files_limit".to_string(),
                    bytes: meta_len,
                    sha256: None,
                });
            }
            if inventory.len() >= max_inventory {
                break;
            }
            continue;
        }

        if is_sensitive_file(&abs_path) {
            if inventory.len() < max_inventory {
                inventory.push(FileInventoryEntry {
                    path_rel: rel_path.clone(),
                    reason: "sensitive".to_string(),
                    bytes: meta_len,
                    sha256: None,
                });
            }
            continue;
        }

        let decision = guardian_scan_policy::classify_path(&abs_path, false, profile);
        if !decision.include {
            if inventory.len() < max_inventory {
                inventory.push(FileInventoryEntry {
                    path_rel: rel_path.clone(),
                    reason: decision
                        .reason
                        .map(|r| r.as_str().to_string())
                        .unwrap_or_else(|| "profile_skip".to_string()),
                    bytes: meta_len,
                    sha256: None,
                });
            }
            continue;
        }

        if meta_len > max_file_bytes {
            if inventory.len() < max_inventory {
                inventory.push(FileInventoryEntry {
                    path_rel: rel_path.clone(),
                    reason: "max_file_bytes".to_string(),
                    bytes: meta_len,
                    sha256: None,
                });
            }
            continue;
        }

        let Ok(content) = fs::read_to_string(&abs_path) else {
            if inventory.len() < max_inventory {
                inventory.push(FileInventoryEntry {
                    path_rel: rel_path.clone(),
                    reason: "read_error".to_string(),
                    bytes: meta_len,
                    sha256: None,
                });
            }
            continue;
        };

        let sha256 = sha256_hex(content.as_bytes());
        if inventory.len() < max_inventory {
            inventory.push(FileInventoryEntry {
                path_rel: rel_path.clone(),
                reason: "included".to_string(),
                bytes: meta_len,
                sha256: Some(sha256.clone()),
            });
        }

        let masked = mask_inline_secrets(&content);
        let truncated = truncate_content(&masked);

        scanned.push(ScannedFile {
            rel_path,
            content: truncated,
        });
    }

    Ok(CollectedFiles { scanned, inventory })
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn write_json_pretty<T: serde::Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create output directory: {}", parent.display()))?;
        }
    }
    let payload = serde_json::to_string_pretty(value).context("JSON encode failed")?;
    fs::write(path, payload).with_context(|| format!("Failed to write file: {}", path.display()))?;
    Ok(())
}

fn compute_workspace_id(root: &Path) -> String {
    let normalized = dunce::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    sha256_hex(normalized.to_string_lossy().as_bytes())
}

fn rel_path_under_root(root: &Path, path: &Path) -> Option<String> {
    let abs = if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    };
    abs.strip_prefix(root)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
}

fn truncate_content(content: &str) -> String {
    const MAX_LINES: usize = 260;
    const MAX_CHARS: usize = 10_000;

    let mut lines: Vec<&str> = content.lines().collect();
    if lines.len() > MAX_LINES {
        lines.truncate(MAX_LINES);
    }
    let mut joined = lines.join("\n");
    if joined.len() > MAX_CHARS {
        joined.truncate(MAX_CHARS);
        joined.push_str("\n... (truncated)");
    }
    joined
}

fn offline_scan(
    rules_hash: &str,
    baseline_set: &HashSet<&str>,
    files: &[ScannedFile],
) -> Vec<Finding> {
    let mut out = Vec::new();
    for file in files {
        if let Some((severity, message, suggestion)) =
            offline_analyze(&file.rel_path, &file.content)
        {
            let finding_id = finding_id_for_file(rules_hash, severity, file.rel_path.as_str());
            let is_new = !baseline_set.contains(finding_id.as_str());
            out.push(Finding {
                finding_id,
                file_path: file.rel_path.clone(),
                severity: severity.to_string(),
                message,
                suggestion,
                suggested_diff: None,
                is_new,
            });
        }
    }
    // Stable ordering: New first, then severity, then path.
    out.sort_by(|a, b| {
        let a_new = if a.is_new { 0 } else { 1 };
        let b_new = if b.is_new { 0 } else { 1 };
        if a_new != b_new {
            return a_new.cmp(&b_new);
        }
        severity_rank(&a.severity)
            .cmp(&severity_rank(&b.severity))
            .then_with(|| a.file_path.cmp(&b.file_path))
    });
    out
}

fn severity_rank(sev: &str) -> u8 {
    match sev.to_lowercase().as_str() {
        "critical" => 0,
        "warning" => 1,
        _ => 2,
    }
}

fn offline_analyze(
    file_path: &str,
    content: &str,
) -> Option<(&'static str, String, Option<String>)> {
    let lower = content.to_lowercase();

    let critical_patterns = ["eval(", "child_process.exec(", "child_process.execsync("];
    if critical_patterns
        .iter()
        .any(|p| contains_code_token(&lower, p))
    {
        return Some((
            "Critical",
            format!("Potential security risk detected in {file_path} (contains dangerous API)."),
            Some("Remove dangerous APIs or add strict input validation + allowlist.".to_string()),
        ));
    }

    if contains_code_token(&lower, "dangerouslysetinnerhtml") {
        return Some((
            "Warning",
            format!("Potential XSS risk in {file_path} (dangerouslySetInnerHTML)."),
            Some(
                "Ensure content is trusted or sanitized; avoid rendering untrusted HTML."
                    .to_string(),
            ),
        ));
    }

    if lower.contains(".unwrap(") || lower.contains(".unwrap()") {
        return Some((
            "Warning",
            format!("Potential reliability risk in {file_path} (unwrap can panic)."),
            Some("Prefer Result/Option handling (match/?) and propagate errors.".to_string()),
        ));
    }

    if lower.contains("todo") && lower.contains("security") {
        return Some((
            "Warning",
            format!("Security TODO present in {file_path}."),
            Some("Resolve the TODO or add tracking ticket + rationale.".to_string()),
        ));
    }

    None
}

fn contains_code_token(haystack_lower: &str, needle_lower: &str) -> bool {
    let bytes = haystack_lower.as_bytes();
    let mut start = 0usize;
    while let Some(pos) = haystack_lower[start..].find(needle_lower) {
        let idx = start + pos;
        let prev = idx.checked_sub(1).and_then(|p| bytes.get(p).copied());
        let ok_prev = match prev {
            None => true,
            Some(b) => {
                let is_quote = matches!(b, b'"' | b'\'' | b'`');
                let is_word = (b as char).is_ascii_alphanumeric() || b == b'_';
                !is_quote && !is_word
            }
        };
        if ok_prev {
            return true;
        }
        start = idx + needle_lower.len();
    }
    false
}

fn ai_scan(
    root: &Path,
    rules_hash: &str,
    baseline_set: &HashSet<&str>,
    files: &[ScannedFile],
    provider: &ProviderConfig,
    profile: ScanProfile,
) -> Result<Vec<Finding>> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .context("Failed to build HTTP client")?;

    let batch_size = profile.max_batch_size().max(1);
    let mut out: Vec<Finding> = Vec::new();

    for chunk in files.chunks(batch_size) {
        let (prompt, allowed_paths) = build_batch_prompt(chunk);
        let response = send_provider_request(&client, provider, &prompt)?;
        let critiques = parse_ai_response(&response)?;
        for critique in critiques {
            if critique.message.trim().eq_ignore_ascii_case("LGTM") {
                continue;
            }
            let normalized_path =
                normalize_ai_path(root, critique.file_path.as_str(), &allowed_paths);
            let Some(file_path) = normalized_path else {
                continue;
            };
            let severity = normalize_severity(&critique.severity);
            let finding_id = finding_id_for_file(rules_hash, severity, file_path.as_str());
            let is_new = !baseline_set.contains(finding_id.as_str());
            out.push(Finding {
                finding_id,
                file_path,
                severity: severity.to_string(),
                message: critique.message,
                suggestion: critique.suggestion,
                suggested_diff: critique.suggested_diff,
                is_new,
            });
        }
    }

    out.sort_by(|a, b| {
        let a_new = if a.is_new { 0 } else { 1 };
        let b_new = if b.is_new { 0 } else { 1 };
        if a_new != b_new {
            return a_new.cmp(&b_new);
        }
        severity_rank(&a.severity)
            .cmp(&severity_rank(&b.severity))
            .then_with(|| a.file_path.cmp(&b.file_path))
    });

    Ok(out)
}

fn build_batch_prompt(files: &[ScannedFile]) -> (String, HashSet<String>) {
    let mut allowed = HashSet::new();
    let mut prompt = String::new();
    prompt.push_str("You are Guardian, a strict security + architecture reviewer.\n");
    prompt.push_str("Return ONLY a valid JSON array of objects with keys: file_path, severity, message, suggestion, suggested_diff.\n");
    prompt.push_str("Rules:\n");
    prompt.push_str("- file_path MUST exactly match one of the provided Path values.\n");
    prompt.push_str("- severity MUST be one of: Info, Warning, Critical, LGTM.\n");
    prompt.push_str("- message MUST include WHY (risk/impact).\n");
    prompt.push_str("- suggested_diff, if present, MUST be FULL file content only (no diff markers, no markdown).\n\n");

    for (idx, file) in files.iter().enumerate() {
        allowed.insert(file.rel_path.clone());
        prompt.push_str(&format!(
            "--- FILE {} ---\nPath: {}\nContent:\n{}\n\n",
            idx + 1,
            file.rel_path,
            file.content
        ));
    }

    (prompt, allowed)
}

fn send_provider_request(
    client: &reqwest::blocking::Client,
    provider: &ProviderConfig,
    prompt: &str,
) -> Result<String> {
    match provider.provider_id.as_str() {
        "anthropic" => send_anthropic(client, provider, prompt),
        "openai" => send_openai(client, provider, prompt),
        "gemini" => send_gemini(client, provider, prompt),
        "ollama" => send_ollama(client, provider, prompt),
        other => anyhow::bail!("Unsupported provider: {}", other),
    }
}

fn send_anthropic(
    client: &reqwest::blocking::Client,
    provider: &ProviderConfig,
    prompt: &str,
) -> Result<String> {
    let payload = serde_json::json!({
        "model": provider.model,
        "max_tokens": 2048,
        "system": "You are Guardian. Output JSON only.",
        "messages": [{ "role": "user", "content": prompt }]
    });
    let url = format!("{}/messages", provider.base_url.trim_end_matches('/'));
    let response = client
        .post(&url)
        .header("x-api-key", provider.api_key.expose_secret())
        .header("anthropic-version", "2023-06-01")
        .json(&payload)
        .send()?;
    if !response.status().is_success() {
        anyhow::bail!(
            "Anthropic request failed: {}",
            response.text().unwrap_or_default()
        );
    }
    let response_json: serde_json::Value = response.json()?;
    let content = response_json["content"]
        .as_array()
        .context("Invalid Anthropic response format")?;
    let mut collected = String::new();
    for block in content {
        if let Some(text) = block["text"].as_str() {
            collected.push_str(text);
        }
    }
    Ok(collected)
}

fn send_openai(
    client: &reqwest::blocking::Client,
    provider: &ProviderConfig,
    prompt: &str,
) -> Result<String> {
    let payload = serde_json::json!({
        "model": provider.model,
        "messages": [
            { "role": "system", "content": "You are Guardian. Output JSON only." },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.2
    });
    let url = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );
    let response = client
        .post(&url)
        .bearer_auth(provider.api_key.expose_secret())
        .json(&payload)
        .send()?;
    if !response.status().is_success() {
        anyhow::bail!(
            "OpenAI request failed: {}",
            response.text().unwrap_or_default()
        );
    }
    let response_json: serde_json::Value = response.json()?;
    let content_str = response_json["choices"][0]["message"]["content"]
        .as_str()
        .context("Invalid OpenAI response format")?;
    Ok(content_str.to_string())
}

fn send_gemini(
    client: &reqwest::blocking::Client,
    provider: &ProviderConfig,
    prompt: &str,
) -> Result<String> {
    let model_path = if provider.model.starts_with("models/") {
        provider.model.clone()
    } else {
        format!("models/{}", provider.model)
    };
    let payload = serde_json::json!({
        "systemInstruction": { "parts": [{ "text": "You are Guardian. Output JSON only." }] },
        "contents": [{ "role": "user", "parts": [{ "text": prompt }] }]
    });
    let url = format!(
        "{}/{}:generateContent",
        provider.base_url.trim_end_matches('/'),
        model_path
    );
    let response = client
        .post(&url)
        .header("x-goog-api-key", provider.api_key.expose_secret())
        .json(&payload)
        .send()?;
    if !response.status().is_success() {
        anyhow::bail!(
            "Gemini request failed: {}",
            response.text().unwrap_or_default()
        );
    }
    let response_json: serde_json::Value = response.json()?;
    let candidates = response_json["candidates"]
        .as_array()
        .context("Invalid Gemini response format")?;
    let mut collected = String::new();
    if let Some(first) = candidates.first() {
        if let Some(parts) = first["content"]["parts"].as_array() {
            for part in parts {
                if let Some(text) = part["text"].as_str() {
                    collected.push_str(text);
                }
            }
        }
    }
    Ok(collected)
}

fn send_ollama(
    client: &reqwest::blocking::Client,
    provider: &ProviderConfig,
    prompt: &str,
) -> Result<String> {
    let payload = serde_json::json!({
        "model": provider.model,
        "messages": [
            { "role": "system", "content": "You are Guardian. Output JSON only." },
            { "role": "user", "content": prompt }
        ],
        "stream": false
    });
    let url = format!("{}/api/chat", provider.base_url.trim_end_matches('/'));
    let response = client.post(&url).json(&payload).send()?;
    if !response.status().is_success() {
        anyhow::bail!(
            "Ollama request failed: {}",
            response.text().unwrap_or_default()
        );
    }
    let response_json: serde_json::Value = response.json()?;
    let content_str = response_json["message"]["content"]
        .as_str()
        .context("Invalid Ollama response format")?;
    Ok(content_str.to_string())
}

fn parse_ai_response(raw: &str) -> Result<Vec<AiCritique>> {
    let cleaned = sanitize_json_response(raw);
    if let Ok(items) = serde_json::from_str::<Vec<AiCritique>>(cleaned) {
        return Ok(items);
    }
    if let Ok(item) = serde_json::from_str::<AiCritique>(cleaned) {
        return Ok(vec![item]);
    }
    anyhow::bail!("Failed to parse AI JSON response (expected array).");
}

fn sanitize_json_response(content: &str) -> &str {
    let start_brace = content.find('{');
    let start_bracket = content.find('[');

    let start = match (start_brace, start_bracket) {
        (Some(a), Some(b)) => std::cmp::min(a, b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => return content.trim(),
    };

    let end_brace = content.rfind('}');
    let end_bracket = content.rfind(']');

    let end = match (end_brace, end_bracket) {
        (Some(a), Some(b)) => std::cmp::max(a, b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => return content.trim(),
    };

    if start <= end {
        &content[start..=end]
    } else {
        content.trim()
    }
}

fn normalize_severity(input: &str) -> &'static str {
    match input.trim().to_lowercase().as_str() {
        "critical" => "Critical",
        "warning" => "Warning",
        "lgtm" => "Info",
        _ => "Info",
    }
}

fn normalize_ai_path(root: &Path, file_path: &str, allowed: &HashSet<String>) -> Option<String> {
    let cleaned = file_path.trim().replace('\\', "/");
    if allowed.contains(cleaned.as_str()) {
        return Some(cleaned);
    }

    let abs = Path::new(&cleaned);
    if abs.is_absolute() {
        if let Ok(rel) = abs.strip_prefix(root) {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if allowed.contains(rel_str.as_str()) {
                return Some(rel_str);
            }
        }
    }

    None
}

fn finding_id_for_file(rules_hash: &str, severity: &str, rel_path: &str) -> String {
    let sev = severity.trim().to_lowercase();
    let rule_id = format!("guardian-v1::{sev}");
    let normalized = format!("{rule_id}|{rel_path}||{rules_hash}");
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::output::ScanReport;
    use std::fs;
    use tempfile::TempDir;

    fn write_file(root: &Path, rel: &str, content: &str) {
        let path = root.join(rel);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn collect_files_prioritizes_source_code_and_skips_noise() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();

        write_file(root, "src/main.ts", "export const a = 1;\n");
        write_file(root, "main.py", "print('ok')\n");
        write_file(root, "tests/main.test.ts", "describe('x', () => {})\n");
        write_file(root, "docs/guide.md", "# docs\n");
        write_file(root, "scripts/release.sh", "echo release\n");
        write_file(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
        write_file(root, "Dockerfile", "FROM node:20\n");
        write_file(root, "policy-engine.Dockerfile", "FROM rust:1.80\n");

        let collected =
            collect_files(root, ScanProfile::Source, 100, 50_000, &HashSet::new()).unwrap();
        let mut paths: Vec<String> = collected.scanned.into_iter().map(|f| f.rel_path).collect();
        paths.sort();

        assert_eq!(paths, vec!["main.py".to_string(), "src/main.ts".to_string()]);
    }

    #[test]
    fn manifest_hash_is_deterministic_ignoring_timestamps() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "export const a = 1;\n");
        write_file(root, "Dockerfile", "FROM node:20\n");
        write_file(root, ".env", "OPENAI_KEY=sk-123\n");

        let collected_1 =
            collect_files(root, ScanProfile::Source, 50, 50_000, &HashSet::new()).unwrap();
        let hash_1 = RunManifest::new(
            root.to_string_lossy().to_string(),
            compute_workspace_id(root),
            "".to_string(),
            ScanProfile::Source.as_str().to_string(),
            ManifestLimits {
                max_files: 50,
                max_file_bytes: 50_000,
                max_batch_size: ScanProfile::Source.max_batch_size(),
            },
            collected_1.inventory,
        )
        .stable_hash_hex();

        let collected_2 =
            collect_files(root, ScanProfile::Source, 50, 50_000, &HashSet::new()).unwrap();
        let hash_2 = RunManifest::new(
            root.to_string_lossy().to_string(),
            compute_workspace_id(root),
            "".to_string(),
            ScanProfile::Source.as_str().to_string(),
            ManifestLimits {
                max_files: 50,
                max_file_bytes: 50_000,
                max_batch_size: ScanProfile::Source.max_batch_size(),
            },
            collected_2.inventory,
        )
        .stable_hash_hex();

        assert_eq!(hash_1, hash_2);
    }

    #[test]
    fn manifest_inventory_records_sensitive_and_profile_skips() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "export const a = 1;\n");
        write_file(root, ".env", "OPENAI_KEY=sk-123\n");
        write_file(root, "Dockerfile", "FROM node:20\n");

        let collected =
            collect_files(root, ScanProfile::Source, 50, 50_000, &HashSet::new()).unwrap();
        let mut by_path: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        for entry in collected.inventory {
            by_path.insert(entry.path_rel, entry.reason);
        }

        assert_eq!(by_path.get(".env").map(|s| s.as_str()), Some("sensitive"));
        assert_eq!(
            by_path.get("Dockerfile").map(|s| s.as_str()),
            Some("ignored_file_name")
        );
    }

    #[test]
    fn extended_profile_includes_dockerfile_in_scan() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "export const a = 1;\n");
        write_file(root, "Dockerfile", "FROM node:20\n");

        let collected =
            collect_files(root, ScanProfile::Extended, 50, 50_000, &HashSet::new()).unwrap();
        let paths: Vec<String> = collected.scanned.into_iter().map(|f| f.rel_path).collect();
        assert!(paths.contains(&"Dockerfile".to_string()));
    }

    #[test]
    fn offline_scan_returns_exit_1_for_new_critical_findings() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "const x = eval('1+1');\n");

        let report_path = root.join("report.json");
        let code = run_scan(ScanConfig {
            root: root.to_path_buf(),
            format: ReportFormat::Json,
            out: Some(report_path),
            baseline_path: None,
            max_files: 50,
            max_file_bytes: 50_000,
            scan_profile: None,
            offline: true,
            mock: false,
            provider: None,
            model: None,
            base_url: None,
            api_key: None,
            lock_path: None,
            lock_mode: LockMode::Warn,
            emit_manifest_path: None,
            emit_evidence_path: None,
            pr_gate: PrGateMode::CriticalOnly,
        })
        .unwrap();

        assert_eq!(code, 1);
    }

    #[test]
    fn offline_scan_does_not_flag_string_literal_matches_as_critical() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "const s = \"eval(\";\n");

        let report_path = root.join("report.json");
        let code = run_scan(ScanConfig {
            root: root.to_path_buf(),
            format: ReportFormat::Json,
            out: Some(report_path),
            baseline_path: None,
            max_files: 50,
            max_file_bytes: 50_000,
            scan_profile: None,
            offline: true,
            mock: false,
            provider: None,
            model: None,
            base_url: None,
            api_key: None,
            lock_path: None,
            lock_mode: LockMode::Warn,
            emit_manifest_path: None,
            emit_evidence_path: None,
            pr_gate: PrGateMode::CriticalOnly,
        })
        .unwrap();

        assert_eq!(code, 0);
    }

    #[test]
    fn baseline_suppresses_known_critical_findings() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "const x = eval('1+1');\n");

        let report_path = root.join("report.json");
        let _ = run_scan(ScanConfig {
            root: root.to_path_buf(),
            format: ReportFormat::Json,
            out: Some(report_path.clone()),
            baseline_path: None,
            max_files: 50,
            max_file_bytes: 50_000,
            scan_profile: None,
            offline: true,
            mock: false,
            provider: None,
            model: None,
            base_url: None,
            api_key: None,
            lock_path: None,
            lock_mode: LockMode::Warn,
            emit_manifest_path: None,
            emit_evidence_path: None,
            pr_gate: PrGateMode::CriticalOnly,
        })
        .unwrap();

        let raw = fs::read_to_string(&report_path).unwrap();
        let report: ScanReport = serde_json::from_str(&raw).unwrap();
        assert_eq!(report.findings.len(), 1);
        let finding_id = report.findings[0].finding_id.clone();

        let baseline_path = root.join("baseline.json");
        let baseline = Baseline {
            schema_version: 2,
            created_at: "2026-02-09T00:00:00Z".to_string(),
            workspace_id: "test".to_string(),
            rules_hash: report.rules_hash.clone(),
            finding_ids: vec![finding_id],
            findings: Vec::new(),
        };
        fs::write(
            &baseline_path,
            serde_json::to_string_pretty(&baseline).unwrap(),
        )
        .unwrap();

        let report_path_2 = root.join("report2.json");
        let code = run_scan(ScanConfig {
            root: root.to_path_buf(),
            format: ReportFormat::Json,
            out: Some(report_path_2),
            baseline_path: Some(baseline_path),
            max_files: 50,
            max_file_bytes: 50_000,
            scan_profile: None,
            offline: true,
            mock: false,
            provider: None,
            model: None,
            base_url: None,
            api_key: None,
            lock_path: None,
            lock_mode: LockMode::Warn,
            emit_manifest_path: None,
            emit_evidence_path: None,
            pr_gate: PrGateMode::CriticalOnly,
        })
        .unwrap();

        assert_eq!(code, 0);
    }

    #[test]
    fn strict_lock_mode_rejects_rules_hash_mismatch() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        write_file(root, "src/a.ts", "const x = 1;\n");

        let first_report = root.join("report1.json");
        run_scan(ScanConfig {
            root: root.to_path_buf(),
            format: ReportFormat::Json,
            out: Some(first_report),
            baseline_path: None,
            max_files: 50,
            max_file_bytes: 50_000,
            scan_profile: None,
            offline: true,
            mock: false,
            provider: None,
            model: None,
            base_url: None,
            api_key: None,
            lock_path: None,
            lock_mode: LockMode::Warn,
            emit_manifest_path: None,
            emit_evidence_path: None,
            pr_gate: PrGateMode::CriticalOnly,
        })
        .unwrap();

        let lock_path = root.join("guardian.lock");
        let mut lock_json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&lock_path).unwrap()).unwrap();
        lock_json["rules_hash"] = serde_json::Value::String("outdated".to_string());
        fs::write(
            &lock_path,
            serde_json::to_string_pretty(&lock_json).unwrap(),
        )
        .unwrap();

        let second_report = root.join("report2.json");
        let result = run_scan(ScanConfig {
            root: root.to_path_buf(),
            format: ReportFormat::Json,
            out: Some(second_report),
            baseline_path: None,
            max_files: 50,
            max_file_bytes: 50_000,
            scan_profile: None,
            offline: true,
            mock: false,
            provider: None,
            model: None,
            base_url: None,
            api_key: None,
            lock_path: None,
            lock_mode: LockMode::Strict,
            emit_manifest_path: None,
            emit_evidence_path: None,
            pr_gate: PrGateMode::CriticalOnly,
        });

        assert!(result.is_err());
    }
}
