# Guardian — AI Code Governance (VS Code Extension)

VS Code extension that connects to the [Guardian](../README.md) MCP server to provide real-time code governance, security scanning, and critique reporting directly in your editor.

## Features

| Command | Description |
|---|---|
| **Guardian: Scan Current File** | Run a Guardian scan on the active editor file |
| **Guardian: Show Critiques** | Fetch all critiques and display them in the Problems panel |
| **Guardian: Start Monitoring** | Auto-scan supported files on every save |

- **Diagnostics integration** — critiques appear as warnings/errors in the VS Code Problems panel
- **Language support** — TypeScript, JavaScript, Rust, Python, Go
- **Configurable severity filter** — show only findings above a chosen threshold
- **MCP stdio transport** — communicates with `guardian-mcp` over JSON-RPC 2.0

## Prerequisites

1. **Guardian MCP server** — build the server from the repository root:
   ```bash
   cargo build --release -p guardian-mcp
   ```
2. Ensure the `guardian-mcp` binary is on your `PATH`, or set the path in extension settings.

## Setup

```bash
cd guardian-vscode
npm install
npm run compile
```

To run in development mode, press **F5** in VS Code with this folder open — it will launch an Extension Development Host.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `guardian.serverPath` | `guardian-mcp` | Path to the `guardian-mcp` binary |
| `guardian.serverUrl` | `stdio` | Connection mode (`stdio` for local, or an HTTP URL) |
| `guardian.scanProfile` | `source` | Scan profile: `source`, `extended`, or `full` |
| `guardian.autoScanOnSave` | `false` | Automatically scan files when saved |
| `guardian.severityFilter` | `low` | Minimum severity shown in diagnostics |

## Architecture

```
guardian-vscode/
├── src/
│   ├── extension.ts          # Activate/deactivate, command registration
│   ├── guardianClient.ts     # MCP JSON-RPC client (stdio transport)
│   └── diagnostics.ts        # VS Code diagnostic provider
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript configuration
└── .vscodeignore              # Packaging ignore patterns
```

The extension spawns `guardian-mcp` as a child process and communicates via newline-delimited JSON-RPC 2.0 over stdin/stdout — the same protocol used by MCP (Model Context Protocol).

## Development

```bash
npm run watch   # Recompile on changes
npm run lint    # Run ESLint
npm run package # Build .vsix for distribution
```

## License

MIT — see [LICENSE](../LICENSE).
