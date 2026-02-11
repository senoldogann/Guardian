# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-02-10 🧱 STABILIZATION

### Fixed
- **E2E Release Gate**: Fixed Playwright strict-mode selector ambiguity and aligned filter search test with the new UI.
- **Ollama Offline UX**: Ollama provider no longer requires an API key to launch; requests omit `Authorization` header when no key is configured.
- **Batch Audit Safety**: Normalized/whitelisted `file_path` for batch critiques to prevent ghost findings and state inconsistencies.
- **Local Distribution Scripts**: Release tooling now accepts `latest.json.version` with or without the leading `v` prefix.

### Changed
- **AI Context + Reviews UX**: Replaced the long accordion layouts with an inspector split view (list/filters on the left, preview/actions on the right) to reduce scroll fatigue and speed up triage.
- **Settings (Updates) About Links**: Added "Built by Senol Dogan" and quick links to the website + contact page.
- **Local Release Flow**: Added a one-command local release script (`scripts/release_all_local.sh`) to run verify, build, collect artifacts, publish to distribution, and sync release notes from `CHANGELOG.md`.
- **Updater Artifact Generation**: Re-enabled Tauri updater artifact generation in `tauri.conf.json` and added `latest.json` fallback generation from updater `.tar.gz + .sig` when needed.

## [1.1.1] - 2026-02-10 🐛 HOTFIX

### Fixed
- **Updater Signature**: Fixed "Invalid encoding in minisign data" error by correctly signing the DMG file
- **Update Popup UI**: 
  - Fixed background color in dark mode (changed from gradient to solid accent color)
  - Fixed text colors for better visibility
  - Fixed "Dismiss" button contrast in dark mode
- **Settings Updates Tab**: 
  - Removed inline changelog text
  - Added "View changelog on website" link pointing to www.guardianide.com

---

## [1.1.0] - 2026-02-10 🚀 PHASE 6 COMPLETE

### Added
- **Phase 6.1 Semantic Index (Desktop)**:
  - Local semantic vector persistence in `.guardian/memory.db` (`semantic_vectors` table).
  - Embedding strategy with provider routing:
    - OpenAI `text-embedding-3-small` (default),
    - Ollama `nomic-embed-text` (optional),
    - deterministic local hash fallback (offline/error).
  - Semantic recall flow for new critical findings in watcher pipeline.
- **Guru Semantic Context**:
  - Query-time semantic similarity retrieval for prompts like "benzer/similar/semantic/critical pattern".
  - Retrieved matches are appended into Guru context as `Semantic Similarity Matches`.
- **Phase 5 Review Queue**:
  - Append-only fix proposal queue (`.guardian-proposals/fix_proposals.jsonl`).
  - Review status transitions (`review_requested`, `rejected`, `applied`) with Tauri commands and desktop UI integration.

### Changed
- **Phase 6.2 Diff-Focused AI Context**:
  - Watcher prompt payload now prioritizes diff hunks over full snapshot context when prior snapshot exists.
  - Added hunk limits and truncation controls for consistent token usage.
- **Phase 6.1.1 sqlite-vec KNN path**:
  - Added native sqlite-vec index path for 256-d semantic embeddings (`semantic_vectors_ann` via `vec0`).
  - Semantic retrieval now uses sqlite-vec KNN-first search with automatic cosine fallback on incompatibility/error.
- **Phase 6.3 guardian.lock**:
  - Introduced `guardian.lock` schema v1 for rules/workspace/version pinning.
  - Desktop auto-syncs lock state; CLI supports `--lock` and `--lock-mode off|warn|strict`.
- **Phase 4 Protocol Stabilization**:
  - `.guardian/critiques.json` + `.guardian/critiques.md` paths normalized to relative paths.
  - `agent_queue.jsonl` payloads minimized and archive rotation stabilized (size + retention policy).

### Documentation
- Added `docs/MIGRATION_GUIDE_PHASE6.md` for `guardian.lock` v1 and baseline `schema_version=2` migration.
- Added `docs/reports/PHASE6_TOKEN_PERFORMANCE.md` with measured 6.2 token reduction benchmark.

## [1.0.0] - 2026-02-08 🚀 MAJOR RELEASE

### 🎉 Production Ready - v1.0.0

#### Infrastructure & CI/CD
- **Self-Hosted CI/CD Pipeline**: Complete migration from GitHub-hosted to self-hosted runners
  - Zero GitHub Actions minutes consumption
  - Automated runner setup script (`scripts/setup-runner.sh`)
  - Cross-platform support (macOS arm64/x64, Linux x64)
  - Comprehensive workflow: test → build → security scan → deploy
  - Tauri desktop builds on local hardware
  - Website static generation with environment validation
- **CI/CD Workflow v1**: `.github/workflows/ci-cd-v1.yml`
  - Parallel job execution
  - Artifact retention policies
  - Security scanning integrated
  - E2E testing on PR

#### Version Updates
- **Global Version Bump**: 0.2.8 → 1.0.0
  - `package.json`: v1.0.0
  - `src-tauri/tauri.conf.json`: v1.0.0
  - `website/package.json`: v1.0.0
  - Tauri window title: "Guardian v1.0.0"

