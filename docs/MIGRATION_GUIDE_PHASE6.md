# Migration Guide - Phase 6

Scope: migrate existing workspaces to `guardian.lock` schema v1 and baseline `schema_version=2`.

Last updated: 2026-02-10

## What Changed

1. `guardian.lock` (workspace root)
   - New lock file managed by desktop watcher and CLI.
   - Pins `schema_version`, `workspace_id`, `rules_hash`, and `guardian_version`.
2. `.guardian/baseline.json` schema
   - Current required baseline format is `schema_version=2`.
   - Includes `finding_ids` and optional `findings` metadata.
3. CLI enforcement
   - `guardian-cli` supports `--lock-mode off|warn|strict`.
   - In strict mode, lock mismatch or parse failure fails the scan.
   - Baseline schema mismatch (`!=2`) fails scan.

## Who Needs This

- Teams with an older baseline file created before `schema_version=2`.
- Users enabling `guardian-cli --lock-mode strict`.
- Workspaces that do not yet contain `guardian.lock`.

## Desktop Migration (Recommended)

1. Open project in Guardian desktop app.
2. Run/trigger a scan once.
   - Watcher auto-creates or repairs `guardian.lock` in workspace root.
3. Recreate baseline from UI (`Set Baseline`).
   - This writes `.guardian/baseline.json` with `schema_version=2`.
4. Verify:
   - `guardian.lock` exists and contains `"schema_version": 1`
   - `.guardian/baseline.json` contains `"schema_version": 2`

## CLI Migration

Run once in warning mode to bootstrap lock and detect legacy data:

```bash
guardian-cli scan --root . --lock-mode warn
```

If baseline is old, recreate baseline via desktop app (or regenerate in your own pipeline), then switch to strict mode:

```bash
guardian-cli scan --root . --lock-mode strict
```

Optional checks:

```bash
jq '.schema_version' guardian.lock
jq '.schema_version' .guardian/baseline.json
```

## Compatibility Matrix

- `guardian.lock` missing:
  - Desktop: auto-sync creates it.
  - CLI warn/strict: created in warn, enforced in strict.
- `guardian.lock` schema mismatch:
  - Desktop: repaired on sync.
  - CLI strict: scan fails until lock is repaired.
- Baseline `schema_version=1`:
  - Desktop: create new baseline.
  - CLI: scan fails until baseline is regenerated with schema v2.

## Rollback Notes

- `guardian.lock` is deterministic and can be regenerated safely.
- Baseline should be recreated after major rule changes to avoid false "new" findings.
