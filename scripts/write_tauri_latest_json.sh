#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/write_tauri_latest_json.sh <tag> <output_file> <platform_key> <bundle_dir>

Example:
  scripts/write_tauri_latest_json.sh v1.2.6 ./artifacts/v1.2.6/latest.json darwin-aarch64 \
    ./src-tauri/target/aarch64-apple-darwin/release/bundle
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
OUTPUT_FILE="$2"
PLATFORM_KEY="$3"
BUNDLE_DIR="$4"
VERSION="${TAG#v}"

if [[ ! -d "$BUNDLE_DIR" ]]; then
  echo "Error: bundle_dir not found: $BUNDLE_DIR"
  exit 1
fi

UPDATER_ARCHIVE="$(find "$BUNDLE_DIR" -type f -name "*.tar.gz" -print -quit || true)"
if [[ -z "$UPDATER_ARCHIVE" ]]; then
  echo "Error: no updater archive (*.tar.gz) found in bundle_dir: $BUNDLE_DIR"
  exit 1
fi

SIGNATURE_FILE="${UPDATER_ARCHIVE}.sig"
if [[ ! -f "$SIGNATURE_FILE" ]]; then
  echo "Error: updater signature not found for archive: $SIGNATURE_FILE"
  exit 1
fi

SIGNATURE="$(tr -d '\n' < "$SIGNATURE_FILE")"
if [[ -z "$SIGNATURE" ]]; then
  echo "Error: updater signature file is empty: $SIGNATURE_FILE"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"

jq -n \
  --arg version "$VERSION" \
  --arg notes "$TAG Release" \
  --arg pub_date "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg platform "$PLATFORM_KEY" \
  --arg signature "$SIGNATURE" \
  --arg url "$(basename "$UPDATER_ARCHIVE")" \
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
  }' > "$OUTPUT_FILE"

echo "Generated updater latest.json at: $OUTPUT_FILE"
