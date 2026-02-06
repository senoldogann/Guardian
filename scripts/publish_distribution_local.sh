#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/publish_distribution_local.sh <tag> <artifacts_dir> [dist_repo]

Examples:
  scripts/publish_distribution_local.sh v0.2.7 ./src-tauri/target/aarch64-apple-darwin/release/bundle
  scripts/publish_distribution_local.sh v0.2.7 /tmp/guardian-artifacts senoldogann/guardian-distribution

Notes:
  - This script uploads *local* build outputs to the distribution repo.
  - It rewrites latest.json URLs to point to the distribution repo.
  - It generates releases.json (changelog snapshot) from the distribution repo releases list.

Requirements:
  - gh CLI installed and authenticated (must be able to create/upload releases on dist_repo)
  - jq installed
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

TAG="$1"
ARTIFACTS_DIR="$2"
DIST_REPO="${3:-senoldogann/guardian-distribution}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is not installed."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not installed."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login"
  exit 1
fi

if [[ ! -d "$ARTIFACTS_DIR" ]]; then
  echo "Error: artifacts_dir does not exist: $ARTIFACTS_DIR"
  exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/guardian-dist-local-${TAG}-XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$WORK_DIR/assets"

echo "Collecting assets from: $ARTIFACTS_DIR"

# We accept either a flat dir (already curated) or raw bundle output dirs.
find "$ARTIFACTS_DIR" -maxdepth 5 -type f \( \
  -name "*.dmg" -o -name "*.msi" -o -name "*-setup.exe" -o -name "latest.json" -o -name "releases.json" \
  \) -print0 | while IFS= read -r -d '' file; do
  cp -f "$file" "$WORK_DIR/assets/"
done

LATEST_JSON="$WORK_DIR/assets/latest.json"
if [[ ! -f "$LATEST_JSON" ]]; then
  echo "Error: latest.json is required but was not found in artifacts_dir."
  echo "Expected to find it in: $ARTIFACTS_DIR"
  exit 1
fi

echo "Validating latest.json metadata ..."
if ! jq -e --arg version "${TAG#v}" '.version == $version' "$LATEST_JSON" >/dev/null; then
  echo "Error: latest.json version does not match release tag (${TAG#v})."
  exit 1
fi

if ! jq -e '.platforms | type == "object" and (keys | length) > 0' "$LATEST_JSON" >/dev/null; then
  echo "Error: latest.json has no updater platform entries."
  exit 1
fi

if ! jq -e '.platforms | all(.[]; ((.signature // "") | length) > 0 and ((.url // "") | length) > 0)' "$LATEST_JSON" >/dev/null; then
  echo "Error: latest.json contains platform entries with missing signature/url."
  exit 1
fi

echo "Rewriting latest.json URLs for distribution repo ..."
DIST_BASE="https://github.com/${DIST_REPO}/releases/download/${TAG}/"
jq --arg dist "$DIST_BASE" '
  .platforms |= with_entries(
    .value.url = ($dist + (.value.url | split("/") | last))
  )
' "$LATEST_JSON" > "$WORK_DIR/latest.rewritten.json"
mv "$WORK_DIR/latest.rewritten.json" "$LATEST_JSON"

echo "Validating rewritten URLs ..."
if ! jq -e --arg dist "$DIST_BASE" '.platforms | all(.[]; (.url // "") | startswith($dist))' "$LATEST_JSON" >/dev/null; then
  echo "Error: latest.json platform URLs do not point to distribution release."
  exit 1
fi

echo "Checking expected installer artifacts exist ..."
ASSETS_JSON="$(gh api "repos/${DIST_REPO}/releases/tags/${TAG}" 2>/dev/null || true)"
if [[ -z "$ASSETS_JSON" ]]; then
  echo "Distribution release does not exist yet; will create it: ${DIST_REPO}:${TAG}"
else
  echo "Distribution release exists; assets will be replaced: ${DIST_REPO}:${TAG}"
fi

DMG_COUNT="$(find "$WORK_DIR/assets" -maxdepth 1 -type f -name '*.dmg' | wc -l | tr -d ' ')"
WIN_COUNT="$(find "$WORK_DIR/assets" -maxdepth 1 -type f \( -name '*.msi' -o -name '*-setup.exe' \) | wc -l | tr -d ' ')"

if [[ "$DMG_COUNT" -lt 1 ]]; then
  echo "Error: no .dmg files found. At least one macOS installer is expected."
  exit 1
fi

if [[ "$WIN_COUNT" -lt 1 ]]; then
  echo "Warning: no Windows installer found (.msi or *-setup.exe)."
  echo "If this is intentional, continue; otherwise build Windows and re-run."
fi

echo "Creating/updating release in distribution repo ..."
if ! gh release view "$TAG" -R "$DIST_REPO" >/dev/null 2>&1; then
  gh release create "$TAG" -R "$DIST_REPO" --title "$TAG" --notes "Manual distribution release for $TAG"
fi

echo "Generating releases.json snapshot ..."
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
gh api "repos/${DIST_REPO}/releases?per_page=60" > "$WORK_DIR/dist-releases.raw.json"
jq --arg generated_at "$GENERATED_AT" --arg repo "$DIST_REPO" '{
  generated_at: $generated_at,
  repo: $repo,
  releases: (map({
    id,
    tag_name,
    name,
    body,
    html_url,
    published_at,
    prerelease,
    draft,
    assets: ((.assets // []) | map({
      id,
      name,
      browser_download_url,
      size,
      updated_at,
      download_count,
      content_type
    }))
  }) // [])
}' "$WORK_DIR/dist-releases.raw.json" > "$WORK_DIR/assets/releases.json"

echo "Uploading assets to ${DIST_REPO}:${TAG} ..."
gh release upload "$TAG" "$WORK_DIR"/assets/* -R "$DIST_REPO" --clobber

echo "Done."
echo "Distribution release: $(gh release view "$TAG" -R "$DIST_REPO" --json url -q '.url')"

