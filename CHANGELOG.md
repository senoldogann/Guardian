# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - AI Pipeline Overhaul + MCP Server + Developer Ecosystem

Published: Apr 18, 2026

### 🎯 Highlights
This is the largest release since v1.0.0. The AI analysis pipeline has been rebuilt for precision, the developer ecosystem expanded with MCP and CLI integration, and a comprehensive security/architecture audit addressed 60+ issues across the entire codebase.

### 🧠 AI Pipeline Overhaul
- **Evidence-Based Findings**: Critiques now include `line_start`, `line_end`, `evidence_snippet`, `category`, and `confidence` fields for verifiable, actionable results.
- **Few-Shot Prompts**: System prompts upgraded with concrete good/bad examples, chain-of-thought reasoning, and language-specific rules (React hooks, Rust ownership, Go error handling, Python type hints).
- **Prompt Template System**: Embedded prompts via `include_str!` with `{{VAR}}` substitution and workspace-level overrides (`prompts/` directory).
- **Import Context Analysis**: Critiques now receive `build_import_context()` data showing local module relationships and type signatures.
- **Performance Tuning**: Batch size 3→5, content limit 6K→8K chars, concurrency 1→2, flush interval 5s→3s.
- **CLI Prompt Parity**: CLI batch scan now uses the same high-quality system prompt as desktop.

### 🖥️ UI Enhancements
- **Line Numbers**: Findings display exact line ranges (`L42-L58`).
- **Category Badges**: Color-coded `security`, `performance`, `maintainability`, `correctness`, `style` tags.
- **Confidence Indicator**: Visual percentage showing AI certainty per finding.
- **Evidence Snippets**: Expandable code evidence directly in the critique row.
- **DiffViewer**: Side-by-side diff display for suggested fixes.
- **Category Filter Bar**: Filter findings by category with one click.

### 🔌 MCP Server (NEW)
- Guardian MCP server (`guardian-mcp`) with 5 production tools:
  - `scan_file` — Scan a single file against policy with metadata
  - `get_scan_policy` — Retrieve workspace or default scan policy
  - `classify_paths` — Batch classify files by policy (up to 100)
  - `list_critiques` — Guidance for accessing stored critiques
  - `apply_fix` — Guidance for applying suggested fixes
- Works with Cursor, Claude Desktop, and any MCP-compatible client.

### 🔒 Security Hardening
- **Thread-Safe Env**: Replaced `std::env::set_var` UB with `SecureEnvStore` atomic store.
- **Secret Masking**: API keys wrapped in `SecretString` (zeroed on drop).
- **Scoped FS**: Tauri permissions narrowed from global to workspace-only access.
- **CSP Tightened**: Removed `unsafe-eval` from Content Security Policy.
- **IPC Auth Gates**: Added auth checks to `apply_fix`, `apply_fix_now`, `undo_fix`, `confirm_fix`.
- **Redaction Patterns**: Expanded from 5 to 19+ patterns (OpenAI, Anthropic, AWS, GCP, Stripe, Slack, npm, JWT, Private Keys, Database URLs, Email, Phone).
- **CLI Redaction Parity**: CLI now matches desktop's full 19-pattern redaction.
- **Transcript Detection**: 2-tier scoring (strong markers instant-reject, weak markers need ≥2) to avoid false positives.
- **Path Safety**: CLI no longer leaks absolute paths on `strip_prefix` failure.

### 🏗️ Architecture Refactoring
- **App.tsx**: Decomposed from 1355→390 lines into focused components.
- **SettingsModal**: Split from 1779→160 lines into 6 sub-components.
- **watcher.rs**: Split 4004-line god module into 7 focused modules (`context`, `pipeline`, `critique`, `triage`, `state`, `events`, `debounce`).
- **ProviderSpec Trait**: Extracted provider logic from monolithic AI client.
- **Zustand Stores**: Created `authStore`, `workspaceStore`, `uiStore`, `toastStore`.
- **useSettings**: Split into 6 focused sub-hooks.
- **i18n**: Split inline translations into separate locale files.

### 🌐 Website Updates
- **6 New Doc Pages**: CLI guide, MCP Server setup, Secret Redaction reference (EN + TR).
- **Ecosystem Section**: New homepage component showcasing CLI, MCP, VS Code, Redaction, Multi-Provider, Evidence.
- **FAQ Expansion**: 2 new general questions + "Developer Tools" category (5 questions) in EN and TR.
- **7 New Feature Descriptions**: Added to i18n for CLI, MCP, VS Code, rule engine, redaction, evidence, multi-provider.
- **Translation Fixes**: Corrected Turkish translations.

