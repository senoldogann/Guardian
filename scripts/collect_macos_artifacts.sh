#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/collect_macos_artifacts.sh <tag> <output_dir> <arm_bundle_dir> <intel_bundle_dir>

Examples:
  scripts/collect_macos_artifacts.sh v1.0.0 ./artifacts \
    ./src-tauri/target/aarch64-apple-darwin/release/bundle \
    ./src-tauri/target/x86_64-apple-darwin/release/bundle

Notes:
  - Finds latest.json in each bundle dir.
  - Copies .dmg, .tar.gz, and .sig files into output_dir.
  - Merges latest.json files into output_dir/latest.json.

Requirements:
  - jq (used by merge_latest_json.sh)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 4 ]]; then
  usage
  exit 1
fi

TAG="$1"
OUTPUT_DIR="$2"
ARM_DIR="$3"
INTEL_DIR="$4"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MERGE_SCRIPT="$SCRIPT_DIR/merge_latest_json.sh"
WRITE_LATEST_SCRIPT="$SCRIPT_DIR/write_tauri_latest_json.sh"

if [[ ! -d "$ARM_DIR" ]]; then
  echo "Error: arm bundle dir not found: $ARM_DIR"
  exit 1
fi

if [[ ! -d "$INTEL_DIR" ]]; then
  echo "Error: intel bundle dir not found: $INTEL_DIR"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

ARM_LATEST="$(find "$ARM_DIR" -type f -name latest.json -print -quit || true)"
INTEL_LATEST="$(find "$INTEL_DIR" -type f -name latest.json -print -quit || true)"

if [[ -z "$ARM_LATEST" ]]; then
  ARM_LATEST="$OUTPUT_DIR/latest.arm64.json"
  "$WRITE_LATEST_SCRIPT" "$TAG" "$ARM_LATEST" "darwin-aarch64" "$ARM_DIR"
fi

if [[ -z "$INTEL_LATEST" ]]; then
  INTEL_LATEST="$OUTPUT_DIR/latest.x64.json"
  "$WRITE_LATEST_SCRIPT" "$TAG" "$INTEL_LATEST" "darwin-x86_64" "$INTEL_DIR"
fi

if [[ -z "$ARM_LATEST" || -z "$INTEL_LATEST" ]]; then
  echo "Error: latest.json not found in bundle dirs."
  echo "Expected: $ARM_DIR/latest.json and $INTEL_DIR/latest.json"
  echo "If you signed manually, create latest.json in output_dir before publishing."
  exit 1
fi

echo "Collecting macOS artifacts into $OUTPUT_DIR ..."
find "$ARM_DIR" "$INTEL_DIR" -type f \( -name "*.dmg" -o -name "*.tar.gz" -o -name "*.sig" \) -print0 \
  | while IFS= read -r -d '' file; do
      cp -f "$file" "$OUTPUT_DIR/"
    done

"$MERGE_SCRIPT" "$TAG" "$OUTPUT_DIR/latest.json" "$ARM_LATEST" "$INTEL_LATEST"

echo "macOS artifacts collected at: $OUTPUT_DIR"
