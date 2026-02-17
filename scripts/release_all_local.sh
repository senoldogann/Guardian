#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/release_all_local.sh [tag] [--bump patch|minor|major|<semver>] [--dist-repo owner/repo] [--mac-both] [--windows-installer /path/to/file]

What it does:
  0) Auto-syncs version files (if tag is omitted or out-of-sync)
  1) Runs the local verification gate (npm run verify)
  2) Builds Tauri bundles (macOS)
  3) Collects artifacts into ./artifacts/<tag>/
  4) Publishes/updates the release in the public distribution repo
  5) Updates distribution release notes from CHANGELOG.md

Notes:
  - This script intentionally prompts for secrets (passwords) instead of storing them anywhere.
  - For notarization, you may need to export Apple env vars before running (see docs/LOCAL_RELEASE_RUNBOOK.md).

Examples:
  scripts/release_all_local.sh v1.2.0
  scripts/release_all_local.sh            # auto patch bump + release
  scripts/release_all_local.sh --bump minor
  scripts/release_all_local.sh v1.2.0 --mac-both
  scripts/release_all_local.sh v1.2.0 --dist-repo senoldogann/guardian-distribution
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

TAG=""
if [[ $# -gt 0 && "${1:-}" != --* ]]; then
  TAG="$1"
  shift
fi

DIST_REPO="senoldogann/guardian-distribution"
MAC_BOTH="0"
WINDOWS_INSTALLER=""
BUMP_SPEC=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist-repo)
      DIST_REPO="${2:-}"
      shift 2
      ;;
    --mac-both)
      MAC_BOTH="1"
      shift 1
      ;;
    --windows-installer)
      WINDOWS_INSTALLER="${2:-}"
      shift 2
      ;;
    --bump)
      BUMP_SPEC="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -n "$TAG" && -n "$BUMP_SPEC" ]]; then
  echo "Error: use either explicit <tag> or --bump, not both."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is not installed."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login"
  exit 1
fi

if ! command -v rustup >/dev/null 2>&1; then
  echo "Error: rustup is not installed."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed."
  exit 1
fi

if [[ -z "$TAG" ]]; then
  SPEC="${BUMP_SPEC:-patch}"
  echo "No tag provided. Auto-bumping version: $SPEC"
  "$SCRIPT_DIR/bump_version.sh" "$SPEC"
  VERSION="$(node -p "require('./package.json').version")"
  TAG="v$VERSION"
else
  VERSION="${TAG#v}"
fi

PKG_VERSION="$(node -p "require('./package.json').version")"
TAURI_VERSION="$(jq -r '.version // ""' src-tauri/tauri.conf.json)"
CARGO_VERSION="$(grep -E '^version[[:space:]]*=[[:space:]]*"' src-tauri/Cargo.toml | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')"

if [[ "$PKG_VERSION" != "$VERSION" || "$TAURI_VERSION" != "$VERSION" || "$CARGO_VERSION" != "$VERSION" ]]; then
  echo "Version mismatch detected. Syncing all version files to '$VERSION' ..."
  "$SCRIPT_DIR/bump_version.sh" "$VERSION"
  PKG_VERSION="$(node -p "require('./package.json').version")"
  TAURI_VERSION="$(jq -r '.version // ""' src-tauri/tauri.conf.json)"
  CARGO_VERSION="$(grep -E '^version[[:space:]]*=[[:space:]]*"' src-tauri/Cargo.toml | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')"
fi

if [[ "$PKG_VERSION" != "$VERSION" || "$TAURI_VERSION" != "$VERSION" || "$CARGO_VERSION" != "$VERSION" ]]; then
  echo "Error: version sync failed."
  echo "  package.json:          $PKG_VERSION"
  echo "  src-tauri/Cargo.toml:  $CARGO_VERSION"
  echo "  src-tauri/tauri.conf:  $TAURI_VERSION"
  echo "  expected:              $VERSION"
  exit 1
fi

echo "Running verification gate (npm run verify) ..."
npm run verify

KEY_PATH="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/guardian.key}"
if [[ ! -f "$KEY_PATH" ]]; then
  echo "Error: Tauri signing key not found: $KEY_PATH"
  exit 1
fi

export TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"

if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
  echo -n "Enter password for TAURI signing key ($KEY_PATH): "
  read -r -s TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  echo ""
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
fi

ARTIFACTS_DIR="$ROOT_DIR/artifacts/$TAG"
mkdir -p "$ARTIFACTS_DIR"

build_target() {
  local target="$1"
  echo "Building Tauri bundle for target: $target"
  npm run tauri build -- --target "$target"
}

