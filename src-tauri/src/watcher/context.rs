use crate::ai_client::AiClient;
use crate::config;
use crate::history_logger::{append_history_event, HistoryEvent};
use chrono::Utc;
use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use similar::{ChangeTag, TextDiff};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

use super::BatchItem;

pub(super) const DIFF_MAX_HUNKS: usize = 6;

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

pub(super) static LAST_AI_CONTEXT: Lazy<Arc<RwLock<Option<AiContextSnapshot>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

#[derive(Debug, Clone)]
pub(super) struct AuditedContentCacheEntry {
    pub(super) content: String,
    pub(super) last_seen_epoch_ms: i64,
}

pub(super) static LAST_AUDITED_CONTENTS: Lazy<
    Arc<RwLock<HashMap<String, AuditedContentCacheEntry>>>,
> = Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

pub(crate) fn last_ai_context_for_root(root: &str) -> Option<AiContextSnapshot> {
    let Ok(lock) = LAST_AI_CONTEXT.read() else {
        return None;
    };
    lock.as_ref().filter(|snap| snap.root == root).cloned()
}

pub(super) fn calculate_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    hex::encode(hasher.finalize())
}

pub(super) fn estimate_tokens(content: &str) -> u64 {
    let rough_tokens = (content.len() as f64 / 4.0).ceil() as u64;
    rough_tokens.max(1)
}

pub(super) fn should_exclude_file(path: &std::path::Path) -> bool {
    crate::redaction::gate::is_sensitive_file(path)
}

pub(super) fn filter_pii(content: &str) -> String {
    crate::redaction::gate::mask_inline_secrets(content)
}

pub(super) fn enforce_last_audited_cache_limit(
    cache: &mut HashMap<String, AuditedContentCacheEntry>,
    max_entries: usize,
) {
    if max_entries == 0 || cache.len() <= max_entries {
        return;
    }

    let remove_count = cache.len().saturating_sub(max_entries);
    let mut by_age: Vec<(String, i64)> = cache
        .iter()
        .map(|(path, entry)| (path.clone(), entry.last_seen_epoch_ms))
        .collect();
    by_age.sort_by_key(|(_, ts)| *ts);

    for (path, _) in by_age.into_iter().take(remove_count) {
        cache.remove(&path);
    }
}

pub(super) fn update_last_audited_contents(items: &[BatchItem]) {
    let Ok(mut lock) = LAST_AUDITED_CONTENTS.write() else {
        return;
    };
    let now_ms = Utc::now().timestamp_millis();
    for item in items {
        let key = item.path.to_string_lossy().to_string();
        let filtered = filter_pii(&item.content);
        lock.insert(
            key,
            AuditedContentCacheEntry {
                content: filtered,
                last_seen_epoch_ms: now_ms,
            },
        );
    }
    enforce_last_audited_cache_limit(&mut lock, config::last_audited_cache_max_entries());
}

pub(super) fn last_audited_content(path: &std::path::Path) -> Option<String> {
    let key = path.to_string_lossy().to_string();
    let Ok(lock) = LAST_AUDITED_CONTENTS.read() else {
        return None;
    };
    lock.get(&key).map(|entry| entry.content.clone())
}

pub(super) fn prepare_ai_context_file(
    item: &BatchItem,
    root_path: &std::path::Path,
) -> AiContextFile {
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

    // Enrich with import context
    let file_path_str = item.path.to_string_lossy();
    let imports = extract_local_imports(&filtered, &file_path_str);
    let import_ctx = build_import_context(&imports, &file_path_str, root_path, 2000);
    if !import_ctx.is_empty() {
        joined.push_str(&import_ctx);
        let re = truncate_context(joined, max_content_lines, max_content_chars, truncated);
        joined = re.0;
        truncated = re.1;
    }

    let token_estimate = estimate_tokens(&joined);

    AiContextFile {
        file_path: file_path_str.to_string(),
        token_estimate,
        redacted,
        truncated,
        content: joined,
    }
}

