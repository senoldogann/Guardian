# Local Releasing + Public Distribution

The primary Guardian release path is local build + publish to the public distribution repo
(`senoldogann/guardian-distribution`). GitHub Actions may still exist for CI or supporting
automation, but they are not required for the local publishing flow documented here.

Quick runbook:
- `docs/LOCAL_RELEASE_RUNBOOK.md`

Recommended (single command) flow:

```bash
cd Guardian
scripts/release_all_local.sh
```

This script:
- auto bumps/syncs versions (default: patch)
- syncs `guardian-vscode/package.json` and `guardian-vscode/package-lock.json`
- syncs `guardian-mcp/Cargo.toml`
- runs `npm run verify`
- runs Guardian release gate (`guardian-cli scan` + `guardian.policy.yaml`)
- builds the macOS bundle(s)
- collects artifacts into `./artifacts/vX.Y.Z`
- publishes the release to the public distribution repo
- updates distribution release notes from `CHANGELOG.md`

Optional:

```bash
scripts/release_all_local.sh --bump minor
scripts/release_all_local.sh --bump major
scripts/release_all_local.sh vX.Y.Z   # explicit tag/version
scripts/release_all_local.sh vX.Y.Z --gate-only  # verify + release gate only (no publish)
```

### Release Gate Inputs

`scripts/release_all_local.sh` writes a gate report to `.guardian/release_gate_report.json` and blocks publish when decision is `BLOCK_UNTIL_APPROVED`.
The gate scan is executed with `--no-baseline` so stale local baseline files do not block release decisions.

Optional environment variables for manual approval/override:

```bash
export GUARDIAN_RELEASE_APPROVER="release-manager"
export GUARDIAN_RELEASE_OVERRIDE_REASON="Emergency hotfix for production outage" # optional
scripts/release_all_local.sh
```

## Terminology

- **Source repo**: public code repo (`senoldogann/Guardian`)
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
cd Guardian
npm run verify
```

`npm run verify` now covers:
- root app format, lint, tests, coverage gate, and build
- `guardian-vscode` install + `npm run validate`
- `website` install + lint + copy gate + tests + coverage + build
- Rust workspace `fmt`, `clippy`, `check`, and `test`
- critical npm audits for root, website, and `guardian-vscode`
- `cargo audit` (auto-installed if missing)

## 2) Build Artifacts Locally

### macOS (Apple Silicon)

```bash
cd Guardian
npm run tauri build -- --target aarch64-apple-darwin
```

### macOS (Intel)

```bash
cd Guardian
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
scripts/collect_macos_artifacts.sh vX.Y.Z ./artifacts \
  ./src-tauri/target/aarch64-apple-darwin/release/bundle \
  ./src-tauri/target/x86_64-apple-darwin/release/bundle
```

## 4) Multi-Platform latest.json

If you build on multiple machines, each bundle will contain its own `latest.json`.
Merge them into a single file before publishing:

```bash
scripts/merge_latest_json.sh vX.Y.Z /tmp/latest.json \
  /path/to/mac/latest.json \
  /path/to/win/latest.json \
  /path/to/linux/latest.json
```

## 5) Publish to Distribution Repo

After you have the built installers and `latest.json` updater metadata, upload everything to the
distribution repo release tag:

```bash
cd Guardian
scripts/release_local.sh vX.Y.Z /path/to/your/artifacts
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

## 7) Publish IDE Tools

After the primary distribution release exists for `vX.Y.Z`, run the dedicated GitHub Actions workflow:

- Workflow: `.github/workflows/publish-ide-tools.yml`
- Inputs:
  - `tag`: the same release tag, for example `v1.3.0`
  - `publish_marketplace`: keep `true` for public Marketplace publish
  - `dist_repo`: normally `senoldogann/guardian-distribution`

This workflow:
- validates `guardian-vscode/package.json` and `guardian-mcp/Cargo.toml` against the tag
- packages `guardian-vscode` as `.vsix`
- builds prebuilt `guardian-mcp` archives for Linux, macOS, and Windows
- uploads the `.vsix`, MCP archives, and `checksums.txt` to the existing distribution release
- publishes the `.vsix` to the VS Code Marketplace

Required one-time setup:

- `guardian-vscode/package.json` publisher must match your real Marketplace publisher ID
- GitHub secret `VSCE_PAT` must exist
- `VSCE_PAT` must be created with Azure DevOps `Marketplace (Manage)` scope and `All accessible organizations`
- `PUBLIC_DIST_REPO_TOKEN` must already be configured for the distribution repo upload steps

Recommended release order:

1. Run the normal Guardian release flow first so the distribution release tag already exists.
2. Dispatch `publish-ide-tools.yml` with the same tag.
3. Verify the extension appears in Marketplace and the distribution release contains the MCP archives plus `.vsix`.
