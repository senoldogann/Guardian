#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/pilot_generate_rollout_trend.sh <manifest_path>

Optional env:
  GUARDIAN_PILOT_MIN_REPOS=2
  GUARDIAN_PILOT_MIN_WEEKS=4
  GUARDIAN_PILOT_OVERRIDE_REASON_THRESHOLD=0.95
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
MIN_REPOS="${GUARDIAN_PILOT_MIN_REPOS:-2}"
MIN_WEEKS="${GUARDIAN_PILOT_MIN_WEEKS:-4}"
OVERRIDE_REASON_THRESHOLD="${GUARDIAN_PILOT_OVERRIDE_REASON_THRESHOLD:-0.95}"

python3 "$SCRIPT_DIR/pilot_rollout_trend.py" \
  --manifest "$MANIFEST_PATH" \
  --min-repos "$MIN_REPOS" \
  --min-weeks "$MIN_WEEKS" \
  --override-reason-threshold "$OVERRIDE_REASON_THRESHOLD" \
  --output-dir ".guardian/pilot-rollout-trend"