#### Security Enhancements
- **Content Security Policy (CSP)**: Hardened security headers
- **Automated Security Scanning**:
  - NPM audit on every push
  - Cargo audit for Rust dependencies
  - Configurable audit level (moderate+)
- **GitHub Token Security**: Improved handling and validation

#### Documentation
- **README v1.0.0**: Complete overhaul with CI/CD instructions
- **CHANGELOG**: Restructured with migration guide
- **Runner Setup Guide**: Automated script with prerequisites check

#### Technical Improvements
- **Build Optimization**: Parallel builds for desktop and website
- **Test Coverage Pipeline**: Automated coverage reporting
- **Artifact Management**: Structured artifact naming with version
- **Environment Validation**: Pre-build env var checks

---

## Migration Guide: 0.2.8 → 1.0.0

### For Developers

1. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

2. **Update dependencies**:
   ```bash
   npm install
   cd website && npm install
   cd ..
   ```

3. **Setup CI/CD runner** (recommended):
   ```bash
   bash scripts/setup-runner.sh
   ```
   Then follow the prompts to configure and start the runner.

4. **Verify everything works**:
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
- **Cargo Audit Fix**: Updated `time` to `0.3.47` to address `RUSTSEC-2026-0009`.
- **DMG Validation Hardening**: Improved macOS DMG notarization validation and re-upload flow in the release pipeline.
- **macOS Signing Auto-detect**: Release workflow no longer requires `APPLE_SIGNING_IDENTITY` (auto-detects the imported Developer ID cert).

### Website
- **Build/Lint Stability**: Added ESLint flat config and removed deprecated `next lint` usage for CI-safe lint runs.
- **Image Optimization**: Switched legacy `<img>` usage to `next/image` to keep Next.js warnings clean.

## [0.2.7] - 2026-02-06

### Security & CI
- **Cargo Audit Fix**: Updated `time` to `0.3.47` to address `RUSTSEC-2026-0009`.
- **DMG Validation Hardening**: Improved macOS DMG notarization validation and re-upload flow in the release pipeline.
- **macOS Signing Auto-detect**: Release workflow no longer requires `APPLE_SIGNING_IDENTITY` (auto-detects the imported Developer ID cert).

### Website
- **Build/Lint Stability**: Added ESLint flat config and removed deprecated `next lint` usage for CI-safe lint runs.
- **Image Optimization**: Switched legacy `<img>` usage to `next/image` to keep Next.js warnings clean.

## [0.2.6] - 2026-02-06

### Release & Distribution
- **macOS Notarization Re-enabled**: Release workflow now enforces notarization preflight checks and notarized artifact validation for both Apple Silicon and Intel targets.
- **Public Distribution Validation**: Added stronger distribution publication checks for required assets, digests, updater metadata, and URL rewrites.
- **PUBLIC_DIST_REPO Fallback**: Workflow now accepts distribution repo from Actions Variable first, then Secret fallback.

### Auth & UX Stability
- **Deterministic Auth State**: Added explicit auth states (`signed_out`, `device_pending`, `verifying`, `signed_in_verified`, `signed_in_offline`).
- **Launch Blocking Reason**: `Launch Guardian` now exposes precise in-UI reasons when disabled.
- **Logout/Login Flow Cleanup**: Cleans stale flow state and pending login data before re-auth attempts.

### Updates Panel
- **Current/Latest Fallbacks**: Update section now preserves `current_version`, tracks `last_checked_at`, and shows meaningful unavailable status on network/updater failures.
- **Rust Updater Result Hardening**: `check_app_update` returns structured unavailable responses instead of empty/unknown UI states.

### Website
- **Premium Home Redesign**: Rebuilt homepage with modern editorial hero, trust signals, feature cards, screenshot gallery, and video demos.
- **Media Integration**: Added desktop screenshots and converted demo recordings for web playback (desktop + mobile variants).
- **Download UX Upgrade**: Added manual platform override while preserving hydration-safe auto-detection and checksum utilities.
- **Mobile-first Styling**: Completed responsive layout rules for homepage, media sections, and download controls.

## [0.2.5] - 2026-02-05

### Distribution & Updates
- **Private Source, Public Distribution**: Release pipeline now supports publishing signed assets from private source repo to public distribution repo.
- **Updater Endpoint Migration**: Desktop updater endpoint switched to `senoldogann/guardian-distribution` so end users can receive updates even when source repo is private.
- **Release Mirror Job**: Added `publish_distribution` job in release workflow to copy release assets and notes automatically.

### Website
- **Next.js Public Site**: Added `website/` with production-ready pages:
  - `/download` (OS-aware installer selection)
  - `/changelog` (GitHub Releases-synced)
  - `/docs` (public operational documentation)
- **Release-driven APIs**: Added `/api/releases` and `/api/releases/latest` endpoints with caching for automatic content refresh.

### Security & Stability
- **React + Rust Build Fixes**: Resolved `react-window` compatibility issues and completed Rust `secrecy` migration fixes.
- **Validation Hardening**: Stabilized update/status handling and protected UI paths against missing release data.