### 🧪 Testing
- **139 Unit Tests**: Up from 68 (71 new tests added).
- **28 CLI Tests**: Full redaction and scan coverage.
- **11 Rules Engine Tests**: Deterministic rule evaluation.
- **6 New E2E Groups**: Category Filters, Guru Chat, Keyboard Shortcuts, Evidence Display, Settings Extended, Accessibility.
- **Coverage Gates**: 80% threshold enforced.

### 🛠️ Developer Experience
- **52 IPC Commands Documented**: Full API reference in `docs/IPC_COMMANDS.md`.
- **Cargo Workspace**: All 5 crates unified under workspace.
- **SQLite WAL**: Enabled WAL mode for concurrent read performance.
- **CI Lint**: Added `rustfmt` and `clippy` checks to CI.
- **Removed 5 Unused Deps**: Cleaned Cargo dependency tree.

### 📦 Ecosystem
- **guardian-cli**: Production-ready CLI scanner with full prompt parity.
- **guardian-mcp**: MCP server for IDE integration.
- **guardian-rules**: Deterministic rule engine (11 tests).
- **guardian-vscode**: VS Code extension scaffold with diagnostics and MCP client.
- **guardian-scan-policy**: Shared scan policy between desktop and CLI.

---

## [1.2.6] - Approval Policy + Audit Compatibility + Review Precision

Published: Apr 4, 2026

### Highlights
- Release approval policy documented with role boundaries for release managers, incident commanders, and reviewers.
- Legacy `.guardian/release_decisions.jsonl` rows now remain readable during upgrades, so manual approval state is preserved.
- Audit precision hardened for local/dev-only findings and recent-fix context reuse to reduce stale duplicate reports.
- Website FAQ platform messaging aligned with the current macOS + Windows release reality.

### Governance
- Added a regression test for restoring manual approval state from legacy release-decision audit rows.
- Release gate behavior and approval state rules now link directly to the release approval policy document.

### Dependencies
- Updated `jspdf` and `next` patch versions and added dependency overrides to reduce critical/high npm audit exposure.

## [1.2.5] - Cross-Platform Release + UX Polish

Published: Mar 16, 2026

### Highlights
- Cross-platform release flow stabilized for macOS + Windows with strict release gate enforcement.
- Distribution publish pipeline hardened with updater key alignment checks before release publication.
- Website UX polish on homepage section transitions (softer section boundaries in light/dark themes).
- Documentation release-note sync improved and mobile readability refinements continued.

### CI/CD
- GitHub Actions core actions upgraded to Node24-compatible majors:
  - `actions/checkout@v6`
  - `actions/setup-node@v6`
  - `actions/upload-artifact@v6`
  - `actions/download-artifact@v8`

### Governance
- Release-note synchronization remains changelog-driven; `1.2.5` entry added for deterministic release note rendering.

## [1.2.4] - Release Readiness: Website + Gate Stability

Published: Mar 15, 2026

### Highlights
- Release pipeline calibrated for immediate shipping:
  - `guardian.policy.yaml` warning threshold tuned to `pass_max_warnings: 10` for strict gate stability.
  - `release_all_local.sh --gate-only` now passes with `PASS_WITH_WARNING` on current repo state.
- Scan noise reduced in governance core:
  - `.maestro` path is now excluded from source/extended scan surfaces in `guardian-scan-policy`.
  - Prevents non-product skill library files from polluting release decisions.
- Website production checklist hardened:
  - Pre-launch checker updated for current Next.js App Router file topology.
  - Unit test counting and critical-file checks now reflect real project structure.

### Security / Quality
- Website dependency audit fixed (`npm audit fix`): high/moderate vulnerabilities reduced to zero.
- Website pre-launch gate now passes end-to-end (typecheck, lint, tests, build, audit, docs checks).

## [1.2.3] - Quality-First: Faster Scans + Project-Aware Audits + One-Click Fixes

Published: Feb 18, 2026

