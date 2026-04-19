use anyhow::{anyhow, Result};
use guardian_scan_policy::{classify_path, load_policy_for_root, GuardianPolicy, ScanProfile};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

// ── JSON-RPC 2.0 types ──────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Serialize)]
struct JsonRpcError {
    code: i64,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct SnapshotCritique {
    file_path: String,
    severity: String,
    message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    suggestion: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    chat_message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    suggested_diff: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    finding_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    why: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    line_start: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    line_end: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    evidence_snippet: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    confidence: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct CritiquesSnapshotV1 {
    protocol_version: u64,
    #[serde(default)]
    critiques: Vec<SnapshotCritique>,
}

#[derive(Debug)]
struct SnapshotLoadError {
    kind: &'static str,
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SeverityFilter {
    All,
    Low,
    Medium,
    High,
    Critical,
}

impl JsonRpcResponse {
    fn success(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: Value, code: i64, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message: message.into(),
                data: None,
            }),
        }
    }
}

// ── MCP protocol constants ───────────────────────────────────────────

const SERVER_NAME: &str = "guardian-mcp";
const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");
const PROTOCOL_VERSION: &str = "2024-11-05";

// JSON-RPC error codes
const METHOD_NOT_FOUND: i64 = -32601;
const INVALID_REQUEST: i64 = -32600;
const INTERNAL_ERROR: i64 = -32603;

// ── Tool definitions ─────────────────────────────────────────────────

fn tool_definitions() -> Value {
    json!([
        {
            "name": "scan_file",
            "description": "Classify a file using Guardian's scan policy. Returns file metadata, language detection, and whether it is a scan candidate. This is a local policy check — no AI analysis is performed.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file to scan"
                    },
                    "profile": {
                        "type": "string",
                        "enum": ["source", "extended", "full"],
                        "description": "Scan profile to use (default: source)"
                    }
                },
                "required": ["path"]
            }
        },
        {
            "name": "list_critiques",
            "description": "Explain how to retrieve critiques from a Guardian scan. The MCP server is stateless and does not persist scan results; use the Guardian CLI instead.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "critical"],
                        "description": "Filter critiques by minimum severity"
                    },
                    "workspace_path": {
                        "type": "string",
                        "description": "Workspace root path to scan"
                    }
                }
            }
        },
        {
            "name": "get_scan_policy",
            "description": "Load and return the Guardian scan policy for a workspace. Returns packs, gate settings, and schema version.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workspace_path": {
                        "type": "string",
                        "description": "Workspace root path (defaults to current directory)"
                    }
                }
            }
        },
        {
            "name": "apply_fix",
            "description": "Explain how to apply a fix for a critique. The MCP server cannot safely apply fixes without user confirmation; use the Guardian desktop app or CLI.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "critique_id": {
                        "type": "string",
                        "description": "ID of the critique to fix"
                    },
                    "dry_run": {
                        "type": "boolean",
                        "description": "If true, show the fix without applying it"
                    }
                },
                "required": ["critique_id"]
            }
        },
        {
            "name": "classify_paths",
            "description": "Walk a directory and classify all files using Guardian's scan policy. Returns a summary with candidate counts, skip reasons, and per-file decisions (limited to 100 files).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "workspace_path": {
                        "type": "string",
                        "description": "Directory to walk and classify"
                    },
                    "profile": {
                        "type": "string",
                        "enum": ["source", "extended", "full"],
                        "description": "Scan profile to use (default: source)"
                    }
                },
                "required": ["workspace_path"]
            }
        }
    ])
}

// ── Request handling ─────────────────────────────────────────────────

fn handle_initialize(_params: &Value) -> Value {
    json!({
        "protocolVersion": PROTOCOL_VERSION,
        "capabilities": {
            "tools": {}
        },
        "serverInfo": {
            "name": SERVER_NAME,
            "version": SERVER_VERSION
        }
    })
}

fn handle_tools_list() -> Value {
    json!({ "tools": tool_definitions() })
}

#[allow(dead_code)]
fn mcp_text_response(text: &str) -> Value {
    json!({
        "content": [{ "type": "text", "text": text }]
    })
}

fn mcp_json_response(data: &Value) -> Value {
    json!({
        "content": [{ "type": "text", "text": serde_json::to_string_pretty(data).unwrap_or_default() }]
    })
}

