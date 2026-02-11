#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/bump_version.sh [patch|minor|major|<semver>]

Examples:
  scripts/bump_version.sh            # defaults to patch
  scripts/bump_version.sh patch
  scripts/bump_version.sh minor
  scripts/bump_version.sh 1.2.3

What it does:
  - Updates guardian/package.json version (and package-lock.json)
  - Updates guardian/website/package.json version (and website/package-lock.json)
  - Updates src-tauri/Cargo.toml package version
  - Updates src-tauri/tauri.conf.json version
  - Normalizes window title to "Guardian" so runtime version is always dynamic
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SPEC="${1:-patch}"
CURRENT="$(node -p "require('./package.json').version")"

TARGET="$(node - <<'NODE' "$CURRENT" "$SPEC"
const current = process.argv[2];
const spec = process.argv[3];
const semver = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

if (!semver.test(current)) {
  console.error(`Invalid current version: ${current}`);
  process.exit(1);
}

if (semver.test(spec)) {
  console.log(spec);
  process.exit(0);
}

const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
if (!match) {
  console.error(`Could not parse current version: ${current}`);
  process.exit(1);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);

switch (spec) {
  case "major":
    major += 1;
    minor = 0;
    patch = 0;
    break;
  case "minor":
    minor += 1;
    patch = 0;
    break;
  case "patch":
    patch += 1;
    break;
  default:
    console.error(`Invalid bump spec: ${spec}`);
    process.exit(1);
}

console.log(`${major}.${minor}.${patch}`);
NODE
)"

echo "Version sync: $CURRENT -> $TARGET"

npm version "$TARGET" --no-git-tag-version --allow-same-version >/dev/null

if [[ -f "website/package.json" ]]; then
  (
    cd website
    npm version "$TARGET" --no-git-tag-version --allow-same-version >/dev/null
  )
fi

TARGET_VERSION="$TARGET" node - <<'NODE'
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const target = process.env.TARGET_VERSION;
if (!target) {
  throw new Error("TARGET_VERSION is missing");
}

const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
let cargo = fs.readFileSync(cargoPath, "utf8");
cargo = cargo.replace(
  /(\[package\][\s\S]*?^version\s*=\s*")[^"]+(")/m,
  `$1${target}$2`
);
fs.writeFileSync(cargoPath, cargo);

const tauriPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
tauri.version = target;
if (tauri.app && Array.isArray(tauri.app.windows)) {
  tauri.app.windows = tauri.app.windows.map((win) => {
    if (typeof win?.title === "string" && /^Guardian v/i.test(win.title)) {
      return { ...win, title: "Guardian" };
    }
    return win;
  });
}
fs.writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);
NODE

echo "Updated files:"
echo "  - package.json / package-lock.json"
echo "  - website/package.json / website/package-lock.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/tauri.conf.json"
echo "Ready tag: v$TARGET"