### Highlights
- Full EN/TR localization: Desktop + website UI now support English and Turkish. Guru + Monitor AI outputs follow your selected language (severity tokens remain stable).
- One-click Apply + Undo: apply fixes immediately from Monitor and Guru, with a per-file Undo history.
- Guru notifications: when a reply arrives and you are on another tab, you get a toast + a sidebar badge count.
- Reviews now stays useful even without proposals: includes a Fix History panel (Undo available) alongside Fix Proposals.
- Ollama reliability: default base URL `http://localhost:11434` (legacy `127.0.0.1:11434` configs are normalized to `localhost`).
- Faster repeat scans: unchanged files can be skipped without reading file contents (mtime/bytes fingerprints).
- Faster initial scan: bounded worker-pool pipeline (no per-file sleep) for stable throughput.
- Better suggestions: "Project Intent Pack" is injected into audits and Guru so advice aligns with your workspace intent/architecture.
- Smarter audits (less noise): mixed-gate triage for `extended/full` so infra/docs/lock/test surfaces are audited only when risk signals are present.

### Changed
- Project Map context now respects the persisted Scan Scope (`source|extended|full`) for consistency with monitoring.

## [1.2.2] - Balanced Performance + Smart Scope

Published: Feb 17, 2026

### Highlights
- Scan scope profiles: `Source` (default), `Extended`, `Full` to balance cost vs coverage.
- Desktop + CLI alignment: shared scan policy core to avoid drift in what gets scanned and skipped.
- Guru stays responsive while monitoring: adaptive AI queue with fairness between audit traffic and chat.
- Web search upgrades (Tavily): URL-aware extract when a link is present, plus configurable search depth.

### Fixed
- Full vs Extended visibility: `Full` now surfaces generic infra warnings (and significant infos) as expected; `Extended` remains security-focused.
- Website rate limiting: release pages prefer the `releases.json` snapshot to avoid GitHub API 403/rate-limit spam.

### Changed
- Settings: added Scan Scope and Web Search depth controls; copy clarified around search vs extract behavior.
- Release hardening: stricter CSP allowlist and secret-scan gate integrated into `npm run verify`.

## [1.2.1] - Token Efficiency Defaults

Published: Feb 12, 2026

### Highlights
- Source-focused scan policy skips low-signal files by default (`docs`, `tests`, `scripts`, lockfiles, Dockerfiles, rule files), reducing token waste.
- Batch processor default flush threshold increased from `2` to `3` files (`GUARDIAN_MAX_BATCH_SIZE` default).

### Changed
- Desktop watcher and `guardian-cli` file filtering are aligned to the same code-first scan policy.
- Version sync updated across app, Tauri, and website to `1.2.1`.

## [1.2.0] - Stabilization: Monitoring + Embeddings

Published: Feb 10, 2026

### Highlights
- Ollama launch no longer requires an API key; requests skip `Authorization` when key is missing.
- Batch critique `file_path` is normalized/whitelisted to prevent ghost findings and monitor state drift.
- AI Context and Reviews moved to an inspector split layout for faster triage and reduced scroll load.

### Fixed
- Playwright release-gate regressions: strict-mode Guru selector ambiguity and filter visibility expectation mismatch.
- Local distribution scripts accept `latest.json.version` in both `1.2.0` and `v1.2.0` formats.

### Changed
- Added one-command local release flow: `scripts/release_all_local.sh` (verify, build, artifact collect, distribution publish, changelog sync).
- Re-enabled Tauri updater artifact generation and fallback `latest.json` generation from `.tar.gz + .sig`.
- Added Updates tab About links in Settings (website and contact).

## [1.1.1] - 2026-02-10 🐛 HOTFIX

### Fixed
- Updater Signature: Fixed "Invalid encoding in minisign data" error by correctly signing the DMG file
- Update Popup UI: 
  - Fixed background color in dark mode (changed from gradient to solid accent color)
  - Fixed text colors for better visibility
  - Fixed "Dismiss" button contrast in dark mode
- Settings Updates Tab: 
  - Removed inline changelog text
  - Added "View changelog on website" link pointing to www.guardianide.com

---

## [1.1.0] - 2026-02-10 🚀 PHASE 6 COMPLETE

### Added
- Phase 6.1 Semantic Index (Desktop):
  - Local semantic vector persistence in `.guardian/memory.db` (`semantic_vectors` table).
  - Embedding strategy with provider routing:
    - OpenAI `text-embedding-3-small` (default),
    - Ollama `nomic-embed-text` (optional),
    - deterministic local hash fallback (offline/error).
  - Semantic recall flow for new critical findings in watcher pipeline.
