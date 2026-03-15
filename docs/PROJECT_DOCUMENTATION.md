# Guardian V4 — Project Documentation

> **Status:** Desktop-first, production-ready candidate. Web UI is used for regression testing only.

## 1. Purpose & Vision
Guardian is a desktop supervision layer that enforces architectural integrity and security by continuously auditing a codebase, surfacing critiques in real-time, and providing actionable remediation guidance via the Guru interface. It is designed to stop architectural drift, prevent unsafe changes, and provide a reliable governance feedback loop to both humans and AI coding agents.

Key objectives:
- Real-time monitoring of a local workspace
- Metadata-only telemetry (path + hash + severity)
- GitHub-authenticated access control
- Provider-agnostic AI support with secure key handling
- Offline-first and desktop-first operation

## 2. Product Scope (Desktop-Only)
Guardian runs as a Tauri desktop application.

Supported modes:
- Desktop app is the primary runtime.
- Web UI is not offered as a standalone product and is only used for UI regression tests.

## 3. High-Level Architecture
**Frontend (React + TypeScript + Tailwind v4)**
- Views: Monitor, Guru, Project Map
- Settings UI for providers, API keys, web search, updates, export
- Real-time UI updates via Tauri event bus

**Backend (Tauri + Rust)**
- File watcher (Notify) + adaptive debounce
- Batch auditing pipeline
- AI provider client with secure key handling
- GitHub Device Flow auth + cached sessions
- SQLite storage for chat history, telemetry, file fingerprints

**Local Data & Artifacts**
- `.guardian/` folder generated per workspace
- `memory.db` (SQLite) for chats + audit metadata
- `critiques.md`, `chat_queue.md`, `agent_queue.jsonl` for AI agent sync

## 4. Core Features
### 4.1 Monitor (Sentry Engine)
- Watches filesystem for changes.
- Filters out non-logic files and ignored directories.
- Batches changes for AI review.
- Emits critiques and system events to UI.

### 4.2 Guru (Architect Intelligence)
- Conversational interface for remediation guidance.
- Can include web search (Tavily) when enabled.
- Supports copy actions for suggested fixes.
- Persists chat by workspace in SQLite.

### 4.3 Project Map
- Interactive map of project structure.
- Nodes are collapsed by default; user expands as needed.
- Shows folder child-count badges.

### 4.4 Security & Governance
- Hard blocks on critical violations.
- Metadata-only telemetry.
- Local-only file hashes for audit skip logic.

## 5. Authentication & Access Control
### 5.1 GitHub Device Flow
- Required to start monitoring.
- Uses `GITHUB_CLIENT_ID` and optional `GITHUB_CLIENT_SECRET`.
- Access token stored in OS keychain.
- Cached user metadata stored in app data.

### 5.2 Startup Behavior
- On startup, app reads cached user only (no keychain prompt).
- Verification occurs when user attempts monitoring or clicks Verify.
- “Cached session” warning is shown only when login is required during an action.

## 6. Provider System
Supported providers:
- Ollama
- OpenAI
- GitHub Models

Model list behavior:
- Dynamic per provider.
- Model list is cached during session.
- Provider change resets model to first available.

API key handling:
- Per-provider keys stored in OS keychain.
- Environment keys are ignored for end-user production flows.

## 7. Web Search (Tavily)
- Optional, off by default.
- Requires user-supplied Tavily key via Settings.
- Toggle available inside Guru input.
- `/web` prefix forces web search for a query.

Key handling:
- Stored only in OS keychain.
- No `.env` fallback.

## 8. Storage & Persistence
### 8.1 SQLite (memory.db)
Stored under `.guardian/memory.db` in the workspace.

Tables:
- `issues` — tracked critiques
- `audit_log` — governance events
- `file_fingerprints` — hash cache
- `telemetry_queue` — pending telemetry
- `chat_messages` — persistent Guru history per workspace

### 8.2 Workspace Artifacts
Generated under `.guardian/`:
- `critiques.md` — active critiques snapshot
- `chat_queue.md` — AI agent bridge
- `agent_queue.jsonl` — event stream for AI editors
- `STALL` — stall state marker

## 9. Monitoring Pipeline (Rust)
- Notify watcher listens for file changes.
- Non-logic and ignored paths are skipped.
- Adaptive debounce prevents rapid re-audit.
- Hash check skips unchanged files.
- Batch size and rate limiting prevent API flooding.

Critical path:
1. File change detected
2. Hash check
3. Batch sent to AI
4. Critiques emitted
5. UI updates + `.guardian` sync

## 10. UI Components & Behavior
Key views:
- Monitor: critique table, activity animation, system status
- Guru: chat interface, web search toggle, copy actions
- Project Map: node graph of workspace

Theme:
- Light/Dark modes are supported.
- Shared topbar styling across main views.

## 11. Configuration
### Required
- `GITHUB_CLIENT_ID` — GitHub OAuth App client ID

### Optional
- `GITHUB_CLIENT_SECRET` — GitHub Device Flow secret
- `GUARDIAN_UPDATE_FEED_URL` — update feed URL

Keys entered in-app:
- Provider API key (per provider)
- Tavily API key

## 12. Update System
- Optional update feed URL stored in app data or env.
- `check_for_updates` checks JSON feed.
- Downloads update to app data directory.
- Install/apply is manual (future enhancement).

## 13. Development Workflow
### Prerequisites
- Node.js 22+
- Rust toolchain 1.75+
- Tauri CLI

### Install
```bash
npm install
```

### Run (Desktop)
```bash
npm run tauri dev
```

### Run (UI only)
```bash
npm run dev
```

## 14. Testing & Verification
### Unit + Integration
```bash
npm run test
```

### Coverage
```bash
npm run test:coverage
```

### E2E (Playwright)
```bash
npm run test:e2e
```

### Full Verification Suite
```bash
npm run verify
```

## 15. CI / PR Integration (Optional)
Desktop users do not need the CLI. For CI-friendly PR checks (summary comments, gating, SARIF upload),
see:

- `docs/CI_PR_INTEGRATION.md`

## 15. Build & Release
### Frontend build
```bash
npm run build
```

### Rust checks
```bash
cd src-tauri
cargo check
cargo test
```

### Tauri bundle
```bash
npm run tauri build
```

## 16. Troubleshooting
**Keychain password prompt appears every launch**
- On first access, choose “Always Allow.”
- Guardian no longer forces keychain access on startup.

**Cached session warning persists**
- It appears only when starting monitoring without verified login.
- Click “Verify Now” when online.

**Playwright fails with port error**
- Run tests locally where port binding is allowed.
- Default base URL is `http://localhost:5173`.

**Web search fails**
- Ensure Tavily key is present in Settings.
- Web search is disabled without key.

## 17. Security Notes
- API keys never written to disk in plaintext.
- GitHub access token stored in OS keychain.
- Metadata-only telemetry by default.
- Critical issues can stall monitoring until resolved.

## 18. Roadmap (Short-Term)
- Stronghold-backed secret storage option
- Incremental project map loading for very large repos
- Optional silent background update apply
- Provider-specific model filtering enhancements
