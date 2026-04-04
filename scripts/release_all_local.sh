#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/release_all_local.sh [tag] [--bump patch|minor|major|<semver>] [--dist-repo owner/repo] [--mac-both] [--windows-installer /path/to/file] [--gate-only]

What it does:
  0) Auto-syncs version files (if tag is omitted or out-of-sync)
  1) Runs the local verification gate (npm run verify)
  2) Runs Guardian release gate (guardian-cli scan + guardian.policy.yaml)
  3) Builds Tauri bundles (macOS) unless --gate-only is set
  4) Collects artifacts into ./artifacts/<tag>/
  5) Publishes/updates the release in the public distribution repo
  6) Updates distribution release notes from CHANGELOG.md

Gate behavior:
  - Writes report to .guardian/release_gate_report.json
  - Uses --release-gate strict and --no-baseline
  - Optional env for approval/override:
      GUARDIAN_RELEASE_APPROVER
      GUARDIAN_RELEASE_OVERRIDE_REASON
  - Optional env for unsigned local build (NOT for production):
      GUARDIAN_RELEASE_NO_SIGN=1

Examples:
  scripts/release_all_local.sh v1.2.0
  scripts/release_all_local.sh            # auto patch bump + release
  scripts/release_all_local.sh --bump minor
  scripts/release_all_local.sh v1.2.0 --gate-only
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WRITE_LATEST_SCRIPT="$SCRIPT_DIR/write_tauri_latest_json.sh"
cd "$ROOT_DIR"

resolve_github_token() {
  if [[ -n "${GH_TOKEN:-}" || -n "${GITHUB_TOKEN:-}" ]]; then
    return 0
  fi

  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi

  local credential_output=""
  credential_output="$(
    printf "protocol=https\nhost=github.com\n\n" \
      | git credential fill 2>/dev/null || true
  )"
  local token=""
  token="$(printf '%s\n' "$credential_output" | sed -n 's/^password=//p' | head -n 1)"
  if [[ -n "$token" ]]; then
    export GH_TOKEN="$token"
  fi
}

TAG=""
if [[ $# -gt 0 && "${1:-}" != --* ]]; then
  TAG="$1"
  shift
fi

DIST_REPO="senoldogann/guardian-distribution"
MAC_BOTH="0"
WINDOWS_INSTALLER=""
BUMP_SPEC=""
GATE_ONLY="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dist-repo)
      DIST_REPO="${2:-}"
      shift 2
      ;;
    --mac-both)
      MAC_BOTH="1"
      shift 1
      ;;
    --windows-installer)
      WINDOWS_INSTALLER="${2:-}"
      shift 2
      ;;
    --bump)
      BUMP_SPEC="${2:-}"
      shift 2
      ;;
    --gate-only)
      GATE_ONLY="1"
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -n "$TAG" && -n "$BUMP_SPEC" ]]; then
  echo "Error: use either explicit <tag> or --bump, not both."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not installed."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed."
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Error: cargo is not installed."
  exit 1
fi

RUSTUP_AVAILABLE="1"
if ! command -v rustup >/dev/null 2>&1; then
  RUSTUP_AVAILABLE="0"
  echo "Warning: rustup not found, skipping automatic target installation."
fi

if [[ -z "$TAG" ]]; then
  SPEC="${BUMP_SPEC:-patch}"
  echo "No tag provided. Auto-bumping version: $SPEC"
  "$SCRIPT_DIR/bump_version.sh" "$SPEC"
  VERSION="$(node -p "require('./package.json').version")"
  TAG="v$VERSION"
else
  VERSION="${TAG#v}"
fi

PKG_VERSION="$(node -p "require('./package.json').version")"
TAURI_VERSION="$(jq -r '.version // ""' src-tauri/tauri.conf.json)"
CARGO_VERSION="$(grep -E '^version[[:space:]]*=[[:space:]]*"' src-tauri/Cargo.toml | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')"

if [[ "$PKG_VERSION" != "$VERSION" || "$TAURI_VERSION" != "$VERSION" || "$CARGO_VERSION" != "$VERSION" ]]; then
  echo "Version mismatch detected. Syncing all version files to '$VERSION' ..."
  "$SCRIPT_DIR/bump_version.sh" "$VERSION"
  PKG_VERSION="$(node -p "require('./package.json').version")"
  TAURI_VERSION="$(jq -r '.version // ""' src-tauri/tauri.conf.json)"
  CARGO_VERSION="$(grep -E '^version[[:space:]]*=[[:space:]]*"' src-tauri/Cargo.toml | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')"