fn canonicalize_if_exists(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

fn workspace_root_from_arguments(arguments: &Value, file_path: Option<&Path>) -> PathBuf {
    if let Some(workspace) = arguments
        .get("workspace_path")
        .and_then(|value| value.as_str())
    {
        return canonicalize_if_exists(Path::new(workspace));
    }

    if let Some(path) = file_path {
        let mut current = if path.is_dir() {
            Some(path)
        } else {
            path.parent()
        };

        while let Some(candidate) = current {
            if candidate.join(".guardian").join("critiques.json").exists()
                || candidate.join("guardian.policy.yaml").exists()
                || candidate.join(".git").exists()
            {
                return canonicalize_if_exists(candidate);
            }
            current = candidate.parent();
        }
    }

    canonicalize_if_exists(&std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn resolve_file_path(root: &Path, raw_path: &str) -> PathBuf {
    let path = Path::new(raw_path);
    let resolved = if path.is_absolute() {
        path.to_path_buf()
    } else {
        root.join(path)
    };
    canonicalize_if_exists(&resolved)
}

fn absolutize_snapshot_path(root_path: &Path, file_path: &str) -> String {
    let trimmed = file_path.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        canonicalize_if_exists(path).to_string_lossy().to_string()
    } else {
        canonicalize_if_exists(&root_path.join(trimmed.trim_start_matches("./")))
            .to_string_lossy()
            .to_string()
    }
}

fn normalize_snapshot_severity(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "critical" | "high" => "Critical".to_string(),
        "warning" | "medium" => "Warning".to_string(),
        "info" | "low" => "Info".to_string(),
        "lgtm" => "LGTM".to_string(),
        other => other.to_string(),
    }
}

fn parse_severity_filter(arguments: &Value) -> Result<SeverityFilter> {
    let Some(raw_filter) = arguments.get("severity").and_then(|value| value.as_str()) else {
        return Ok(SeverityFilter::All);
    };

    match raw_filter.trim().to_lowercase().as_str() {
        "all" => Ok(SeverityFilter::All),
        "low" | "info" => Ok(SeverityFilter::Low),
        "medium" | "warning" => Ok(SeverityFilter::Medium),
        "high" => Ok(SeverityFilter::High),
        "critical" => Ok(SeverityFilter::Critical),
        other => Err(anyhow!(
            "unsupported severity filter '{}'. Use all|low|medium|high|critical.",
            other
        )),
    }
}

fn critique_matches_filter(critique: &SnapshotCritique, filter: SeverityFilter) -> bool {
    let severity = normalize_snapshot_severity(&critique.severity);
    if severity == "LGTM" {
        return false;
    }

    match filter {
        SeverityFilter::All | SeverityFilter::Low => {
            matches!(severity.as_str(), "Info" | "Warning" | "Critical")
        }
        SeverityFilter::Medium => matches!(severity.as_str(), "Warning" | "Critical"),
        SeverityFilter::High | SeverityFilter::Critical => severity == "Critical",
    }
}

fn load_snapshot_for_root(
    root: &Path,
) -> std::result::Result<(PathBuf, Vec<SnapshotCritique>), SnapshotLoadError> {
    let snapshot_path = root.join(".guardian").join("critiques.json");
    let raw = std::fs::read_to_string(&snapshot_path).map_err(|err| {
        let kind = if err.kind() == std::io::ErrorKind::NotFound {
            "snapshot_missing"
        } else {
            "snapshot_unreadable"
        };
        SnapshotLoadError {
            kind,
            message: format!(
                "Could not read critique snapshot at {}: {}",
                snapshot_path.to_string_lossy(),
                err
            ),
        }
    })?;

    let mut parsed: CritiquesSnapshotV1 =
        serde_json::from_str(&raw).map_err(|err| SnapshotLoadError {
            kind: "snapshot_invalid",
            message: format!(
                "Critique snapshot is not valid JSON at {}: {}",
                snapshot_path.to_string_lossy(),
                err
            ),
        })?;

    if parsed.protocol_version != 1 {
        return Err(SnapshotLoadError {
            kind: "snapshot_unsupported",
            message: format!(
                "Critique snapshot protocol_version={} is not supported. Expected 1.",
                parsed.protocol_version
            ),
        });
    }

    for critique in &mut parsed.critiques {
        critique.file_path = absolutize_snapshot_path(root, &critique.file_path);
        critique.severity = normalize_snapshot_severity(&critique.severity);
    }

    parsed
        .critiques
        .retain(|critique| !critique.file_path.trim().is_empty() && critique.severity != "LGTM");

    Ok((snapshot_path, parsed.critiques))
}

fn file_stats(path: &Path) -> (u64, usize) {
    match std::fs::read_to_string(path) {
        Ok(content) => (content.len() as u64, content.lines().count()),
        Err(_) => match std::fs::metadata(path) {
            Ok(meta) => (meta.len(), 0),
            Err(_) => (0, 0),
        },
    }
}

fn parse_profile(arguments: &Value) -> ScanProfile {
    arguments
        .get("profile")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<ScanProfile>().ok())
        .unwrap_or_default()
}

