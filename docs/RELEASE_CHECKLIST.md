# Release Checklist (Guardian)

**Scope:** macOS + Windows (Tauri v2)  
**Team ID:** `79DZ4AA4DW`

## 1. Versioning

1. Confirm version bump across:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
2. Update `CHANGELOG.md` and `RAPOR.md`.

## 2. Pre-Release Verification

1. Run full verification:
   - `npm run verify`
2. Confirm no blocking warnings.

## 3. macOS Signing + Notarization

**Required env vars (Tauri v2):**
- `APPLE_CERTIFICATE` (base64 `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY` (optional if cert name matches)
- `APPLE_TEAM_ID` = `79DZ4AA4DW`
- Notarization auth:
  - `APPLE_ID` + `APPLE_PASSWORD` **or**
  - `APPLE_API_KEY` + `APPLE_API_ISSUER` + `APPLE_API_KEY_PATH`

Tauri uses these variables for signing and notarization. citeturn0search0turn0search5

## 4. Windows Signing (Optional but Recommended)

If you have a Windows code signing certificate:
1. Prepare `certificateThumbprint`, `digestAlgorithm`, `timestampUrl`
2. Add them under `bundle.windows` in `src-tauri/tauri.conf.json`
3. In CI, import `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD`

Reference: Tauri Windows signing guide. citeturn0search1

## 5. Build Artifacts (Local)

1. `npm run tauri build`
2. Collect bundles from:
   - `src-tauri/target/release/bundle/`

## 6. Release / Deploy

1. Tag release (`vX.Y.Z`)
2. Push tag to trigger CI release workflow
3. Confirm GitHub Release assets uploaded

**CI Secrets (GitHub Actions):**
- `APPLE_CERTIFICATE` (base64 `.p12`)
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY` (optional)
- `APPLE_TEAM_ID`
- `APPLE_API_KEY` (Key ID)
- `APPLE_API_ISSUER`
- `APPLE_API_KEY_P8` (base64 `AuthKey_XXXX.p8`)
- `WINDOWS_CERTIFICATE` (base64 `.pfx`, optional)
- `WINDOWS_CERTIFICATE_PASSWORD` (optional)

Release workflow uses Tauri Action. citeturn0search4

## 7. Post-Release

1. Validate auto-update feed
2. Smoke test macOS + Windows installers
3. Confirm notarization status (macOS)
