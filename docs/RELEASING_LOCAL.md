# Local Releasing + Public Distribution

This repo (`senoldogann/Guardian`) does **not** run GitHub Actions. Releases are built locally and
uploaded manually to the public distribution repo (`senoldogann/guardian-distribution`).

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

## 3) Publish to Distribution Repo

After you have the built installers and `latest.json` updater metadata, upload everything to the
distribution repo release tag:

```bash
cd guardian
scripts/publish_distribution_local.sh v0.2.7 /path/to/your/artifacts
```

The script will:
- validate required files exist
- rewrite `latest.json` URLs to point to the distribution repo
- create or update the distribution release
- upload assets (clobber/replace)
- generate and upload `releases.json` for the website changelog

## 4) Website Data Freshness

The website reads:
- `.../releases/latest/download/latest.json` for in-app updater metadata
- `.../releases/latest/download/releases.json` for changelog snapshots

Publishing a new distribution release automatically updates what the website shows without needing
to redeploy.