- Guru Semantic Context:
  - Query-time semantic similarity retrieval for prompts like "benzer/similar/semantic/critical pattern".
  - Retrieved matches are appended into Guru context as `Semantic Similarity Matches`.
- Phase 5 Review Queue:
  - Append-only fix proposal queue (`.guardian-proposals/fix_proposals.jsonl`).
  - Review status transitions (`review_requested`, `rejected`, `applied`) with Tauri commands and desktop UI integration.

### Changed
- Phase 6.2 Diff-Focused AI Context:
  - Watcher prompt payload now prioritizes diff hunks over full snapshot context when prior snapshot exists.
  - Added hunk limits and truncation controls for consistent token usage.
- Phase 6.1.1 sqlite-vec KNN path:
  - Added native sqlite-vec index path for 256-d semantic embeddings (`semantic_vectors_ann` via `vec0`).
  - Semantic retrieval now uses sqlite-vec KNN-first search with automatic cosine fallback on incompatibility/error.
- Phase 6.3 guardian.lock:
  - Introduced `guardian.lock` schema v1 for rules/workspace/version pinning.
  - Desktop auto-syncs lock state; CLI supports `--lock` and `--lock-mode off|warn|strict`.
- Phase 4 Protocol Stabilization:
  - `.guardian/critiques.json` + `.guardian/critiques.md` paths normalized to relative paths.
  - `agent_queue.jsonl` payloads minimized and archive rotation stabilized (size + retention policy).

### Documentation
- Added `docs/MIGRATION_GUIDE_PHASE6.md` for `guardian.lock` v1 and baseline `schema_version=2` migration.
- Added `docs/reports/PHASE6_TOKEN_PERFORMANCE.md` with measured 6.2 token reduction benchmark.

## [1.0.0] - 2026-02-08 🚀 MAJOR RELEASE

### 🎉 Production Ready - v1.0.0

#### Infrastructure & CI/CD
- Self-Hosted CI/CD Pipeline: Complete migration from GitHub-hosted to self-hosted runners
  - Zero GitHub Actions minutes consumption
  - Automated runner setup script (`scripts/setup-runner.sh`)
  - Cross-platform support (macOS arm64/x64, Linux x64)
  - Comprehensive workflow: test → build → security scan → deploy
  - Tauri desktop builds on local hardware
  - Website static generation with environment validation
- CI/CD Workflow v1: `.github/workflows/ci-cd-v1.yml`
  - Parallel job execution
  - Artifact retention policies
  - Security scanning integrated
  - E2E testing on PR

#### Version Updates
- Global Version Bump: 0.2.8 → 1.0.0
  - `package.json`: v1.0.0
  - `src-tauri/tauri.conf.json`: v1.0.0
  - `website/package.json`: v1.0.0
  - Tauri window title: "Guardian v1.0.0"

#### Security Enhancements
- Content Security Policy (CSP): Hardened security headers
- Automated Security Scanning:
  - NPM audit on every push
  - Cargo audit for Rust dependencies
  - Configurable audit level (moderate+)
- GitHub Token Security: Improved handling and validation

#### Documentation
- README v1.0.0: Complete overhaul with CI/CD instructions
- CHANGELOG: Restructured with migration guide
- Runner Setup Guide: Automated script with prerequisites check

#### Technical Improvements
- Build Optimization: Parallel builds for desktop and website
- Test Coverage Pipeline: Automated coverage reporting
- Artifact Management: Structured artifact naming with version
- Environment Validation: Pre-build env var checks

---

## Migration Guide: 0.2.8 → 1.0.0

### For Developers

1. Pull latest changes:
   ```bash
   git pull origin main
   ```

2. Update dependencies:
   ```bash
   npm install
   cd website && npm install
   cd ..
   ```

3. Setup CI/CD runner (recommended):
   ```bash
   bash scripts/setup-runner.sh
   ```
   Then follow the prompts to configure and start the runner.

4. Verify everything works:
   ```bash
   npm run test
   npm run build
   cd website && npm run build
   ```

### Breaking Changes
None - fully backward compatible.

### New Requirements
- Self-hosted runner for CI/CD (optional but recommended)
- Node.js 22+ (updated)
- Rust 1.75+ (unchanged)