### Documentation
- **Operational Guide**: Added private/public deployment runbook in `docs/PRIVATE_DISTRIBUTION_SETUP.md`.
- **README Updates**: Documented distribution architecture, required GitHub secrets/variables, and website integration.

## [0.2.4] - 2026-02-05

### Security
- **CSP Hardening**: Added Anthropic, Tavily, GitHub Models, and Google AI endpoints to Content Security Policy.
- **Error Logging**: Replaced silent catch blocks with proper error logging following SPAP v2.2 guidelines.

### Performance
- **Virtualization**: App.tsx and ChatView.tsx already use react-window for large list rendering.
- **Dynamic Import**: jsPDF uses dynamic import to reduce initial bundle size.
- **useMemo Optimization**: filteredLogs and stats already use useMemo for performance.

### Testing
- **StallOverlay Tests**: Added comprehensive test suite for StallOverlay component (8 test cases).
- **Coverage Threshold**: Maintained 80% coverage threshold in vitest.config.ts.

### Infrastructure
- **Version Sync**: Synchronized version to 0.2.4 across package.json, Cargo.toml, and tauri.conf.json.
- **Docker Ready**: Dockerfile, docker-compose.yml, and .dockerignore are production-ready.
- **CI/CD Multi-platform**: GitHub Actions workflows support Linux, Windows, and macOS.

### Code Quality
- **Type Safety**: Centralized types in /types/index.ts with ITauriAPI interface.
- **Constants**: Magic strings consolidated in /constants/index.ts.
- **Hook Architecture**: useKeyManagement, useLocalStorage, useToast hooks implemented.

## [4.0.3] - 2026-02-05

### Added
- **Watcher Config Env**: Watcher batch sizing, truncation, and retry parameters are now configurable via env in `config.rs`.
- **UI Refactor**: Split `App.tsx` into focused components + hooks for auth and settings.
- **E2E Coverage**: Expanded Playwright suite to cover settings, navigation, monitoring, and responsive checks.

### Changed
- **Watcher Limits**: Removed hardcoded limits in `watcher.rs` in favor of config getters.
- **Mutex Poison Logging**: Added explicit error logging on poisoned debouncer lock.

## [4.0.2] - 2026-02-05

### Fixed
- **Auth Session Resume**: Auto-refreshes cached GitHub sessions on launch and allows offline-verified sessions to start monitoring without forced re-login.

## [4.0.1] - 2026-02-04

### Added
- **Settings Tabs**: Split settings into Provider, Web Search, Updates, and Export tabs for clarity.
- **Tavily Web Search Toggle**: In-chat web search toggle with `/web` prefix override and heuristic auto-use.
- **Chat Controls**: Clear-chat confirmation modal and persistent keychain-backed Tavily key storage.
- **Project Map Enhancements**: Default-collapsed tree, folder child-count badges, and clickable nodes.
- **Verification Script**: `npm run verify` to run unit, E2E, build, and Rust checks.
- **Export PDF Tests**: Added unit tests for `exportAuditToPdf`.

### Changed
- **Provider Setup Flow**: API key entry moved into Provider settings with stricter validation.
- **Key Handling**: Tavily keys now stored only from UI (no `.env` fallback).
- **E2E Base URL**: Playwright now uses `localhost:5173` to avoid Tauri port conflicts.
- **Icons**: Normalized PNG icon assets to valid RGBA images for Tauri builds.

### Fixed
- **ChatView Stability**: Guarded against invalid history payloads and improved empty-state behavior.
- **Theme Toggle E2E**: Stabilized E2E flow by opening Settings before toggling theme.
- **Tauri Test Harness**: Made `__TAURI_INTERNALS__` configurable for clean test isolation.

## [4.0.0] - 2026-01-26

### Added
- **Guru Guide**: Interactive, premium usage manual with Glassmorphism and Aurora UI styles.
- **English Localization**: Universal translation of the Guru interface for global standards.
- **Hover Micro-animations**: Enhanced transition states for all interactive cards and options.
- **AI Discovery**: Structured metadata file for AI agent discovery protocols.

### Changed
- **Global Scaling**: Increased global font scaling to 110% for improved accessibility.
- **Theming**: Synchronized Guru colors with the emerald Guardian theme.
- **Header Standardization**: Standardized all header heights to `h-14` across monitoring and chat views.
- **Modal Backdrop**: Optimized Light Mode backdrop with high-opacity blur for visual clarity.

### Fixed
- **STALL Recovery**: Resolved an issue where critical violations would not release the system after patching.
- **Cursor States**: Fixed missing `cursor-pointer` on multiple buttons and interactive rows.
- **Contrast Issues**: Improved text visibility in Light Mode across all Guru components.

---

**Note**: Versions prior to 1.0.0 were pre-release/beta versions. The official stable release starts with v1.0.0.

**Legend**:
- 🚀 Major release
- ✨ New feature
- 🐛 Bug fix
- 🔒 Security improvement
- 📚 Documentation
- ⚡ Performance