fn language_from_extension(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "py" => "python",
        "go" => "go",
        "java" => "java",
        "kt" => "kotlin",
        "swift" => "swift",
        "cs" => "csharp",
        "rb" => "ruby",
        "php" => "php",
        "c" | "h" => "c",
        "cc" | "cpp" | "hpp" => "cpp",
        "sql" => "sql",
        "vue" => "vue",
        "svelte" => "svelte",
        "sh" => "shell",
        "yml" | "yaml" => "yaml",
        "toml" => "toml",
        "json" => "json",
        "ini" | "cfg" | "conf" => "config",
        "md" => "markdown",
        "html" | "htm" => "html",
        "css" | "scss" | "less" => "css",
        _ => "unknown",
    }
}

fn handle_scan_file(arguments: &Value) -> Result<Value> {
    let raw_file_path = arguments
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("missing required argument: path"))?;

    let profile = parse_profile(arguments);
    let workspace_root = workspace_root_from_arguments(arguments, Some(Path::new(raw_file_path)));
    let snapshot_path = workspace_root.join(".guardian").join("critiques.json");
    let path = resolve_file_path(&workspace_root, raw_file_path);
    let path_string = path.to_string_lossy().to_string();

    if !path.exists() {
        return Ok(mcp_json_response(&json!({
            "status": "error",
            "kind": "file_not_found",
            "message": format!("File does not exist: {}", path_string),
            "workspace_path": workspace_root.to_string_lossy(),
            "snapshot_path": snapshot_path.to_string_lossy(),
            "critiques": [],
            "critique_count": 0,
            "file": {
                "path": path_string,
                "scan_profile": profile.as_str(),
            }
        })));
    }

    if !path.is_file() {
        return Ok(mcp_json_response(&json!({
            "status": "error",
            "kind": "not_a_file",
            "message": format!("Path is not a file: {}", path_string),
            "workspace_path": workspace_root.to_string_lossy(),
            "snapshot_path": snapshot_path.to_string_lossy(),
            "critiques": [],
            "critique_count": 0,
            "file": {
                "path": path_string,
                "scan_profile": profile.as_str(),
            }
        })));
    }

    let classify_target = path.strip_prefix(&workspace_root).unwrap_or(path.as_path());
    let decision = classify_path(classify_target, false, profile);
    let language = language_from_extension(&path);
    let (file_size, line_count) = file_stats(&path);
    let skip_reason = decision.reason.map(|reason| reason.as_str().to_string());
    let relative_path = path
        .strip_prefix(&workspace_root)
        .ok()
        .map(|value| value.to_string_lossy().to_string());

    let mut file_payload = json!({
        "path": path_string,
        "relative_path": relative_path,
        "file_size": file_size,
        "line_count": line_count,
        "language": language,
        "scan_profile": profile.as_str(),
        "is_candidate": decision.include,
    });

    if let Some(reason) = skip_reason.as_deref() {
        file_payload["skip_reason"] = json!(reason);
    }

    match load_snapshot_for_root(&workspace_root) {
        Ok((loaded_snapshot_path, critiques)) => {
            let critiques_for_file: Vec<SnapshotCritique> = critiques
                .into_iter()
                .filter(|critique| critique.file_path == path_string)
                .collect();

            let critique_count = critiques_for_file.len();
            let (status, kind, message) = if decision.include {
                if critique_count == 0 {
                    (
                        "ok",
                        "scan_result",
                        format!("No active critiques found for {}.", path_string),
                    )
                } else {
                    (
                        "ok",
                        "scan_result",
                        format!(
                            "Loaded {} active critique(s) for {}.",
                            critique_count, path_string
                        ),
                    )
                }
            } else {
                let reason = skip_reason.as_deref().unwrap_or("unknown_skip_reason");
                (
                    "warning",
                    "policy_skip",
                    format!(
                        "File is outside the current scan profile ({}) and may not receive fresh critiques until policy/profile changes.",
                        reason
                    ),
                )
            };

            Ok(mcp_json_response(&json!({
                "status": status,
                "kind": kind,
                "message": message,
                "workspace_path": workspace_root.to_string_lossy(),
                "snapshot_path": loaded_snapshot_path.to_string_lossy(),
                "critique_count": critique_count,
                "critiques": critiques_for_file,
                "file": file_payload,
            })))
        }
        Err(snapshot_error) => {
            let status = if snapshot_error.kind == "snapshot_missing" {
                "warning"
            } else {
                "error"
            };
            Ok(mcp_json_response(&json!({
                "status": status,
                "kind": snapshot_error.kind,
                "message": snapshot_error.message,
                "workspace_path": workspace_root.to_string_lossy(),
                "snapshot_path": snapshot_path.to_string_lossy(),
                "critique_count": 0,
                "critiques": [],
                "file": file_payload,
            })))
        }
    }
}