---

## [0.2.8] - 2026-02-06

### Security & CI
- Cargo Audit Fix: Updated `time` to `0.3.47` to address `RUSTSEC-2026-0009`.
- DMG Validation Hardening: Improved macOS DMG notarization validation and re-upload flow in the release pipeline.
- macOS Signing Auto-detect: Release workflow no longer requires `APPLE_SIGNING_IDENTITY` (auto-detects the imported Developer ID cert).

### Website
- Build/Lint Stability: Added ESLint flat config and removed deprecated `next lint` usage for CI-safe lint runs.
- Image Optimization: Switched legacy `<img>` usage to `next/image` to keep Next.js warnings clean.

## [0.2.7] - 2026-02-06

### Security & CI
- Cargo Audit Fix: Updated `time` to `0.3.47` to address `RUSTSEC-2026-0009`.
- DMG Validation Hardening: Improved macOS DMG notarization validation and re-upload flow in the release pipeline.
- macOS Signing Auto-detect: Release workflow no longer requires `APPLE_SIGNING_IDENTITY` (auto-detects the imported Developer ID cert).

### Website
- Build/Lint Stability: Added ESLint flat config and removed deprecated `next lint` usage for CI-safe lint runs.
- Image Optimization: Switched legacy `<img>` usage to `next/image` to keep Next.js warnings clean.

## [0.2.6] - 2026-02-06

### Release & Distribution
- macOS Notarization Re-enabled: Release workflow now enforces notarization preflight checks and notarized artifact validation for both Apple Silicon and Intel targets.
- Public Distribution Validation: Added stronger distribution publication checks for required assets, digests, updater metadata, and URL rewrites.
- PUBLIC_DIST_REPO Fallback: Workflow now accepts distribution repo from Actions Variable first, then Secret fallback.

### Auth & UX Stability
- Deterministic Auth State: Added explicit auth states (`signed_out`, `device_pending`, `verifying`, `signed_in_verified`, `signed_in_offline`).
- Launch Blocking Reason: `Launch Guardian` now exposes precise in-UI reasons when disabled.
- Logout/Login Flow Cleanup: Cleans stale flow state and pending login data before re-auth attempts.

### Updates Panel
- Current/Latest Fallbacks: Update section now preserves `current_version`, tracks `last_checked_at`, and shows meaningful unavailable status on network/updater failures.
- Rust Updater Result Hardening: `check_app_update` returns structured unavailable responses instead of empty/unknown UI states.

### Website
- Premium Home Redesign: Rebuilt homepage with modern editorial hero, trust signals, feature cards, screenshot gallery, and video demos.
- Media Integration: Added desktop screenshots and converted demo recordings for web playback (desktop + mobile variants).
- Download UX Upgrade: Added manual platform override while preserving hydration-safe auto-detection and checksum utilities.
- Mobile-first Styling: Completed responsive layout rules for homepage, media sections, and download controls.

## [0.2.5] - 2026-02-05

### Distribution & Updates
- Private Source, Public Distribution: Release pipeline now supports publishing signed assets from private source repo to public distribution repo.
- Updater Endpoint Migration: Desktop updater endpoint switched to `senoldogann/guardian-distribution` so end users can receive updates even when source repo is private.
- Release Mirror Job: Added `publish_distribution` job in release workflow to copy release assets and notes automatically.

### Website
- Next.js Public Site: Added `website/` with production-ready pages:
  - `/download` (OS-aware installer selection)
  - `/changelog` (GitHub Releases-synced)
  - `/docs` (public operational documentation)
- Release-driven APIs: Added `/api/releases` and `/api/releases/latest` endpoints with caching for automatic content refresh.

### Security & Stability
- React + Rust Build Fixes: Resolved `react-window` compatibility issues and completed Rust `secrecy` migration fixes.
- Validation Hardening: Stabilized update/status handling and protected UI paths against missing release data.

### Documentation
- Operational Guide: Added private/public deployment runbook in `docs/PRIVATE_DISTRIBUTION_SETUP.md`.
- README Updates: Documented distribution architecture, required GitHub secrets/variables, and website integration.

## [0.2.4] - 2026-02-05

### Security
- CSP Hardening: Added Anthropic, Tavily, GitHub Models, and Google AI endpoints to Content Security Policy.
- Error Logging: Replaced silent catch blocks with proper error logging following SPAP v2.2 guidelines.