fi

if [[ "$PKG_VERSION" != "$VERSION" || "$TAURI_VERSION" != "$VERSION" || "$CARGO_VERSION" != "$VERSION" ]]; then
  echo "Error: version sync failed."
  echo "  package.json:          $PKG_VERSION"
  echo "  src-tauri/Cargo.toml:  $CARGO_VERSION"
  echo "  src-tauri/tauri.conf:  $TAURI_VERSION"
  echo "  expected:              $VERSION"
  exit 1
fi

echo "Running verification gate (npm run verify) ..."
npm run verify

echo "Running Guardian release gate (strict) ..."
mkdir -p .guardian
REPORT_PATH="$ROOT_DIR/.guardian/release_gate_report.json"

CLI_BIN="${GUARDIAN_CLI_BIN:-$ROOT_DIR/guardian-cli/target/release/guardian-cli}"
if [[ ! -x "$CLI_BIN" ]]; then
  echo "guardian-cli binary missing, building release binary ..."
  cargo build --release --manifest-path guardian-cli/Cargo.toml >/dev/null
fi

GATE_ARGS=(
  scan
  --root "$ROOT_DIR"
  --no-baseline
  --format json
  --out "$REPORT_PATH"
  --policy "$ROOT_DIR/guardian.policy.yaml"
  --release-gate strict
  --pr-gate off
)

if [[ "${GUARDIAN_RELEASE_OFFLINE:-1}" == "1" ]]; then
  GATE_ARGS+=(--offline)
fi

if [[ -n "${GUARDIAN_RELEASE_APPROVER:-}" ]]; then
  GATE_ARGS+=(--approver "$GUARDIAN_RELEASE_APPROVER")
fi
if [[ -n "${GUARDIAN_RELEASE_OVERRIDE_REASON:-}" ]]; then
  GATE_ARGS+=(--override-reason "$GUARDIAN_RELEASE_OVERRIDE_REASON")
fi

set +e
"$CLI_BIN" "${GATE_ARGS[@]}"
GATE_EXIT=$?
set -e

if [[ ! -f "$REPORT_PATH" ]]; then
  echo "Error: release gate report not produced at $REPORT_PATH"
  exit 1
fi

DECISION="$(python3 - <<'PY' "$REPORT_PATH"
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    data = json.load(handle)
print(data.get("release_decision", "UNKNOWN"))
PY
)"

echo "Release gate decision: $DECISION (exit=$GATE_EXIT)"
if [[ "$GATE_EXIT" -ne 0 || "$DECISION" == "BLOCK_UNTIL_APPROVED" ]]; then
  echo "Release gate blocked publish."
  exit 1
fi

if [[ "$GATE_ONLY" == "1" ]]; then
  echo "Gate-only mode complete."
  echo "Report: $REPORT_PATH"
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is not installed."
  exit 1
fi
resolve_github_token
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login"
  exit 1
fi

NO_SIGN="${GUARDIAN_RELEASE_NO_SIGN:-0}"
if [[ "$NO_SIGN" != "1" ]]; then
  KEY_PATH="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/guardian.key}"
  if [[ ! -f "$KEY_PATH" ]]; then
    echo "Error: Tauri signing key not found: $KEY_PATH"
    exit 1
  fi

  export TAURI_SIGNING_PRIVATE_KEY
  TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_PATH")"

  if [[ -z "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" ]]; then
    echo -n "Enter password for TAURI signing key ($KEY_PATH): "
    read -r -s TAURI_SIGNING_PRIVATE_KEY_PASSWORD
    echo ""
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    SIGNING_IDENTITY="$(jq -r '.bundle.macOS.signingIdentity // empty' src-tauri/tauri.conf.json)"
    if [[ -n "$SIGNING_IDENTITY" ]]; then
      if ! security find-identity -v -p codesigning 2>/dev/null | grep -Fq "$SIGNING_IDENTITY"; then
        echo "Error: macOS code-sign identity not found in keychain: $SIGNING_IDENTITY"
        echo "Hint: import the Apple Developer certificate into keychain before release build."
        exit 1
      fi
    fi
  fi
