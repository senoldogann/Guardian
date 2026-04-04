# Guardian Settings Personalization (Sprint 1-3)

Last Updated: 2026-03-16
Scope: Desktop app (`src` + `src-tauri`) personalization with governance-safe runtime behavior

## Purpose
Personalization lets users tune appearance and model guidance while preserving Guardian's core:
- AI-generated code governance before release
- policy-first + human-approval-first decisions
- local-first desktop + CLI operation

## Preference Domain
Preferences are versioned as `UserPreferencesV1` in app data:
- `schema_version`
- `theme_mode` (`dark|light|system`)
- `language` (`en|tr`)
- `light_palette` / `dark_palette` (`accent`, `panel`)
- `font_size_scale`
- `font_family`
- `model_custom_instructions`
- `scan_tuning`
  - `max_files_per_scan`
  - `max_batch_size_hint`
  - `token_budget_hint`
- runtime toggles:
  - `web_search_enabled`
  - `web_search_depth`
  - `auto_verify_enabled`
  - `guru_reply_sound_enabled`

Tauri commands:
- `get_user_preferences`
- `set_user_preferences`
- `reset_user_preferences`

## Safety and Governance Boundaries
- Numeric values are clamped to safe limits.
- Font family is restricted to an allow-list.
- `model_custom_instructions` is bounded and rejects unsafe override language.
- Prompt injection boundary markers are used when appending custom instructions.
- Scan tuning is policy-capped at runtime:
  - `max_batch_size_hint` is capped by scan profile and runtime config.
  - `max_files_per_scan` is capped by scan profile initial scan policy.
  - token budget can be capped by runtime policy/env.
- Settings UI explicitly shows policy caps and effective values when override occurs.

## Performance and Concurrency Hardening
- Preference updates are applied optimistically in UI, then persisted with a debounced save queue.
- Save queue is last-write-wins and generation-aware (prevents stale save overwrite).
- `user_preferences.json` is saved atomically.
- Last-known-good backup (`user_preferences.last_good.json`) is maintained.
- If primary preferences are malformed, loader falls back to last-known-good; if both fail, defaults are used safely.

## Migration Behavior
- Legacy local storage keys (theme/language/toggles) are migrated once.
- Migration marker: `guardian_user_preferences_migrated_v1`.
- Migration never touches provider keychain secrets.

## Reset and Recovery
Primary path:
1. Settings -> General -> Personalization
2. `Reset to Defaults`

Operational fallback:
1. Close app
2. Remove `user_preferences.json` and `user_preferences.last_good.json` from app data
3. Reopen app (safe defaults regenerate)

## Verification Gate
- `npm run -s lint`
- `npm run -s build`
- `npm run -s test`
- `npm run -s test:e2e`
- `cargo test --manifest-path src-tauri/Cargo.toml --quiet`
- `python3 scripts/verify_all.py`
