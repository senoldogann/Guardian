# Changelog

All notable changes to the Guardian V4 project will be documented in this file.

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
