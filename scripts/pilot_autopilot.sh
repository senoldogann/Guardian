#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/pilot_autopilot.sh [--manifest <path>] [--summary-dir <dir>] [--cli-bin <path>]
EOF
}

MANIFEST="docs/pilot/PILOT_REPO_MANIFEST.json"
SUMMARY_DIR=".guardian/pilot-dryrun"
CLI_BIN="guardian-cli/target/release/guardian-cli"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --manifest)
      MANIFEST="${2:-}"
      shift 2
      ;;
    --summary-dir)
      SUMMARY_DIR="${2:-}"
      shift 2
      ;;
    --cli-bin)
      CLI_BIN="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

python3 "$SCRIPT_DIR/pilot_dryrun.py" \
  --manifest "$MANIFEST" \
  --cli-bin "$CLI_BIN" \
  --summary-dir "$SUMMARY_DIR"

python3 - "$MANIFEST" <<'PY' | while IFS=$'\t' read -r name team path; do
import json
import sys
from pathlib import Path

manifest_path = Path(sys.argv[1]).resolve()
with manifest_path.open("r", encoding="utf-8") as handle:
    manifest = json.load(handle)

for repo in manifest.get("repos", []):
    if not isinstance(repo, dict):
        continue
    name = str(repo.get("name", "unknown"))
    team = str(repo.get("team", "unknown"))
    path = str(repo.get("path", "")).strip()
    if path:
        repo_path = Path(path).expanduser()
        if not repo_path.is_absolute():
            repo_path = (manifest_path.parent / repo_path).resolve()
        print(f"{name}\t{team}\t{repo_path}")
PY
  if [[ -d "$path" ]]; then
    GUARDIAN_PILOT_TEAM="$team" GUARDIAN_PILOT_REPO="$name" \
      "$SCRIPT_DIR/pilot_generate_weekly_report.sh" "$path"
  fi
done

python3 "$SCRIPT_DIR/pilot_collect_leak_prevented_cases.py" --summary-dir "$SUMMARY_DIR"
python3 "$SCRIPT_DIR/pilot_validate_ci_gate_flow.py" \
  --ci-workflow .github/workflows/ci-cd-v1.yml \
  --release-workflow .github/workflows/release-windows.yml

echo "Pilot autopilot finished."