pub(super) fn build_diff_focused_context(
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

pub(super) fn build_snapshot_context(
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

pub(super) fn truncate_context(
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

pub(super) fn build_prompt_data(
    items: &[BatchItem],
    root_path: &std::path::Path,
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
        let context_file = prepare_ai_context_file(item, root_path);
        estimated_tokens += context_file.token_estimate;
        hash_by_path.insert(context_file.file_path.clone(), item.hash.clone());
        prompt_data.push((context_file.file_path.clone(), context_file.content.clone()));
        context_files.push(context_file);
    }

    (prompt_data, estimated_tokens, hash_by_path, context_files)
}

pub(super) fn emit_ai_context(
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

pub(super) fn append_ai_request_history(
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

/// Extract import paths from source code (supports TS/JS, Rust, Python, Go)
pub fn extract_local_imports(content: &str, file_path: &str) -> Vec<String> {
    let mut imports = Vec::new();
    let ext = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    for line in content.lines() {
        let trimmed = line.trim();
        match ext {
            "ts" | "tsx" | "js" | "jsx" | "mts" | "mjs" => {
                if trimmed.starts_with("import ") || trimmed.starts_with("import{") {
                    if let Some(from_idx) = trimmed.find(" from ") {
                        let path_part = &trimmed[from_idx + 6..];
                        let path = path_part
                            .trim()
                            .trim_matches(|c| c == '\'' || c == '"' || c == ';');
                        if path.starts_with('.') || path.starts_with('/') {
                            imports.push(path.to_string());
                        }
                    }
                }
                if trimmed.contains("require(") {
                    if let Some(start) = trimmed.find("require(") {
                        let rest = &trimmed[start + 8..];
                        if let Some(end) = rest.find(')') {
                            let path = rest[..end].trim().trim_matches(|c| c == '\'' || c == '"');
                            if path.starts_with('.') || path.starts_with('/') {
                                imports.push(path.to_string());
                            }
                        }
                    }
                }
            }
            "rs" => {
                if trimmed.starts_with("use crate::") {
                    let module = trimmed
                        .trim_start_matches("use crate::")
                        .split("::")
                        .next()
                        .unwrap_or("")
                        .trim_end_matches(';');
                    if !module.is_empty() {
                        imports.push(format!("crate::{}", module));
                    }
                }
                if trimmed.starts_with("mod ") && trimmed.ends_with(';') {
                    let module = trimmed
                        .trim_start_matches("mod ")
                        .trim_end_matches(';')
                        .trim();
                    if !module.is_empty() {
                        imports.push(format!("mod::{}", module));
                    }
                }
            }
            "py" => {
                if trimmed.starts_with("from .") || trimmed.starts_with("from ..") {
                    let parts: Vec<&str> = trimmed.splitn(3, ' ').collect();
                    if parts.len() >= 2 {
                        imports.push(parts[1].to_string());
                    }
                }
            }
            "go" => {
                // Match `import "pkg"` or `"pkg"` inside an import block
                if trimmed.starts_with("import \"") {
                    let path = trimmed
                        .trim_start_matches("import ")
                        .trim()
                        .trim_matches('"');
                    if !path.is_empty() && !path.contains("github.com") {
                        imports.push(path.to_string());
                    }
                } else if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
                    let path = trimmed.trim_matches('"');
                    if !path.is_empty() && !path.contains("github.com") {
                        imports.push(path.to_string());
                    }
                }
            }
            _ => {}
        }
    }

    imports.dedup();
    imports
}

/// Build a brief context snippet from imported local files.
/// Returns a string like `"\n--- IMPORTED LOCAL DEPENDENCIES ---\n[from ./types]:\n..."`.
pub fn build_import_context(
    imports: &[String],
    file_path: &str,
    root_path: &std::path::Path,
    max_chars: usize,
) -> String {
    if imports.is_empty() {
        return String::new();
    }

    let file_dir = std::path::Path::new(file_path)
        .parent()
        .unwrap_or(std::path::Path::new(""));

    let mut context = String::from("\n--- IMPORTED LOCAL DEPENDENCIES ---\n");
    let mut chars_used = context.len();

    for import_path in imports.iter().take(5) {
        if import_path.starts_with("crate::") || import_path.starts_with("mod::") {
            continue;
        }

        let resolved = file_dir.join(import_path);

        let candidates = [
            resolved.with_extension("ts"),
            resolved.with_extension("tsx"),
            resolved.with_extension("js"),
            resolved.with_extension("jsx"),
            resolved.join("index.ts"),
            resolved.join("index.tsx"),
        ];

        for candidate in &candidates {
            let full_path = root_path.join(candidate);
            if full_path.exists() {
                if let Ok(file_content) = std::fs::read_to_string(&full_path) {
                    let signatures = extract_type_signatures(&file_content, 500);
                    if !signatures.is_empty() {
                        let entry = format!("[from {}]:\n{}\n", import_path, signatures);
                        if chars_used + entry.len() > max_chars {
                            break;
                        }
                        context.push_str(&entry);
                        chars_used += entry.len();
                    }
                }
                break;
            }
        }

        if chars_used > max_chars {
            break;
        }
    }

    if context.len() > 40 {
        context
    } else {
        String::new()
    }
}

/// Extract type signatures from a source file (interfaces, types, function signatures)
fn extract_type_signatures(content: &str, max_chars: usize) -> String {
    let mut signatures = String::new();
    let mut in_interface = false;
    let mut brace_depth: i32 = 0;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("export interface ") || trimmed.starts_with("export type ") {
            in_interface = true;
            brace_depth = 0;
        }

        if in_interface {
            signatures.push_str(trimmed);
            signatures.push('\n');
            brace_depth += trimmed.matches('{').count() as i32;
            brace_depth -= trimmed.matches('}').count() as i32;
            if brace_depth <= 0 && signatures.len() > 10 {
                in_interface = false;
            }
        }

        if (trimmed.starts_with("export function ")
            || trimmed.starts_with("export const ")
            || trimmed.starts_with("export async function "))
            && !in_interface
        {
            let sig_line = if let Some(brace_pos) = trimmed.find('{') {
                &trimmed[..brace_pos]
            } else {
                trimmed
            };
            signatures.push_str(sig_line.trim());
            signatures.push_str(" { ... }\n");
        }

        if signatures.len() > max_chars {
            signatures.truncate(max_chars);
            signatures.push_str("\n...(truncated)");
            break;
        }
    }

    signatures
}
