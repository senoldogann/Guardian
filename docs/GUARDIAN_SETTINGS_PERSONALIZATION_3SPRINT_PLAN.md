# Guardian Settings Personalization - 3 Sprint Implementation Plan

Last Updated: 2026-03-16
Owner: Guardian Team
Workspace: `/Users/dogan/Desktop/guardian`
Scope: Desktop + CLI governance-focused personalization (local-first)

## Working Rules
- [x] Phase/sprint order is strictly sequential.
- [x] Every sprint includes Goal, Tasks, Entry Gate, Test Gate, Exit Gate, Completion Log.
- [x] All completed items are marked with `[x]`.
- [x] Each sprint has Unit + Integration + E2E + `python3 scripts/verify_all.py` quality gates.
- [x] No commit/push without explicit user approval.
- [x] Changes must preserve Guardian positioning: AI-generated code governance before release.

## Product Guardrails (Non-Negotiable)
- [x] Customization must not turn Guardian into a general chatbot.
- [x] Release decision flow remains policy-first and human-approval-first.
- [x] User custom model instructions are bounded, validated, and safety-scanned.
- [x] Scan volume customization (file count, batch behavior) has safe hard caps and warnings.
- [x] Key and credential handling remains keychain/local secure storage based.

## Research Baseline (Official Sources)
- [x] React concurrent input UX references reviewed (`startTransition`, `useDeferredValue`).
- [x] CSS theming references reviewed (custom properties, `prefers-color-scheme`).
- [x] Tauri persistent settings pattern reviewed (Store plugin / app-local persistence).
- [x] OWASP GenAI/LLM risk references reviewed (prompt injection, sensitive data exposure, unsafe output handling).

Reference links:
- https://react.dev/reference/react/startTransition
- https://react.dev/reference/react/useDeferredValue
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascading_variables/Using_CSS_custom_properties
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
- https://v2.tauri.app/plugin/store/
- https://genai.owasp.org/llm-top-10/

---

## Sprint 1 - Preferences Foundation + Safe Config Domain (Status: COMPLETED)

### Goal
Introduce a stable, versioned user personalization config domain without breaking existing behavior.

### Entry Gate
- [x] Current settings flow baseline captured (`useSettings`, `SettingsModal`, `App.css`, Tauri config commands).
- [x] Existing persistence points mapped (`localStorage`, app data JSON files, keychain).
- [x] Migration strategy approved for old keys (`guardian_theme`, language, existing toggles).

### Tasks
- [x] Define `UserPreferencesV1` schema (frontend + backend contract):
  - `theme_mode` (`dark|light|system`)
  - `light_palette`, `dark_palette` token subsets
  - `font_size_scale`, `font_family`
  - `model_custom_instructions` (bounded text, max length)
  - `scan_tuning` (`max_files_per_scan`, `max_batch_size_hint`, `token_budget_hint`)
- [x] Add Tauri commands:
  - `get_user_preferences()`
  - `set_user_preferences(payload)`
  - `reset_user_preferences()`
- [x] Persist preferences under app data (`user_preferences.json`) with schema versioning.
- [x] Add frontend preferences state in `useSettings` with migration from legacy local keys.
- [x] Add validation and sanitization:
  - strict numeric limits
  - allow-listed font family values
  - blocked-pattern checks for custom instructions
- [x] Add EN/TR i18n keys for all new settings labels, helper texts, warnings, and errors.
- [x] Add docs draft:
  - settings personalization behavior
  - safety boundaries
  - rollback/reset instructions

### Test Gate
- [x] Unit:
  - preferences schema parse/validate
  - migration from legacy storage keys
  - instruction sanitization and length limits
- [x] Integration:
  - Desktop settings save/load round-trip via Tauri
  - Existing provider/web/embedding settings unaffected by migration
- [x] E2E:
  - Open settings -> change preferences -> app reload -> preferences restored
  - Reset to defaults returns canonical values
- [x] `python3 scripts/verify_all.py`

