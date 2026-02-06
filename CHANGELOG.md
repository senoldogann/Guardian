# Changelog

All notable changes to the Guardian V4 project will be documented in this file.

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
- **llms.txt**: Structured metadata for AI agent Discovery.

### Changed
- **Global Scaling**: Increased global font scaling to 110% for improved accessibility.
- **Theming**: Synchronized Guru colors with the emerald Guardian theme.
- **Header Standardization**: Standardized all header heights to `h-14` across monitoring and chat views.
- **Modal Backdrop**: Optimized Light Mode backdrop with high-opacity blur for visual clarity.

### Fixed
- **STALL Recovery**: Resolved an issue where critical violations would not release the system after patching.
- **Cursor States**: Fixed missing `cursor-pointer` on multiple buttons and interactive rows.
- **Contrast Issues**: Improved text visibility in Light Mode across all Guru components.