fn handle_list_critiques(arguments: &Value) -> Result<Value> {
    let severity_filter = parse_severity_filter(arguments)?;
    let workspace_root = workspace_root_from_arguments(arguments, None);
    let snapshot_path = workspace_root.join(".guardian").join("critiques.json");

    match load_snapshot_for_root(&workspace_root) {
        Ok((loaded_snapshot_path, critiques)) => {
            let filtered: Vec<SnapshotCritique> = critiques
                .into_iter()
                .filter(|critique| critique_matches_filter(critique, severity_filter))
                .collect();

            let critique_count = filtered.len();
            let message = if critique_count == 0 {
                "Guardian critique snapshot loaded successfully, but no critiques matched the current filter."
                    .to_string()
            } else {
                format!(
                    "Loaded {} active critique(s) from the workspace snapshot.",
                    critique_count
                )
            };

            Ok(mcp_json_response(&json!({
                "status": "ok",
                "kind": "critiques_result",
                "message": message,
                "workspace_path": workspace_root.to_string_lossy(),
                "snapshot_path": loaded_snapshot_path.to_string_lossy(),
                "severity_filter": arguments
                    .get("severity")
                    .and_then(|value| value.as_str())
                    .unwrap_or("all"),
                "critique_count": critique_count,
                "critiques": filtered,
            })))
        }
        Err(snapshot_error) => {
            let status = if snapshot_error.kind == "snapshot_missing" {
                "warning"
            } else {
                "error"
            };
            Ok(mcp_json_response(&json!({
                "status": status,
                "kind": snapshot_error.kind,
                "message": snapshot_error.message,
                "workspace_path": workspace_root.to_string_lossy(),
                "snapshot_path": snapshot_path.to_string_lossy(),
                "severity_filter": arguments
                    .get("severity")
                    .and_then(|value| value.as_str())
                    .unwrap_or("all"),
                "critique_count": 0,
                "critiques": [],
            })))
        }
    }
}