### Exit Gate
- [x] No regression in existing settings tabs.
- [x] Preferences survive restart and keep UI stable in both themes.
- [x] Localization parity complete for EN/TR (no missing key fallback strings).

### Completion Log (Fill at Sprint End)
- Completion Date: 2026-03-16
- Owner: Guardian Team
- Completed Items:
  - Added versioned desktop preferences domain + validation in Tauri.
  - Added `get_user_preferences`, `set_user_preferences`, `reset_user_preferences` commands.
  - Added frontend `useSettings` preferences state, one-time legacy migration, and runtime application for current toggles.
  - Added theme/font runtime application via CSS variables and `system` theme sync in `App.tsx`.
  - Completed EN/TR localization for personalization labels + preference error states.
  - Added personalization operator doc with safety and rollback guidance.
  - Added E2E coverage for personalization controls in Settings.
- Evidence (files/tests):
  - `src-tauri/src/user_preferences.rs`
  - `src-tauri/src/lib.rs`
  - `src/hooks/useSettings.ts`
  - `src/components/SettingsModal.tsx`
  - `src/App.tsx`
  - `src/i18n/index.tsx`
  - `src/hooks/__tests__/useSettings.test.ts`
  - `tests/e2e/app.spec.ts`
  - `docs/SETTINGS_PERSONALIZATION_GUIDE.md`
  - `cargo test --manifest-path src-tauri/Cargo.toml user_preferences -- --nocapture`
  - `cargo test --manifest-path src-tauri/Cargo.toml --quiet`
  - `npm run -s test`
  - `npm run -s test:e2e`
  - `npm run -s lint`
  - `npm run -s build`
  - `python3 scripts/verify_all.py`
- Blockers:
  - None for Sprint 1 scope.
- Follow-up Actions:
  - Start Sprint 2 UI depth: palette editor + bounded model behavior controls + scan tuning runtime mapping.

---

## Sprint 2 - Advanced Theme + Typography + Model Behavior Controls (Status: COMPLETED)

### Goal
Ship user-facing personalization UX for light/dark tokens, typography, and bounded model behavior customization.

### Entry Gate
- [x] Sprint 1 preferences schema and persistence merged locally and verified.
- [x] Accessibility baseline for contrast and readable typography defined.
- [x] UX copy reviewed for governance-focused messaging.

### Tasks
- [x] Build Settings "Appearance" section:
  - dark and light palette controls (safe token subset only)
  - live preview panel
  - one-click restore defaults (per mode + global)
- [x] Build Typography controls:
  - font size presets (e.g., 90/100/110/120)
  - font family allow-list (3-5 curated families)
  - dynamic application via CSS variables
- [x] Build "Model Behavior" controls:
  - custom instruction textarea (with strict helper text and warning banner)
  - character/token limit + validation
  - optional scoped toggles (e.g., explain-first mode, terse mode)
- [x] Build "Scan Tuning" controls (governed):
  - max files per scan
  - batch intensity hint
  - warning text for latency/cost/false-positive tradeoff
  - enforce hard caps to protect runtime stability
- [x] Wire preferences into runtime:
  - model instruction suffix/prefix merged safely in AI request builder
  - scan tuning values mapped to existing watcher constraints (CLI keeps explicit flags/policy controls)
- [x] Ensure all new UI strings are complete in EN/TR.

### Test Gate
- [x] Unit:
  - CSS variable mapping logic for appearance/typography
  - instruction merge behavior and guardrail enforcement
  - scan tuning clamp logic
- [x] Integration:
  - Settings UI -> runtime config reflection
  - model request payload includes safe custom instructions
- [x] E2E:
  - theme + font adjustments reflected across Monitor/Guru/Reviews
  - custom model instruction saved and applied
  - unsafe instruction patterns are rejected with clear UI feedback
- [x] `python3 scripts/verify_all.py`

### Exit Gate
- [x] Theme and typography customization works in both light and dark mode.
- [x] Runtime remains stable with worst-case valid scan tuning values.
- [x] Model customization does not bypass governance or release decision flow.

