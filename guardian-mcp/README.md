# guardian-mcp

MCP (Model Context Protocol) server for the Guardian security scanner.

## Overview

`guardian-mcp` exposes Guardian's scanning capabilities as an MCP tool server.
AI assistants that support MCP can connect to this server over **stdio** and
invoke security-scanning tools through the standard JSON-RPC 2.0 protocol.

## Available Tools

| Tool | Description |
| ---- | ----------- |
| `scan_file` | Scan a single file for security issues |
| `list_critiques` | List findings from the most recent scan |
| `get_scan_policy` | Return the current scan policy configuration |
| `apply_fix` | Apply a suggested fix for a specific finding |
| `classify_paths` | Walk a workspace and classify files by scan-policy eligibility |

## Building

```bash
cargo build -p guardian-mcp
```

## Usage

The server communicates over stdin/stdout using newline-delimited JSON-RPC 2.0
messages. It is designed to be launched by an MCP-aware client.

### Manual testing

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | cargo run -p guardian-mcp
```

### MCP client configuration

Add to your MCP client config (e.g. `mcp.json`):

```json
{
  "mcpServers": {
    "guardian": {
      "command": "cargo",
      "args": ["run", "-p", "guardian-mcp"]
    }
  }
}
```

Or, after building, point directly at the binary:

```json
{
  "mcpServers": {
    "guardian": {
      "command": "./target/release/guardian-mcp"
    }
  }
}
```

## Protocol

The server implements the [Model Context Protocol](https://modelcontextprotocol.io)
specification (`2024-11-05`).

**Lifecycle:**

1. Client sends `initialize` → server returns capabilities
2. Client sends `initialized` notification
3. Client calls `tools/list` to discover available tools
4. Client calls `tools/call` with a tool name and arguments
5. Connection closes when the client closes stdin

## Status

`guardian-mcp` is a working stateless MCP server.

- `scan_file`, `get_scan_policy`, and `classify_paths` return live policy/classification data.
- `list_critiques` and `apply_fix` intentionally delegate stateful scan/fix workflows to `guardian-cli` or the desktop app.