fn handle_get_scan_policy(arguments: &Value) -> Value {
    let workspace = arguments
        .get("workspace_path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let root = Path::new(workspace);

    match load_policy_for_root(root, None) {
        Ok((policy, policy_path)) => {
            let policy_json: Value =
                serde_json::to_value(&policy).unwrap_or_else(|_| policy_to_json(&policy));

            mcp_json_response(&json!({
                "policy_path": policy_path.to_string_lossy(),
                "policy": policy_json,
            }))
        }
        Err(e) => mcp_json_response(&json!({
            "error": "policy_load_failed",
            "message": e,
            "fallback": "Using default policy",
            "policy": policy_to_json(&GuardianPolicy::default()),
        })),
    }
}

fn policy_to_json(policy: &GuardianPolicy) -> Value {
    json!({
        "schema_version": policy.schema_version,
        "packs": policy.packs,
        "gate": {
            "pass_max_warnings": policy.gate.pass_max_warnings,
            "block_on_critical": policy.gate.block_on_critical,
            "require_human_approval_on_ai_heavy": policy.gate.require_human_approval_on_ai_heavy,
            "require_override_reason": policy.gate.require_override_reason,
        }
    })
}

fn handle_apply_fix(arguments: &Value) -> Value {
    let critique_id = arguments
        .get("critique_id")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let dry_run = arguments
        .get("dry_run")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    mcp_json_response(&json!({
        "status": "not_supported_via_mcp",
        "critique_id": critique_id,
        "dry_run": dry_run,
        "message": "The Guardian MCP server cannot apply fixes directly. Code modifications require explicit user confirmation for safety.",
        "how_to_apply": [
            format!("Guardian desktop app: open the critique '{}' and click 'Apply Fix'", critique_id),
            format!("CLI: `guardian-cli fix --critique {} {}`",
                critique_id, if dry_run { "--dry-run" } else { "" }).trim().to_string(),
        ]
    }))
}

fn handle_classify_paths(arguments: &Value) -> Result<Value> {
    let workspace = arguments
        .get("workspace_path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("missing required argument: workspace_path"))?;

    let profile = parse_profile(arguments);
    let root = Path::new(workspace);

    if !root.exists() || !root.is_dir() {
        return Ok(mcp_json_response(&json!({
            "error": "invalid_directory",
            "workspace_path": workspace,
            "message": format!("Path is not a valid directory: {}", workspace)
        })));
    }

    const MAX_FILES: usize = 100;
    let mut summary = WalkSummary::default();

    walk_dir(root, root, profile, MAX_FILES, &mut summary);

    Ok(mcp_json_response(&json!({
        "workspace_path": workspace,
        "scan_profile": profile.as_str(),
        "total_files": summary.total,
        "candidates": summary.candidates,
        "skipped": summary.skipped,
        "truncated": summary.truncated,
        "skipped_by_reason": summary.skip_reasons,
        "files": summary.files,
    })))
}

#[derive(Default)]
struct WalkSummary {
    candidates: usize,
    files: Vec<Value>,
    skip_reasons: HashMap<&'static str, usize>,
    skipped: usize,
    total: usize,
    truncated: bool,
}

impl WalkSummary {
    fn record_candidate(&mut self, relative: &Path) {
        self.candidates += 1;
        self.files.push(json!({
            "path": relative.to_string_lossy(),
            "is_candidate": true,
        }));
    }

    fn record_skipped(&mut self, relative: &Path, reason: &'static str) {
        self.skipped += 1;
        *self.skip_reasons.entry(reason).or_insert(0) += 1;
        self.files.push(json!({
            "path": relative.to_string_lossy(),
            "is_candidate": false,
            "skip_reason": reason,
        }));
    }
}

fn walk_dir(
    dir: &Path,
    root: &Path,
    profile: ScanProfile,
    max_files: usize,
    summary: &mut WalkSummary,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if summary.total >= max_files {
            summary.truncated = true;
            return;
        }

        let path = entry.path();

        if path.is_dir() {
            // Skip common ignored directories early
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with('.')
                    || name == "node_modules"
                    || name == "target"
                    || name == "dist"
                    || name == "build"
                {
                    continue;
                }
            }
            walk_dir(&path, root, profile, max_files, summary);
            continue;
        }

        if !path.is_file() {
            continue;
        }

        let relative = path.strip_prefix(root).unwrap_or(&path);
        let decision = classify_path(relative, false, profile);

        summary.total += 1;

        if decision.include {
            summary.record_candidate(relative);
        } else {
            let reason = decision
                .reason
                .map(|skip_reason| skip_reason.as_str())
                .unwrap_or("unknown");
            summary.record_skipped(relative, reason);
        }
    }
}

fn handle_tool_call(params: &Value) -> Result<Value> {
    let tool_name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("missing tool name"))?;

    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    match tool_name {
        "scan_file" => handle_scan_file(&arguments),
        "list_critiques" => handle_list_critiques(&arguments),
        "get_scan_policy" => Ok(handle_get_scan_policy(&arguments)),
        "apply_fix" => Ok(handle_apply_fix(&arguments)),
        "classify_paths" => handle_classify_paths(&arguments),
        other => Err(anyhow!("unknown tool: {}", other)),
    }
}