else
  echo "Warning: GUARDIAN_RELEASE_NO_SIGN=1 set; build/update artifacts will be unsigned (not production-safe)."
fi

ARTIFACTS_DIR="$ROOT_DIR/artifacts/$TAG"
mkdir -p "$ARTIFACTS_DIR"

build_target() {
  local target="$1"
  echo "Building Tauri bundle for target: $target"
  if [[ "$NO_SIGN" == "1" ]]; then
    npm run tauri build -- --target "$target" --no-sign
  else
    npm run tauri build -- --target "$target"
  fi
}

copy_bundle_artifacts() {
  local bundle_dir="$1"
  local platform_key="$2"
  if [[ ! -d "$bundle_dir" ]]; then
    echo "Error: bundle dir not found: $bundle_dir"
    exit 1
  fi

  echo "Collecting artifacts from: $bundle_dir"
  find "$bundle_dir" -maxdepth 5 -type f \( \
    -name "*.dmg" -o -name "*.tar.gz" -o -name "*.sig" -o -name "latest.json" \
    \) -print0 | while IFS= read -r -d '' file; do
      cp -f "$file" "$ARTIFACTS_DIR/"
    done

  if [[ ! -f "$ARTIFACTS_DIR/latest.json" ]]; then
    "$WRITE_LATEST_SCRIPT" "$TAG" "$ARTIFACTS_DIR/latest.json" "$platform_key" "$bundle_dir"
  fi
}

if [[ "$MAC_BOTH" == "1" ]]; then
  if [[ "$RUSTUP_AVAILABLE" == "1" ]]; then
    rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null 2>&1 || true
  fi
  build_target aarch64-apple-darwin
  build_target x86_64-apple-darwin
  "$SCRIPT_DIR/collect_macos_artifacts.sh" "$TAG" "$ARTIFACTS_DIR" \
    "$ROOT_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle" \
    "$ROOT_DIR/src-tauri/target/x86_64-apple-darwin/release/bundle"
else
  if [[ "$(uname -m)" == "arm64" ]]; then
    if [[ "$RUSTUP_AVAILABLE" == "1" ]]; then
      rustup target add aarch64-apple-darwin >/dev/null 2>&1 || true
    fi
    build_target aarch64-apple-darwin
    copy_bundle_artifacts "$ROOT_DIR/src-tauri/target/aarch64-apple-darwin/release/bundle" "darwin-aarch64"
  else
    if [[ "$RUSTUP_AVAILABLE" == "1" ]]; then
      rustup target add x86_64-apple-darwin >/dev/null 2>&1 || true
    fi
    build_target x86_64-apple-darwin
    copy_bundle_artifacts "$ROOT_DIR/src-tauri/target/x86_64-apple-darwin/release/bundle" "darwin-x86_64"
  fi
fi

if [[ -n "$WINDOWS_INSTALLER" ]]; then
  if [[ ! -f "$WINDOWS_INSTALLER" ]]; then
    echo "Error: Windows installer not found: $WINDOWS_INSTALLER"
    exit 1
  fi
  cp -f "$WINDOWS_INSTALLER" "$ARTIFACTS_DIR/"
fi

echo "Publishing distribution release to $DIST_REPO ..."
"$SCRIPT_DIR/release_local.sh" "$TAG" "$ARTIFACTS_DIR" "$DIST_REPO"

NOTES_FILE="$(mktemp "${TMPDIR:-/tmp}/guardian-release-notes-${TAG}-XXXXXX.md")"
trap 'rm -f "$NOTES_FILE"' EXIT

awk -v v="$VERSION" '
  $0 ~ "^## \\[" v "\\]" {in_section=1; print; next}
  in_section && $0 ~ "^## \\[" {exit}
  in_section {print}
' CHANGELOG.md > "$NOTES_FILE"

if [[ -s "$NOTES_FILE" ]]; then
  TITLE_LINE="$(head -n 1 "$NOTES_FILE" | sed -E 's/^## \\[([0-9.]+)\\] - //')"
  TITLE="${TAG} - ${TITLE_LINE}"
  gh release edit "$TAG" -R "$DIST_REPO" --title "$TITLE" --notes-file "$NOTES_FILE" >/dev/null
fi

echo "Done."
