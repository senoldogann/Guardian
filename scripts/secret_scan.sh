#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN='ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{35}'
ALLOWLIST_PATTERN='ghp_<REDACTED_TOKEN>|ghp_xxx|github_pat_xxx|REDACTED|YOUR_|BURAYA_YAZ|ghp_123456789012345678901234567890123456'
ALLOWLIST_PATH_PATTERN='website/lib/github\.test\.ts|website/README\.md|website/\.env\.example|docs/LOCAL_RELEASE_RUNBOOK\.md'

if command -v rg >/dev/null 2>&1; then
  scan_output="$(
    git ls-files -z \
      | xargs -0 rg -n --no-heading --color never --no-messages -e "$PATTERN" \
      | rg -v "$ALLOWLIST_PATTERN|$ALLOWLIST_PATH_PATTERN" || true
  )"
else
  echo "[secret-scan] ripgrep (rg) not found, using grep fallback."
  scan_output="$(
    git ls-files -z \
      | xargs -0 grep -nHEI "$PATTERN" 2>/dev/null \
      | grep -Ev "$ALLOWLIST_PATTERN|$ALLOWLIST_PATH_PATTERN" || true
  )"
fi

if [[ -n "${scan_output}" ]]; then
  echo "[secret-scan] Potential secret leak detected in tracked files:"
  echo "${scan_output}"
  echo "[secret-scan] Rotate leaked credentials immediately and replace with environment-driven configuration."
  exit 1
fi

echo "[secret-scan] OK - no tracked secret patterns detected."