#[allow(clippy::items_after_test_module)]
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_workspace(name: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("guardian-mcp-{name}-{suffix}"));
        fs::create_dir_all(&dir).expect("create temp workspace");
        dir
    }

    fn cleanup_workspace(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }

    fn parse_payload(response: Value) -> Value {
        let text = response["content"][0]["text"]
            .as_str()
            .expect("mcp text payload");
        serde_json::from_str(text).expect("json payload")
    }

    fn write_snapshot(root: &Path, raw: &str) {
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("create guardian dir");
        fs::write(guardian_dir.join("critiques.json"), raw).expect("write snapshot");
    }

    #[test]
    fn list_critiques_returns_filtered_snapshot_rows() {
        let root = temp_workspace("list-critiques-ok");
        write_snapshot(
            &root,
            r#"{
                "protocol_version": 1,
                "critiques": [
                    {
                        "finding_id": "f-1",
                        "file_path": "src/main.ts",
                        "severity": "medium",
                        "message": "Warn row",
                        "line_start": 3,
                        "line_end": 5
                    },
                    {
                        "finding_id": "f-2",
                        "file_path": "src/main.ts",
                        "severity": "high",
                        "message": "Critical row",
                        "line_start": 9,
                        "line_end": 10
                    }
                ]
            }"#,
        );

        let response = handle_list_critiques(&json!({
            "workspace_path": root.to_string_lossy(),
            "severity": "high"
        }))
        .expect("tool response");
        let payload = parse_payload(response);

        assert_eq!(payload["status"], "ok");
        assert_eq!(payload["critique_count"], 1);
        assert_eq!(payload["critiques"][0]["finding_id"], "f-2");
        assert_eq!(payload["critiques"][0]["severity"], "Critical");

        let all_response = handle_list_critiques(&json!({
            "workspace_path": root.to_string_lossy(),
            "severity": "all"
        }))
        .expect("tool response");
        let all_payload = parse_payload(all_response);

        assert_eq!(all_payload["status"], "ok");
        assert_eq!(all_payload["critique_count"], 2);
        assert_eq!(all_payload["critiques"][0]["severity"], "Warning");
        assert_eq!(all_payload["critiques"][1]["severity"], "Critical");

        cleanup_workspace(&root);
    }

    #[test]
    fn list_critiques_distinguishes_missing_snapshot() {
        let root = temp_workspace("list-critiques-missing");
        let response = handle_list_critiques(&json!({
            "workspace_path": root.to_string_lossy()
        }))
        .expect("tool response");
        let payload = parse_payload(response);

        assert_eq!(payload["status"], "warning");
        assert_eq!(payload["kind"], "snapshot_missing");
        assert_eq!(payload["critique_count"], 0);

        cleanup_workspace(&root);
    }

    #[test]
    fn scan_file_returns_matching_critiques_for_requested_file() {
        let root = temp_workspace("scan-file-ok");
        let src_dir = root.join("src");
        fs::create_dir_all(&src_dir).expect("create src dir");
        let file_path = src_dir.join("main.ts");
        fs::write(&file_path, "const value = 1;\n").expect("write source file");
        write_snapshot(
            &root,
            r#"{
                "protocol_version": 1,
                "critiques": [
                    {
                        "finding_id": "f-1",
                        "file_path": "src/main.ts",
                        "severity": "Warning",
                        "message": "Warn row",
                        "line_start": 2,
                        "line_end": 4
                    },
                    {
                        "finding_id": "f-2",
                        "file_path": "src/other.ts",
                        "severity": "Critical",
                        "message": "Other row"
                    }
                ]
            }"#,
        );

        let response = handle_scan_file(&json!({
            "workspace_path": root.to_string_lossy(),
            "path": file_path.to_string_lossy(),
            "profile": "source"
        }))
        .expect("tool response");
        let payload = parse_payload(response);

        assert_eq!(payload["status"], "ok");
        assert_eq!(payload["kind"], "scan_result");
        assert_eq!(payload["critique_count"], 1);
        assert_eq!(payload["critiques"][0]["finding_id"], "f-1");
        assert_eq!(
            payload["file"]["path"],
            canonicalize_if_exists(&file_path)
                .to_string_lossy()
                .to_string()
        );

        cleanup_workspace(&root);
    }

    #[test]
    fn scan_file_returns_error_for_invalid_snapshot_json() {
        let root = temp_workspace("scan-file-invalid-snapshot");
        let src_dir = root.join("src");
        fs::create_dir_all(&src_dir).expect("create src dir");
        let file_path = src_dir.join("main.ts");
        fs::write(&file_path, "const value = 1;\n").expect("write source file");
        write_snapshot(&root, "not-json");

        let response = handle_scan_file(&json!({
            "workspace_path": root.to_string_lossy(),
            "path": file_path.to_string_lossy(),
            "profile": "source"
        }))
        .expect("tool response");
        let payload = parse_payload(response);

        assert_eq!(payload["status"], "error");
        assert_eq!(payload["kind"], "snapshot_invalid");
        assert_eq!(payload["critique_count"], 0);

        cleanup_workspace(&root);
    }

    // ── Pure function tests ─────────────────────────────────────

    #[test]
    fn normalize_snapshot_severity_maps_correctly() {
        assert_eq!(normalize_snapshot_severity("critical"), "Critical");
        assert_eq!(normalize_snapshot_severity("high"), "Critical");
        assert_eq!(normalize_snapshot_severity("warning"), "Warning");
        assert_eq!(normalize_snapshot_severity("medium"), "Warning");
        assert_eq!(normalize_snapshot_severity("info"), "Info");
        assert_eq!(normalize_snapshot_severity("low"), "Info");
        assert_eq!(normalize_snapshot_severity("lgtm"), "LGTM");
        assert_eq!(normalize_snapshot_severity(" Critical "), "Critical");
        assert_eq!(normalize_snapshot_severity("unknown"), "unknown");
    }

    #[test]
    fn parse_severity_filter_handles_all_levels() {
        assert_eq!(parse_severity_filter(&json!({})).unwrap(), SeverityFilter::All);
        assert_eq!(parse_severity_filter(&json!({"severity": "all"})).unwrap(), SeverityFilter::All);
        assert_eq!(parse_severity_filter(&json!({"severity": "low"})).unwrap(), SeverityFilter::Low);
        assert_eq!(parse_severity_filter(&json!({"severity": "info"})).unwrap(), SeverityFilter::Low);
        assert_eq!(parse_severity_filter(&json!({"severity": "medium"})).unwrap(), SeverityFilter::Medium);
        assert_eq!(parse_severity_filter(&json!({"severity": "warning"})).unwrap(), SeverityFilter::Medium);
        assert_eq!(parse_severity_filter(&json!({"severity": "high"})).unwrap(), SeverityFilter::High);
        assert_eq!(parse_severity_filter(&json!({"severity": "critical"})).unwrap(), SeverityFilter::Critical);
        assert!(parse_severity_filter(&json!({"severity": "invalid"})).is_err());
    }

    #[test]
    fn critique_matches_filter_logic() {
        let make = |severity: &str| SnapshotCritique {
            file_path: "f.rs".into(),
            severity: severity.into(),
            message: "msg".into(),
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

        // LGTM never matches
        assert!(!critique_matches_filter(&make("lgtm"), SeverityFilter::All));

        // All/Low → Info, Warning, Critical
        assert!(critique_matches_filter(&make("info"), SeverityFilter::All));
        assert!(critique_matches_filter(&make("warning"), SeverityFilter::All));
        assert!(critique_matches_filter(&make("critical"), SeverityFilter::All));

        // Medium → Warning, Critical only
        assert!(!critique_matches_filter(&make("info"), SeverityFilter::Medium));
        assert!(critique_matches_filter(&make("warning"), SeverityFilter::Medium));
        assert!(critique_matches_filter(&make("critical"), SeverityFilter::Medium));

        // High/Critical → Critical only
        assert!(!critique_matches_filter(&make("warning"), SeverityFilter::High));
        assert!(critique_matches_filter(&make("critical"), SeverityFilter::High));
    }

    #[test]
    fn language_from_extension_maps_common_types() {
        assert_eq!(language_from_extension(Path::new("main.rs")), "rust");
        assert_eq!(language_from_extension(Path::new("app.tsx")), "typescript");
        assert_eq!(language_from_extension(Path::new("index.js")), "javascript");
        assert_eq!(language_from_extension(Path::new("lib.py")), "python");
        assert_eq!(language_from_extension(Path::new("Cargo.toml")), "toml");
        assert_eq!(language_from_extension(Path::new("README.md")), "markdown");
        assert_eq!(language_from_extension(Path::new("Dockerfile")), "unknown");
    }

    #[test]
    fn parse_profile_defaults_to_standard() {
        assert_eq!(parse_profile(&json!({})), ScanProfile::default());
        assert_eq!(parse_profile(&json!({"profile": "source"})), ScanProfile::Source);
    }

    #[test]
    fn dispatch_routes_methods_correctly() {
        let init = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(1)),
            method: "initialize".into(),
            params: json!({}),
        };
        assert!(dispatch(&init).unwrap().is_some());

        let notif = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: None,
            method: "initialized".into(),
            params: json!({}),
        };
        assert!(dispatch(&notif).unwrap().is_none());

        let ping = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(2)),
            method: "ping".into(),
            params: json!({}),
        };
        assert_eq!(dispatch(&ping).unwrap().unwrap(), json!({}));

        let unknown = JsonRpcRequest {
            jsonrpc: "2.0".into(),
            id: Some(json!(3)),
            method: "nonexistent".into(),
            params: json!({}),
        };
        assert!(dispatch(&unknown).is_err());
    }

    #[test]
    fn tool_definitions_lists_expected_tools() {
        let defs = tool_definitions();
        let names: Vec<&str> = defs
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"scan_file"));
        assert!(names.contains(&"list_critiques"));
        assert!(names.contains(&"get_scan_policy"));
    }

    #[test]
    fn absolutize_snapshot_path_handles_empty() {
        assert_eq!(absolutize_snapshot_path(Path::new("/root"), ""), "");
        assert_eq!(absolutize_snapshot_path(Path::new("/root"), "  "), "");
    }

    #[test]
    fn mcp_text_and_json_response_shape() {
        let text_resp = mcp_text_response("hello");
        assert_eq!(text_resp["content"][0]["type"], "text");
        assert_eq!(text_resp["content"][0]["text"], "hello");

        let json_resp = mcp_json_response(&json!({"key": "val"}));
        let parsed: Value = serde_json::from_str(
            json_resp["content"][0]["text"].as_str().unwrap()
        ).unwrap();
        assert_eq!(parsed["key"], "val");
    }
}

