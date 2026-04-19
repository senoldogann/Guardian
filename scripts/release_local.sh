#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/release_local.sh <tag> <artifacts_dir> [dist_repo]

Examples:
  # macOS-only bundle dir (contains latest.json)
  scripts/release_local.sh v1.0.0 ./src-tauri/target/aarch64-apple-darwin/release/bundle

  # multi-platform artifacts dir with subfolders:
  #   artifacts/mac/latest.json
  #   artifacts/win/latest.json
  #   artifacts/linux/latest.json
  #   artifacts/* installers + .sig
  scripts/release_local.sh v1.0.0 ./artifacts

Notes:
  - Merges multiple latest.json files if present (mac/win/linux).
  - Generates releases.json from distribution repo releases.
  - Uploads assets to the distribution repo release.

Requirements:
  - gh CLI installed and authenticated
  - jq installed
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

TAG="$1"
ARTIFACTS_DIR="$2"
DIST_REPO="${3:-senoldogann/guardian-distribution}"

if [[ ! -d "$ARTIFACTS_DIR" ]]; then
  echo "Error: artifacts_dir does not exist: $ARTIFACTS_DIR"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MERGE_SCRIPT="$SCRIPT_DIR/merge_latest_json.sh"
PUBLISH_SCRIPT="$SCRIPT_DIR/publish_distribution_local.sh"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/guardian-release-${TAG}-XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

LATEST_FILES=()
if [[ -f "$ARTIFACTS_DIR/latest.json" ]]; then
  LATEST_FILES+=("$ARTIFACTS_DIR/latest.json")
fi
if [[ -f "$ARTIFACTS_DIR/mac/latest.json" ]]; then
  LATEST_FILES+=("$ARTIFACTS_DIR/mac/latest.json")
fi
if [[ -f "$ARTIFACTS_DIR/win/latest.json" ]]; then
  LATEST_FILES+=("$ARTIFACTS_DIR/win/latest.json")
fi
if [[ -f "$ARTIFACTS_DIR/linux/latest.json" ]]; then
  LATEST_FILES+=("$ARTIFACTS_DIR/linux/latest.json")
fi

if [[ ${#LATEST_FILES[@]} -eq 0 ]]; then
  echo "Error: no latest.json found in artifacts_dir (expected latest.json or mac/win/linux subfolders)."
  exit 1
fi

MERGED_LATEST="$WORK_DIR/latest.json"
"$MERGE_SCRIPT" "$TAG" "$MERGED_LATEST" "${LATEST_FILES[@]}"

if [[ ! -d "$WORK_DIR/assets" ]]; then
  mkdir -p "$WORK_DIR/assets"
fi

cp -f "$MERGED_LATEST" "$WORK_DIR/assets/latest.json"

echo "Collecting release assets from $ARTIFACTS_DIR ..."
find "$ARTIFACTS_DIR" -maxdepth 5 -type f \( \
  -name "*.dmg" -o -name "*.msi" -o -name "*-setup.exe" -o -name "*.tar.gz" -o -name "*.zip" -o -name "*.sig" -o -name "*.vsix" -o -name "checksums.txt" \
\) -print0 | while IFS= read -r -d '' file; do
  cp -f "$file" "$WORK_DIR/assets/"
done

echo "Publishing distribution release ..."
"$PUBLISH_SCRIPT" "$TAG" "$WORK_DIR/assets" "$DIST_REPO"

echo "Release published: $DIST_REPO ($TAG)"
