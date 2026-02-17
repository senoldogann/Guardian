# Local Releasing + Public Distribution

This repo (`senoldogann/Guardian`) does **not** run GitHub Actions. Releases are built locally and
uploaded manually to the public distribution repo (`senoldogann/guardian-distribution`).

Quick runbook:
- `docs/LOCAL_RELEASE_RUNBOOK.md`

Recommended (single command) flow:

```bash
cd guardian
scripts/release_all_local.sh
```

This script:
- auto bumps/syncs versions (default: patch)
- runs `npm run verify`
- builds the macOS bundle(s)
- collects artifacts into `./artifacts/vX.Y.Z`
- publishes the release to the public distribution repo
- updates distribution release notes from `CHANGELOG.md`

Optional:

```bash
scripts/release_all_local.sh --bump minor
scripts/release_all_local.sh --bump major
scripts/release_all_local.sh vX.Y.Z   # explicit tag/version
```

## Terminology

- **Source repo**: private/dev repo with code (`senoldogann/Guardian`)
- **Distribution repo**: public repo that hosts release assets for downloads/updates
  (`senoldogann/guardian-distribution`)

## Prerequisites

- macOS machine for macOS builds (required)
- `gh` CLI installed and authenticated with access to the distribution repo
- `jq` installed (`brew install jq`)
- Node + npm (this repo uses `npm ci`)
- Rust toolchain + targets as needed

## 1) Local Verification Gate

Run all critical checks locally before producing any release artifacts:

```bash
cd guardian
npm run verify
```

Optional security audit (recommended before every release):

```bash
cd guardian/src-tauri
cargo install cargo-audit --locked
cargo audit
```

## 2) Build Artifacts Locally

### macOS (Apple Silicon)

```bash
cd guardian
npm run tauri build -- --target aarch64-apple-darwin
```

### macOS (Intel)

```bash
cd guardian
npm run tauri build -- --target x86_64-apple-darwin
```

Notes:
- Code signing and notarization require Apple Developer credentials set up on your machine.
- If you cannot build Intel on Apple Silicon locally, build Intel on an Intel Mac or separate CI.

### Windows / Linux

Build on a Windows/Linux machine (recommended) and collect the installer output (MSI/EXE, etc).

## 3) Collect macOS artifacts

After building both macOS targets, gather artifacts and merge `latest.json`:

```bash
scripts/collect_macos_artifacts.sh v1.0.0 ./artifacts \
  ./src-tauri/target/aarch64-apple-darwin/release/bundle \
  ./src-tauri/target/x86_64-apple-darwin/release/bundle
```

## 4) Multi-Platform latest.json

If you build on multiple machines, each bundle will contain its own `latest.json`.
Merge them into a single file before publishing:

```bash
scripts/merge_latest_json.sh v1.0.0 /tmp/latest.json \
  /path/to/mac/latest.json \
  /path/to/win/latest.json \
  /path/to/linux/latest.json
```

## 5) Publish to Distribution Repo

After you have the built installers and `latest.json` updater metadata, upload everything to the
distribution repo release tag:

```bash
cd guardian
scripts/release_local.sh v1.0.0 /path/to/your/artifacts
```

The script will:
- validate required files exist
- rewrite `latest.json` URLs to point to the distribution repo
- create or update the distribution release
- upload assets (clobber/replace)
- generate and upload `releases.json` for the website changelog

## 6) Website Data Freshness

The website reads:
- `.../releases/latest/download/latest.json` for in-app updater metadata
- `.../releases/latest/download/releases.json` for changelog snapshots

Publishing a new distribution release automatically updates what the website shows without needing
to redeploy.
