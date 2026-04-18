#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/merge_latest_json.sh <tag> <output_file> <latest.json...>

Examples:
  scripts/merge_latest_json.sh v1.0.0 /tmp/latest.json ./mac/latest.json ./win/latest.json ./linux/latest.json

Notes:
  - Validates that all input latest.json files match the release version.
  - Merges the platforms map from all inputs into a single output file.

Requirements:
  - jq
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 3 ]]; then
  usage
  exit 1
fi

TAG="$1"
OUTPUT_FILE="$2"
shift 2

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed. (brew install jq)"
  exit 1
fi

VERSION="${TAG#v}"
VERSION_V="v${VERSION}"
FILES=()

for file in "$@"; do
  if [[ ! -f "$file" ]]; then
    echo "Error: latest.json file not found: $file"
    exit 1
  fi
  file_version="$(jq -r '.version // empty' "$file")"
  if [[ -z "$file_version" ]]; then
    echo "Error: latest.json missing version: $file"
    exit 1
  fi
  if [[ "$file_version" != "$VERSION" && "$file_version" != "$VERSION_V" ]]; then
    echo "Error: latest.json version ($file_version) does not match tag ($VERSION or $VERSION_V): $file"
    exit 1
  fi
  FILES+=("$file")
done

if [[ ${#FILES[@]} -eq 1 ]]; then
  cp -f "${FILES[0]}" "$OUTPUT_FILE"
  echo "Merged latest.json written to: $OUTPUT_FILE"
  exit 0
fi

jq -s '
  .[0] as $base
  | reduce .[1:][] as $item ($base;
      .platforms = ((.platforms // {}) + ($item.platforms // {}))
    )
' "${FILES[@]}" > "$OUTPUT_FILE"

echo "Merged latest.json written to: $OUTPUT_FILE"
