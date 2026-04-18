use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
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
            "description": "Scan a file for security issues using Guardian's scan engine",
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
            "description": "List all critiques/findings from the most recent scan",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "enum": ["low", "medium", "high", "critical"],
                        "description": "Filter critiques by minimum severity"
                    }
                }
            }
        },
        {
            "name": "get_scan_policy",
            "description": "Get the current Guardian scan policy configuration",
            "inputSchema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "apply_fix",
            "description": "Apply a suggested fix for a specific critique finding",
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

fn handle_tool_call(params: &Value) -> Result<Value> {
    let tool_name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("missing tool name"))?;

    let _arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    let content_text = match tool_name {
        "scan_file" => "scan_file: not yet implemented — will use guardian-scan-policy to scan the requested file",
        "list_critiques" => "list_critiques: not yet implemented — will return findings from the last scan",
        "get_scan_policy" => "get_scan_policy: not yet implemented — will return current policy configuration",
        "apply_fix" => "apply_fix: not yet implemented — will apply the suggested fix for a critique",
        other => return Err(anyhow!("unknown tool: {}", other)),
    };

    Ok(json!({
        "content": [
            {
                "type": "text",
                "text": content_text
            }
        ]
    }))
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
