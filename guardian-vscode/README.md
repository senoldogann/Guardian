# Guardian — AI Code Governance (VS Code Extension)

VS Code extension that connects to the [Guardian](https://github.com/senoldogann/Guardian) MCP server to provide real-time code governance, security scanning, and critique reporting directly in your editor.

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
- **Explicit failure handling** — empty results, snapshot warnings, parse failures, and transport failures surface as different editor states

## Install

Recommended end-user path:

1. Install the extension from the VS Code Marketplace.
2. Download the matching `guardian-mcp` archive from the Guardian distribution release.
3. Extract the binary, place it on your `PATH`, or set `guardian.serverPath` to the extracted binary path.

Private/fallback path:

```bash
code --install-extension guardian-code-governance-1.3.0.vsix
```

The Marketplace package and the release `.vsix` both require a local `guardian-mcp` binary. End users do not need Rust if they use the prebuilt release archives.

## Prerequisites

1. **Guardian MCP server** — for development builds, build the server from the repository root:
   ```bash
   cargo build --release -p guardian-mcp
   ```
2. Ensure the `guardian-mcp` binary is on your `PATH`, or set the path in extension settings.

## Setup

```bash
cd guardian-vscode
npm install
npm run validate
```

To run in development mode, press **F5** in VS Code with this folder open — it will launch an Extension Development Host.

## Extension Settings

| Setting | Default | Description |
|---|---|---|
| `guardian.serverPath` | `guardian-mcp` | Path to the `guardian-mcp` binary |
| `guardian.scanProfile` | `source` | Scan profile: `source`, `extended`, or `full` |
| `guardian.autoScanOnSave` | `false` | Automatically scan files when saved |
| `guardian.severityFilter` | `low` | Minimum severity shown in diagnostics |

## Architecture

```
guardian-vscode/
├── src/
│   ├── extension.ts          # Activate/deactivate, command registration
│   ├── guardianClient.ts     # MCP JSON-RPC client (stdio transport)
│   ├── resultParsers.ts      # Snapshot-backed MCP payload parsing
│   ├── feedback.ts           # Notification planning for domain vs client errors
│   ├── diagnostics.ts        # VS Code diagnostic provider
│   └── models.ts             # Shared result and critique models
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript configuration
├── tsconfig.test.json         # Test compilation target
├── eslint.config.mjs          # Local lint configuration
└── .vscodeignore              # Packaging ignore patterns
```

The extension currently supports only local `stdio` transport. It spawns `guardian-mcp` as a child process and communicates via newline-delimited JSON-RPC 2.0 over stdin/stdout. `guardian-mcp` returns snapshot-backed critique payloads, and the extension keeps domain warnings separate from parse and transport failures.

## Development

```bash
npm run watch   # Recompile on changes
npm run lint    # Run ESLint
npm run test    # Run parser + feedback unit tests
npm run validate # Lint + test + compile + package
npm run package # Build .vsix for distribution
npm run publish:marketplace # Publish to the configured VS Code Marketplace publisher
```

## License

MIT — see [LICENSE](https://github.com/senoldogann/Guardian/blob/main/LICENSE).
