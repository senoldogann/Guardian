# Release Checklist (Guardian)

Scope: macOS (ARM + Intel) and Windows release pipeline with public source + public distribution assets.

## 1) Version Sync

1. Confirm same version in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Add a matching entry in `CHANGELOG.md`.
3. Confirm release docs are updated:
   - `docs/MIGRATION_GUIDE_PHASE6.md` (lock/baseline migration)
   - `docs/reports/PHASE6_TOKEN_PERFORMANCE.md` (diff-context token impact)

## 2) Local Verification

1. Run frontend/app checks:
   - `npm run test`
   - `npm run build`
   - `(cd src-tauri && cargo check)`
2. Run website checks:
   - `(cd website && npm run build)`
3. Confirm no TypeScript/build failures before tagging.

## 3) macOS Signing (Local)

- `APPLE_SIGNING_IDENTITY`
- `APPLE_TEAM_ID`
- `APPLE_API_KEY` (Key ID)
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_P8` (base64 AuthKey_*.p8)
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## 4) Required GitHub / Signing Configuration

### Variables

- `PUBLIC_DIST_REPO` = `senoldogann/guardian-distribution`

### Secrets

- `PUBLIC_DIST_REPO_TOKEN` (PAT with write access to distribution repo releases)
- `SOURCE_REPO_TOKEN` (optional; used when default `GITHUB_TOKEN` is insufficient for source release actions)
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `APPLE_CERTIFICATE` (base64 `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_TEAM_ID`
- `APPLE_API_KEY` (Apple Key ID)
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_P8` (base64 `AuthKey_XXXX.p8`)
- `WINDOWS_CERTIFICATE` (optional)
- `WINDOWS_CERTIFICATE_PASSWORD` (optional)

## 5) Notarization Gate (macOS)

1. Release workflow must run with notarization enabled for:
   - `aarch64-apple-darwin`
   - `x86_64-apple-darwin`
2. Build must fail if any notarization preflight secret is missing.
3. Build must pass post-notarization validation:
   - `.app`: `xcrun stapler validate` + `spctl --assess --type execute`
   - `.dmg`: `xcrun stapler validate` (DMG ticket) + validate the `.app` inside the DMG (mount + `spctl --assess --type execute`)

Note: `spctl --assess --type open` can report `rejected (source=Insufficient Context)` for DMGs on recent macOS runners even when notarization/stapling succeeded.

## 6) Release Execution

1. Create tag: `vX.Y.Z`
2. Run local release script (multi-platform artifacts collected):
   ```bash
   scripts/release_local.sh vX.Y.Z /path/to/your/artifacts
   ```
3. Confirm source release includes:
   - macOS ARM DMG
   - macOS Intel DMG
   - Windows installer (`.msi` or `-setup.exe`)
   - updater metadata (`latest.json`)

## 7) Public Distribution Publish

Primary path: local release script (recommended).

Fallback (manual):

```bash
scripts/publish_distribution.sh vX.Y.Z senoldogann/Guardian senoldogann/guardian-distribution
```

Manual script validations include required assets, digest checks, `latest.json` rewrite, and distribution URL verification.

## 8) Post-Release Smoke Test

1. Download from website `/download` and verify recommended installer is correct.
2. On desktop app:
   - check `Settings > Updates` shows valid `Current` and `Latest`
   - run update check once
3. Validate `latest.json` in distribution release points to distribution repo assets only.
