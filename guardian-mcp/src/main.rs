use anyhow::{anyhow, Result};
use guardian_scan_policy::{classify_path, load_policy_for_root, GuardianPolicy, ScanProfile};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::Path;
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
    let file_path = arguments
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("missing required argument: path"))?;

    let profile = parse_profile(arguments);
    let path = Path::new(file_path);

    let decision = classify_path(path, false, profile);
    let language = language_from_extension(path);

    let (file_size, line_count) = if path.exists() && path.is_file() {
        match std::fs::read_to_string(path) {
            Ok(content) => (content.len() as u64, content.lines().count()),
            Err(_) => match std::fs::metadata(path) {
                Ok(meta) => (meta.len(), 0),
                Err(_) => (0, 0),
            },
        }
    } else if !path.exists() {
        return Ok(mcp_json_response(&json!({
            "error": "file_not_found",
            "file_path": file_path,
            "message": format!("File does not exist: {}", file_path)
        })));
    } else {
        return Ok(mcp_json_response(&json!({
            "error": "not_a_file",
            "file_path": file_path,
            "message": format!("Path is not a file: {}", file_path)
        })));
    };

    let mut result = json!({
        "file_path": file_path,
        "file_size": file_size,
        "line_count": line_count,
        "language": language,
        "scan_profile": profile.as_str(),
        "is_candidate": decision.include,
    });

    if let Some(reason) = decision.reason {
        result["skip_reason"] = json!(reason.as_str());
    }

    Ok(mcp_json_response(&result))
}

fn handle_list_critiques(arguments: &Value) -> Value {
    let severity = arguments
        .get("severity")
        .and_then(|v| v.as_str())
        .unwrap_or("all");
    let workspace = arguments
        .get("workspace_path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let cmd = if severity != "all" {
        format!(
            "guardian-cli scan --format json --min-severity {} {}",
            severity, workspace
        )
    } else {
        format!("guardian-cli scan --format json {}", workspace)
    };

    mcp_json_response(&json!({
        "status": "stateless_server",
        "message": "The Guardian MCP server is stateless and does not persist scan results between calls. To retrieve critiques, run the Guardian CLI directly.",
        "suggested_command": cmd,
        "alternatives": [
            "Use the Guardian desktop app for interactive scanning with critique history",
            "Run `guardian-cli scan --watch <path>` for continuous scanning",
            "Use `guardian-cli scan --format json <path>` for machine-readable output"
        ]
    }))
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
    let mut candidates = 0usize;
    let mut skipped = 0usize;
    let mut total = 0usize;
    let mut skip_reasons: HashMap<&str, usize> = HashMap::new();
    let mut files: Vec<Value> = Vec::new();
    let mut truncated = false;

    walk_dir(
        root,
        root,
        profile,
        MAX_FILES,
        &mut total,
        &mut candidates,
        &mut skipped,
        &mut skip_reasons,
        &mut files,
        &mut truncated,
    );

    Ok(mcp_json_response(&json!({
        "workspace_path": workspace,
        "scan_profile": profile.as_str(),
        "total_files": total,
        "candidates": candidates,
        "skipped": skipped,
        "truncated": truncated,
        "skipped_by_reason": skip_reasons,
        "files": files,
    })))
}

fn walk_dir<'a>(
    dir: &Path,
    root: &Path,
    profile: ScanProfile,
    max_files: usize,
    total: &mut usize,
    candidates: &mut usize,
    skipped: &mut usize,
    skip_reasons: &mut HashMap<&'a str, usize>,
    files: &mut Vec<Value>,
    truncated: &mut bool,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if *total >= max_files {
            *truncated = true;
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
            walk_dir(
                &path,
                root,
                profile,
                max_files,
                total,
                candidates,
                skipped,
                skip_reasons,
                files,
                truncated,
            );
            continue;
        }

        if !path.is_file() {
            continue;
        }

        let relative = path.strip_prefix(root).unwrap_or(&path);
        let decision = classify_path(relative, false, profile);

        *total += 1;

        if decision.include {
            *candidates += 1;
            files.push(json!({
                "path": relative.to_string_lossy(),
                "is_candidate": true,
            }));
        } else {
            *skipped += 1;
            let reason_str = decision.reason.map(|r| r.as_str()).unwrap_or("unknown");
            // Safety: SkipReason::as_str returns &'static str
            let static_reason: &'static str =
                decision.reason.map(|r| r.as_str()).unwrap_or("unknown");
            *skip_reasons.entry(static_reason).or_insert(0) += 1;
            files.push(json!({
                "path": relative.to_string_lossy(),
                "is_candidate": false,
                "skip_reason": reason_str,
            }));
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
        "list_critiques" => Ok(handle_list_critiques(&arguments)),
        "get_scan_policy" => Ok(handle_get_scan_policy(&arguments)),
        "apply_fix" => Ok(handle_apply_fix(&arguments)),
        "classify_paths" => handle_classify_paths(&arguments),
        other => Err(anyhow!("unknown tool: {}", other)),
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