### Performance
- Virtualization: App.tsx and ChatView.tsx already use react-window for large list rendering.
- Dynamic Import: jsPDF uses dynamic import to reduce initial bundle size.
- useMemo Optimization: filteredLogs and stats already use useMemo for performance.

### Testing
- StallOverlay Tests: Added comprehensive test suite for StallOverlay component (8 test cases).
- Coverage Threshold: Maintained 80% coverage threshold in vitest.config.ts.

### Infrastructure
- Version Sync: Synchronized version to 0.2.4 across package.json, Cargo.toml, and tauri.conf.json.
- Docker Ready: Dockerfile, docker-compose.yml, and .dockerignore are production-ready.
- CI/CD Multi-platform: GitHub Actions workflows support Linux, Windows, and macOS.

### Code Quality
- Type Safety: Centralized types in /types/index.ts with ITauriAPI interface.
- Constants: Magic strings consolidated in /constants/index.ts.
- Hook Architecture: useKeyManagement, useLocalStorage, useToast hooks implemented.

## [4.0.3] - 2026-02-05

### Added
- Watcher Config Env: Watcher batch sizing, truncation, and retry parameters are now configurable via env in `config.rs`.
- UI Refactor: Split `App.tsx` into focused components + hooks for auth and settings.
- E2E Coverage: Expanded Playwright suite to cover settings, navigation, monitoring, and responsive checks.

### Changed
- Watcher Limits: Removed hardcoded limits in `watcher.rs` in favor of config getters.
- Mutex Poison Logging: Added explicit error logging on poisoned debouncer lock.

## [4.0.2] - 2026-02-05

### Fixed
- Auth Session Resume: Auto-refreshes cached GitHub sessions on launch and allows offline-verified sessions to start monitoring without forced re-login.

## [4.0.1] - 2026-02-04

### Added
- Settings Tabs: Split settings into Provider, Web Search, Updates, and Export tabs for clarity.
- Tavily Web Search Toggle: In-chat web search toggle with `/web` prefix override and heuristic auto-use.
- Chat Controls: Clear-chat confirmation modal and persistent keychain-backed Tavily key storage.
- Project Map Enhancements: Default-collapsed tree, folder child-count badges, and clickable nodes.
- Verification Script: `npm run verify` to run unit, E2E, build, and Rust checks.
- Export PDF Tests: Added unit tests for `exportAuditToPdf`.

### Changed
- Provider Setup Flow: API key entry moved into Provider settings with stricter validation.
- Key Handling: Tavily keys now stored only from UI (no `.env` fallback).
- E2E Base URL: Playwright now uses `localhost:5173` to avoid Tauri port conflicts.
- Icons: Normalized PNG icon assets to valid RGBA images for Tauri builds.

### Fixed
- ChatView Stability: Guarded against invalid history payloads and improved empty-state behavior.
- Theme Toggle E2E: Stabilized E2E flow by opening Settings before toggling theme.
- Tauri Test Harness: Made `__TAURI_INTERNALS__` configurable for clean test isolation.

## [4.0.0] - 2026-01-26

### Added
- Guru Guide: Interactive, premium usage manual with Glassmorphism and Aurora UI styles.
- English Localization: Universal translation of the Guru interface for global standards.
- Hover Micro-animations: Enhanced transition states for all interactive cards and options.
- AI Discovery: Structured metadata file for AI agent discovery protocols.

### Changed
- Global Scaling: Increased global font scaling to 110% for improved accessibility.
- Theming: Synchronized Guru colors with the emerald Guardian theme.
- Header Standardization: Standardized all header heights to `h-14` across monitoring and chat views.
- Modal Backdrop: Optimized Light Mode backdrop with high-opacity blur for visual clarity.

### Fixed
- STALL Recovery: Resolved an issue where critical violations would not release the system after patching.
- Cursor States: Fixed missing `cursor-pointer` on multiple buttons and interactive rows.
- Contrast Issues: Improved text visibility in Light Mode across all Guru components.

---

Note: Versions prior to 1.0.0 were pre-release/beta versions. The official stable release starts with v1.0.0.

Legend:
- 🚀 Major release
- ✨ New feature
- 🐛 Bug fix
- 🔒 Security improvement
- 📚 Documentation
- ⚡ Performance
