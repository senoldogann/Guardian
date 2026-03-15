#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/pilot_weekly_ops.sh <manifest_path> [approver_roster_path]

What it runs:
  1) Readiness validation (if roster provided)
  2) Strict dry-run
  3) Per-repo dashboard-lite weekly reports
  4) Cross-repo rollout trend
  5) AI-heavy calibration

Optional env:
  GUARDIAN_PILOT_DRYRUN_SUMMARY_DIR=.guardian/pilot-dryrun-real
  GUARDIAN_PILOT_MIN_REPOS=2
  GUARDIAN_PILOT_MIN_WEEKS=4
  GUARDIAN_PILOT_OVERRIDE_REASON_THRESHOLD=0.95
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
ROSTER_PATH="${2:-}"
DRYRUN_SUMMARY_DIR="${GUARDIAN_PILOT_DRYRUN_SUMMARY_DIR:-.guardian/pilot-dryrun-real}"
CLI_BIN="${GUARDIAN_CLI_BIN:-guardian-cli/target/release/guardian-cli}"

echo "[pilot-weekly-ops] manifest: $MANIFEST_PATH"
if [[ -n "$ROSTER_PATH" ]]; then
  ROSTER_PATH="$(cd "$(dirname "$ROSTER_PATH")" && pwd)/$(basename "$ROSTER_PATH")"
  echo "[pilot-weekly-ops] roster:   $ROSTER_PATH"
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "[pilot-weekly-ops] manifest not found: $MANIFEST_PATH" >&2
  exit 1
fi

if [[ -n "$ROSTER_PATH" ]]; then
  if [[ ! -f "$ROSTER_PATH" ]]; then
    echo "[pilot-weekly-ops] roster not found: $ROSTER_PATH" >&2
    exit 1
  fi
  python3 "$SCRIPT_DIR/pilot_validate_readiness.py" \
    --manifest "$MANIFEST_PATH" \
    --approver-roster "$ROSTER_PATH" \
    --output-dir ".guardian/pilot-real-readiness"
fi

python3 "$SCRIPT_DIR/pilot_dryrun.py" \
  --manifest "$MANIFEST_PATH" \
  --cli-bin "$CLI_BIN" \
  --summary-dir "$DRYRUN_SUMMARY_DIR"

while IFS='|' read -r repo_name repo_team repo_path; do
  if [[ -z "$repo_name" || -z "$repo_path" ]]; then
    continue
  fi
  GUARDIAN_PILOT_TEAM="$repo_team" GUARDIAN_PILOT_REPO="$repo_name" \
    "$SCRIPT_DIR/pilot_generate_weekly_report.sh" "$repo_path"
done < <(
  python3 - "$MANIFEST_PATH" <<'PY'
import json
import pathlib
import sys

manifest_path = pathlib.Path(sys.argv[1]).resolve()
with manifest_path.open("r", encoding="utf-8") as handle:
    data = json.load(handle)

for repo in data.get("repos", []):
    if not isinstance(repo, dict):
        continue
    name = str(repo.get("name", "")).strip()
    team = str(repo.get("team", "unknown")).strip() or "unknown"
    raw_path = str(repo.get("path", "")).strip()
    if not name or not raw_path:
        continue
    path = pathlib.Path(raw_path).expanduser()
    if not path.is_absolute():
        path = (manifest_path.parent / path).resolve()
    print(f"{name}|{team}|{path}")
PY
)

"$SCRIPT_DIR/pilot_generate_rollout_trend.sh" "$MANIFEST_PATH"
"$SCRIPT_DIR/pilot_generate_ai_heavy_calibration.sh" "$MANIFEST_PATH"

echo "[pilot-weekly-ops] completed."
