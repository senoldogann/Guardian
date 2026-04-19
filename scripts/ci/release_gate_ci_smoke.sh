#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

CLI_BIN="${GUARDIAN_CLI_BIN:-$ROOT_DIR/guardian-cli/target/release/guardian-cli}"
if [[ ! -x "$CLI_BIN" ]]; then
  echo "[release-gate-smoke] guardian-cli binary missing: $CLI_BIN"
  exit 1
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/guardian-release-gate-smoke-XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT
ARTIFACT_DIR="${RELEASE_GATE_SMOKE_ARTIFACT_DIR:-}"

cat > "$TMP_DIR/guardian.policy.yaml" <<'YAML'
schema_version: 1
packs:
  - ai_generated_code_strict_mode
gate:
  pass_max_warnings: 5
  block_on_critical: true
  require_human_approval_on_ai_heavy: true
  require_override_reason: true
YAML

mkdir -p "$TMP_DIR/src"
cat > "$TMP_DIR/src/insecure.ts" <<'TS'
export function run(input: string) {
  return eval(input);
}
TS

report_for() {
  local name="$1"
  echo "$TMP_DIR/${name}.json"
}

decision_of() {
  local report="$1"
  python3 - "$report" <<'PY'
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as handle:
    payload = json.load(handle)
print(payload.get("release_decision", "UNKNOWN"))
PY
}

echo "[release-gate-smoke] strict mode should block ..."
set +e
"$CLI_BIN" scan \
  --root "$TMP_DIR" \
  --offline \
  --no-baseline \
  --format json \
  --out "$(report_for strict_block)" \
  --policy "$TMP_DIR/guardian.policy.yaml" \
  --release-gate strict \
  --pr-gate off
strict_exit=$?
set -e

strict_decision="$(decision_of "$(report_for strict_block)")"
if [[ "$strict_exit" -ne 1 || "$strict_decision" != "BLOCK_UNTIL_APPROVED" ]]; then
  echo "[release-gate-smoke] expected strict block (exit=1, decision=BLOCK_UNTIL_APPROVED)"
  echo "[release-gate-smoke] got exit=$strict_exit decision=$strict_decision"
  exit 1
fi

echo "[release-gate-smoke] warn mode should not fail process ..."
"$CLI_BIN" scan \
  --root "$TMP_DIR" \
  --offline \
  --no-baseline \
  --format json \
  --out "$(report_for warn_mode)" \
  --policy "$TMP_DIR/guardian.policy.yaml" \
  --release-gate warn \
  --pr-gate off

warn_decision="$(decision_of "$(report_for warn_mode)")"
if [[ "$warn_decision" != "BLOCK_UNTIL_APPROVED" ]]; then
  echo "[release-gate-smoke] expected warn decision BLOCK_UNTIL_APPROVED, got $warn_decision"
  exit 1
fi

echo "[release-gate-smoke] override should pass ..."
"$CLI_BIN" scan \
  --root "$TMP_DIR" \
  --offline \
  --no-baseline \
  --format json \
  --out "$(report_for override_mode)" \
  --policy "$TMP_DIR/guardian.policy.yaml" \
  --release-gate strict \
  --pr-gate off \
  --approver release-manager \
  --override-reason "Emergency hotfix with validated rollback plan."

override_decision="$(decision_of "$(report_for override_mode)")"
if [[ "$override_decision" != "OVERRIDDEN" ]]; then
  echo "[release-gate-smoke] expected override decision OVERRIDDEN, got $override_decision"
  exit 1
fi

if [[ -n "$ARTIFACT_DIR" ]]; then
  mkdir -p "$ARTIFACT_DIR"
  cp "$(report_for strict_block)" "$ARTIFACT_DIR/strict-block.json"
  cp "$(report_for warn_mode)" "$ARTIFACT_DIR/warn-mode.json"
  cp "$(report_for override_mode)" "$ARTIFACT_DIR/override-mode.json"
fi

echo "[release-gate-smoke] PASS"