copy_bundle_artifacts() {
  local bundle_dir="$1"
  if [[ ! -d "$bundle_dir" ]]; then
    echo "Error: bundle dir not found: $bundle_dir"
    exit 1
  fi

  local latest
  latest="$(find "$bundle_dir" -type f -name latest.json -print -quit || true)"

  echo "Collecting artifacts from: $bundle_dir"
  find "$bundle_dir" -maxdepth 5 -type f \( \
    -name "*.dmg" -o -name "*.tar.gz" -o -name "*.sig" -o -name "latest.json" \
    \) -print0 | while IFS= read -r -d '' file; do
      cp -f "$file" "$ARTIFACTS_DIR/"
    done

  if [[ -z "$latest" ]]; then
    local updater_tar updater_sig platform_key
    updater_tar="$(find "$bundle_dir" -type f -name '*.app.tar.gz' -print -quit || true)"
    updater_sig="$(find "$bundle_dir" -type f -name '*.app.tar.gz.sig' -print -quit || true)"

    if [[ -z "$updater_tar" || -z "$updater_sig" ]]; then
      echo "Error: latest.json is missing and updater artifacts (.app.tar.gz + .sig) were not found."
      exit 1
    fi

    if [[ "$bundle_dir" == *"aarch64-apple-darwin"* ]]; then
      platform_key="darwin-aarch64"
    elif [[ "$bundle_dir" == *"x86_64-apple-darwin"* ]]; then
      platform_key="darwin-x86_64"
    else
      platform_key="darwin-aarch64"
    fi

    local sig_content updater_name
    sig_content="$(cat "$updater_sig")"
    updater_name="$(basename "$updater_tar")"

    jq -n \
      --arg version "$VERSION" \
      --arg notes "$TAG Release" \
      --arg pub_date "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
      --arg platform "$platform_key" \
      --arg signature "$sig_content" \
      --arg url "$updater_name" \
      '{
        version: $version,
        notes: $notes,
        pub_date: $pub_date,
        platforms: {
          ($platform): {
            signature: $signature,
            url: $url
          }
        }
      }' > "$ARTIFACTS_DIR/latest.json"

    echo "Generated latest.json from updater artifacts for platform: $platform_key"
  fi
}

if [[ "$MAC_BOTH" == "1" ]]; then
  rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true

  build_target aarch64-apple-darwin
  build_target x86_64-apple-darwin

  echo "Collecting multi-arch macOS artifacts ..."
  "$SCRIPT_DIR/collect_macos_artifacts.sh" "$TAG" "$ARTIFACTS_DIR" \
    "$ROOT_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle" \
    "$ROOT_DIR/src-tauri/target/x86_64-apple-darwin/release/bundle"
else
  if [[ "$(uname -m)" == "arm64" ]]; then
    rustup target add aarch64-apple-darwin >/dev/null 2>&1 || true
    build_target aarch64-apple-darwin
    copy_bundle_artifacts "$ROOT_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle"
  else
    rustup target add x86_64-apple-darwin >/dev/null 2>&1 || true
    build_target x86_64-apple-darwin
    copy_bundle_artifacts "$ROOT_DIR/src-tauri/target/x86_64-apple-darwin/release/bundle"
  fi
fi

if [[ -n "$WINDOWS_INSTALLER" ]]; then
  if [[ ! -f "$WINDOWS_INSTALLER" ]]; then
    echo "Error: Windows installer not found: $WINDOWS_INSTALLER"
    exit 1
  fi
  echo "Adding Windows installer: $WINDOWS_INSTALLER"
  cp -f "$WINDOWS_INSTALLER" "$ARTIFACTS_DIR/"
fi

echo "Publishing distribution release to $DIST_REPO ..."
"$SCRIPT_DIR/release_local.sh" "$TAG" "$ARTIFACTS_DIR" "$DIST_REPO"

NOTES_FILE="$(mktemp "${TMPDIR:-/tmp}/guardian-release-notes-${TAG}-XXXXXX.md")"
trap 'rm -f "$NOTES_FILE"' EXIT

awk -v v="$VERSION" '
  $0 ~ "^## \\[" v "\\]" {in_section=1; print; next}
  in_section && $0 ~ "^## \\[" {exit}
  in_section {print}
' CHANGELOG.md > "$NOTES_FILE"

if [[ ! -s "$NOTES_FILE" ]]; then
  echo "Warning: could not extract release notes for $VERSION from CHANGELOG.md; leaving distribution notes as-is."
else
  TITLE_LINE="$(head -n 1 "$NOTES_FILE" | sed -E 's/^## \\[([0-9.]+)\\] - //')"
  TITLE="${TAG} - ${TITLE_LINE}"
  echo "Updating distribution release notes/title ..."
  gh release edit "$TAG" -R "$DIST_REPO" --title "$TITLE" --notes-file "$NOTES_FILE" >/dev/null
fi

echo "Regenerating releases.json snapshot (post-notes) ..."
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
gh api "repos/${DIST_REPO}/releases?per_page=60" > "$ARTIFACTS_DIR/dist-releases.raw.json"
jq --arg generated_at "$GENERATED_AT" --arg repo "$DIST_REPO" '{
  generated_at: $generated_at,
  repo: $repo,
  releases: (map({
    id,
    tag_name,
    name,
    body,
    html_url,
    published_at,
    prerelease,
    draft,
    assets: ((.assets // []) | map({
      id,
      name,
      browser_download_url,
      size,
      updated_at,
      download_count,
      content_type
    }))
  }) // [])
}' "$ARTIFACTS_DIR/dist-releases.raw.json" > "$ARTIFACTS_DIR/releases.json"

gh release upload "$TAG" "$ARTIFACTS_DIR/releases.json" -R "$DIST_REPO" --clobber >/dev/null
echo "Updated releases.json snapshot."

echo "Done."
