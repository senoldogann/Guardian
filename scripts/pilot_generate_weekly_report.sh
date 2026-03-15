#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  GUARDIAN_PILOT_TEAM=<team> GUARDIAN_PILOT_REPO=<repo> scripts/pilot_generate_weekly_report.sh <repo_root>

Optional env:
  GUARDIAN_PILOT_WINDOW_DAYS=7
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
REPO_ROOT="$(cd "$1" && pwd)"
TEAM="${GUARDIAN_PILOT_TEAM:-unknown}"
REPO="${GUARDIAN_PILOT_REPO:-$(basename "$REPO_ROOT")}"
WINDOW_DAYS="${GUARDIAN_PILOT_WINDOW_DAYS:-7}"
RUN_DATE="$(date -u +"%Y-%m-%d")"
OUT_DIR="$REPO_ROOT/.guardian/pilot-reports/$RUN_DATE"
JSON_OUT="$OUT_DIR/dashboard_lite.json"
MD_OUT="$OUT_DIR/dashboard_lite.md"

mkdir -p "$OUT_DIR"

python3 "$SCRIPT_DIR/generate_dashboard_lite.py" \
  --root "$REPO_ROOT" \
  --window-days "$WINDOW_DAYS" \
  --format both \
  --out "$JSON_OUT" \
  --md-out "$MD_OUT" \
  --team "$TEAM" \
  --repo "$REPO"

python3 "$SCRIPT_DIR/generate_governance_summary.py" \
  --root "$REPO_ROOT"

python3 "$SCRIPT_DIR/governance_replay.py" \
  --reports-root "$REPO_ROOT/.guardian/pilot-dryrun-real" \
  --policy "$REPO_ROOT/guardian.policy.yaml" \
  --output-dir "$REPO_ROOT/.guardian/governance-replay" \
  --window-days "$WINDOW_DAYS"

python3 "$SCRIPT_DIR/override_debt_ledger.py" \
  --audit-path "$REPO_ROOT/.guardian/release_decisions.jsonl" \
  --output-dir "$REPO_ROOT/.guardian" \
  --sla-days 7

echo "Weekly dashboard-lite report generated:"
echo "  JSON: $JSON_OUT"
echo "  MD:   $MD_OUT"
echo "  Governance Summary: $REPO_ROOT/.guardian/governance_summary.{json,md}"
echo "  Replay: $REPO_ROOT/.guardian/governance-replay/$RUN_DATE/replay_summary.{json,md}"
echo "  Override Debt: $REPO_ROOT/.guardian/override_debt_ledger.{json,md}"