### Completion Log (Fill at Sprint End)
- Completion Date: 2026-03-16
- Owner: Guardian Team
- Completed Items:
  - Added Appearance controls with guarded light/dark palette editing and live preview.
  - Added per-mode palette restore actions plus existing global reset flow.
  - Extended model behavior controls with bounded preset toggles (Explain-first / Terse).
  - Added explicit scan tuning tradeoff guidance and applied tuning to watcher batch/token behavior.
  - Injected model custom instruction into AI prompts using boundary-enforced sectioning.
  - Added EN/TR localization for new personalization surface.
- Evidence (files/tests):
  - `src/components/SettingsModal.tsx`
  - `src/App.tsx`
  - `src/hooks/useSettings.ts`
  - `src/i18n/index.tsx`
  - `src-tauri/src/ai_client.rs`
  - `src-tauri/src/watcher.rs`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/skills/orchestrator.rs`
  - `src/hooks/__tests__/useSettings.test.ts`
  - `tests/e2e/app.spec.ts`
  - `npm run -s build`
  - `npm run -s lint`
  - `npm run -s test`
  - `npm run -s test:e2e`
  - `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
  - `cargo test --manifest-path src-tauri/Cargo.toml ai_client --quiet`
  - `cargo test --manifest-path src-tauri/Cargo.toml user_preferences --quiet`
  - `python3 scripts/verify_all.py`
- Blockers:
  - None in Sprint 2 scope.
- Follow-up Actions:
  - Sprint 3: race-safe preference write strategy, policy override messaging, and long-session stability validation.

---

## Sprint 3 - Performance, Security Hardening, and Release Readiness (Status: PLANNED)

### Goal
Harden personalization for production quality: performance, security, concurrency safety, and operator confidence.

### Entry Gate
- [ ] Sprint 2 features are functionally complete.
- [ ] Known UX and performance hotspots listed.
- [ ] Security review checklist prepared for custom instruction and scan tuning paths.

### Tasks
- [ ] Performance hardening:
  - avoid UI jank for live theme/font updates
  - use React concurrent patterns where needed (`startTransition`, `useDeferredValue`)
  - reduce unnecessary re-renders in Settings modal
- [ ] Security hardening:
  - instruction redaction where needed in logs/output artifacts
  - add explicit prompt-boundary markers for custom instruction injection point
  - ensure no key/plain secrets leak through settings logs/toasts
- [ ] Concurrency hardening:
  - race-safe save flow for rapid setting changes
  - atomic write semantics for `user_preferences.json`
  - fallback to last-known-good config on parse failure
- [ ] Governance safety hardening:
  - if custom settings conflict with policy, policy remains authoritative
  - clear UI messaging when policy overrides user preference
- [ ] Documentation and adoption:
  - update docs/get-started + FAQ + settings sections
  - add "safe personalization" guidance for small teams
- [ ] GA readiness checklist:
  - release notes content template
  - rollback plan and known limitations

### Test Gate
- [ ] Unit:
  - atomic save/load + corruption recovery tests
  - policy-overrides-preference behavior tests
- [ ] Integration:
  - concurrent settings updates under load
  - watcher stability under tuned scan settings
- [ ] E2E:
  - long-running session: change settings while monitoring active
  - restart/reopen app: settings and behavior remain consistent
  - governance decision outputs remain valid and localized
- [ ] `python3 scripts/verify_all.py`

### Exit Gate
- [ ] No high-severity regression in performance, security, or governance behavior.
- [ ] Desktop UX is stable for both EN/TR and light/dark across all core screens.
- [ ] Release candidate checklist is green.

### Completion Log (Fill at Sprint End)
- Completion Date:
- Owner:
- Completed Items:
- Evidence (files/tests):
- Blockers:
- Follow-up Actions:

---

## Deferred Backlog (Post-Sprint Candidate)
- [ ] Google Sign-In evaluation (only if it supports product strategy and privacy model).
- [ ] Theme preset marketplace/export-import (team-shared style presets).
- [ ] Advanced role-based settings policy for team-managed defaults.
