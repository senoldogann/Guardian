#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/pilot_generate_ai_heavy_calibration.sh <manifest_path>

Optional env:
  GUARDIAN_PILOT_WINDOW_DAYS=30
  GUARDIAN_AI_HEAVY_TARGET_MIN=0.25
  GUARDIAN_AI_HEAVY_TARGET_MAX=0.55
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
WINDOW_DAYS="${GUARDIAN_PILOT_WINDOW_DAYS:-30}"
TARGET_MIN="${GUARDIAN_AI_HEAVY_TARGET_MIN:-0.25}"
TARGET_MAX="${GUARDIAN_AI_HEAVY_TARGET_MAX:-0.55}"

python3 "$SCRIPT_DIR/pilot_ai_heavy_calibration.py" \
  --manifest "$MANIFEST_PATH" \
  --window-days "$WINDOW_DAYS" \
  --target-min "$TARGET_MIN" \
  --target-max "$TARGET_MAX" \
  --output-dir ".guardian/pilot-calibration"