fn dispatch(req: &JsonRpcRequest) -> Result<Option<Value>> {
    match req.method.as_str() {
        "initialize" => Ok(Some(handle_initialize(&req.params))),
        "initialized" => Ok(None), // notification, no response
        "tools/list" => Ok(Some(handle_tools_list())),
        "tools/call" => handle_tool_call(&req.params).map(Some),
        "ping" => Ok(Some(json!({}))),
        _ => Err(anyhow!("method not found: {}", req.method)),
    }
}

// ── Main loop ────────────────────────────────────────────────────────

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut line = String::new();

    loop {
        line.clear();
        let bytes_read = reader.read_line(&mut line).await?;
        if bytes_read == 0 {
            break; // EOF
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let req: JsonRpcRequest = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(e) => {
                let resp = JsonRpcResponse::error(Value::Null, INVALID_REQUEST, e.to_string());
                let mut out = serde_json::to_string(&resp)?;
                out.push('\n');
                stdout.write_all(out.as_bytes()).await?;
                stdout.flush().await?;
                continue;
            }
        };

        if req.jsonrpc != "2.0" {
            if let Some(id) = &req.id {
                let resp =
                    JsonRpcResponse::error(id.clone(), INVALID_REQUEST, "expected jsonrpc 2.0");
                let mut out = serde_json::to_string(&resp)?;
                out.push('\n');
                stdout.write_all(out.as_bytes()).await?;
                stdout.flush().await?;
            }
            continue;
        }

        match dispatch(&req) {
            Ok(Some(result)) => {
                let id = req.id.unwrap_or(Value::Null);
                let resp = JsonRpcResponse::success(id, result);
                let mut out = serde_json::to_string(&resp)?;
                out.push('\n');
                stdout.write_all(out.as_bytes()).await?;
                stdout.flush().await?;
            }
            Ok(None) => {
                // notification — no response needed
            }
            Err(e) => {
                let id = req.id.unwrap_or(Value::Null);
                let code = if e.to_string().starts_with("method not found") {
                    METHOD_NOT_FOUND
                } else {
                    INTERNAL_ERROR
                };
                let resp = JsonRpcResponse::error(id, code, e.to_string());
                let mut out = serde_json::to_string(&resp)?;
                out.push('\n');
                stdout.write_all(out.as_bytes()).await?;
                stdout.flush().await?;
            }
        }
    }

    Ok(())
}
