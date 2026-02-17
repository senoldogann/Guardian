#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/publish_distribution.sh <tag> <artifacts_dir> [dist_repo]
  scripts/publish_distribution.sh <tag> [source_repo] [dist_repo]

Examples:
  # Local release mode (recommended)
  scripts/publish_distribution.sh v0.2.7 /path/to/guardian-artifacts
  scripts/publish_distribution.sh v0.2.7 /path/to/guardian-artifacts senoldogann/guardian-distribution

  # Legacy: mirror from source repo release tag
  scripts/publish_distribution.sh v0.2.6
  scripts/publish_distribution.sh v0.2.6 senoldogann/Guardian senoldogann/guardian-distribution

Defaults:
  source_repo = senoldogann/Guardian
  dist_repo   = senoldogann/guardian-distribution

Requirements:
  - gh CLI installed and authenticated
  - Permission to read source repo releases
  - Permission to create/upload releases in distribution repo
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

TAG="$1"

# Local release mode: if arg2 is a directory, publish from local artifacts.
if [[ -n "${2:-}" && -d "$2" ]]; then
  ARTIFACTS_DIR="$2"
  DIST_REPO="${3:-senoldogann/guardian-distribution}"
  exec "$(cd "$(dirname "$0")" && pwd)/publish_distribution_local.sh" "$TAG" "$ARTIFACTS_DIR" "$DIST_REPO"
fi

SOURCE_REPO="${2:-senoldogann/Guardian}"
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

if ! gh release view "$TAG" -R "$SOURCE_REPO" >/dev/null 2>&1; then
  echo "Error: source release '$TAG' not found in '$SOURCE_REPO'."
  exit 1
fi

DEFAULT_BRANCH="$(gh repo view "$DIST_REPO" --json defaultBranchRef -q '.defaultBranchRef.name // ""' 2>/dev/null || true)"
if [[ -z "$DEFAULT_BRANCH" ]]; then
  echo "Error: distribution repo '$DIST_REPO' appears empty (no default branch)."
  echo "Create an initial commit in '$DIST_REPO' first, then rerun."
  exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/guardian-dist-${TAG}-XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Downloading assets from $SOURCE_REPO:$TAG ..."
mkdir -p "$WORK_DIR/assets"
gh release download "$TAG" -R "$SOURCE_REPO" -D "$WORK_DIR/assets"

echo "Validating source release assets ..."
gh release view "$TAG" -R "$SOURCE_REPO" --json assets > "$WORK_DIR/source-assets.json"

if ! jq -e '.assets | any(.[]; (.name | test("aarch64.*\\.dmg$|arm64.*\\.dmg$|_aarch64\\.dmg$")))' "$WORK_DIR/source-assets.json" >/dev/null; then
  echo "Error: source release is missing macOS Apple Silicon DMG."
  exit 1
fi

if ! jq -e '.assets | any(.[]; (.name | test("x86_64.*\\.dmg$|intel.*\\.dmg$|_x64\\.dmg$")))' "$WORK_DIR/source-assets.json" >/dev/null; then
  echo "Error: source release is missing macOS Intel DMG."
  exit 1
fi

if ! jq -e '.assets | any(.[]; (.name | endswith(".msi") or endswith("-setup.exe")))' "$WORK_DIR/source-assets.json" >/dev/null; then
  echo "Error: source release is missing Windows installer (.msi or setup.exe)."
  exit 1
fi

if ! jq -e '.assets | any(.[]; .name == "latest.json")' "$WORK_DIR/source-assets.json" >/dev/null; then
  echo "Error: source release is missing latest.json updater metadata."
  exit 1
fi

if ! jq -e '.assets | all(.[]; (.name == "latest.json") or ((.digest // "") | startswith("sha256:")))' "$WORK_DIR/source-assets.json" >/dev/null; then
  echo "Error: one or more source assets are missing sha256 digest metadata."
  exit 1
fi

echo "Preparing release notes ..."
gh release view "$TAG" -R "$SOURCE_REPO" --json body -q '.body // ""' > "$WORK_DIR/RELEASE_NOTES.md"

LATEST_JSON="$WORK_DIR/assets/latest.json"
if [[ -f "$LATEST_JSON" ]]; then
  echo "Rewriting latest.json URLs for distribution repo ..."
  SOURCE_BASE="https://github.com/${SOURCE_REPO}/releases/download/${TAG}/"
  DIST_BASE="https://github.com/${DIST_REPO}/releases/download/${TAG}/"

  jq --arg source "$SOURCE_BASE" --arg dist "$DIST_BASE" '
    .platforms |= with_entries(
      if ((.value.url // "") | startswith($source)) then
        .value.url = ($dist + (.value.url | ltrimstr($source)))
      else
        .
      end
    )
  ' "$LATEST_JSON" > "$WORK_DIR/latest.rewritten.json"
  mv "$WORK_DIR/latest.rewritten.json" "$LATEST_JSON"
fi

if [[ ! -f "$LATEST_JSON" ]]; then
  echo "Error: latest.json not found in downloaded assets."
  exit 1
fi

echo "Validating latest.json metadata ..."
if ! jq -e --arg version "${TAG#v}" '.version == $version or .version == ("v" + $version)' "$LATEST_JSON" >/dev/null; then
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

if ! gh release view "$TAG" -R "$DIST_REPO" >/dev/null 2>&1; then
  echo "Creating release $TAG in $DIST_REPO ..."
  gh release create "$TAG" -R "$DIST_REPO" --title "$TAG" --notes-file "$WORK_DIR/RELEASE_NOTES.md"
else
  echo "Release $TAG already exists in $DIST_REPO; assets will be replaced."
fi

echo "Uploading assets to $DIST_REPO:$TAG ..."
rm -f "$WORK_DIR/assets/releases.json" || true
gh release upload "$TAG" "$WORK_DIR"/assets/* -R "$DIST_REPO" --clobber

echo "Generating releases.json snapshot (post-upload) ..."
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

echo "Uploading releases.json snapshot ..."
gh release upload "$TAG" "$WORK_DIR/assets/releases.json" -R "$DIST_REPO" --clobber >/dev/null

if gh release download "$TAG" -R "$DIST_REPO" -p latest.json -D "$WORK_DIR" >/dev/null 2>&1; then
  if grep -q "https://github.com/${SOURCE_REPO}/releases/download/${TAG}/" "$WORK_DIR/latest.json"; then
    echo "Error: latest.json in distribution release still references source repo URLs."
    exit 1
  fi

  DIST_BASE="https://github.com/${DIST_REPO}/releases/download/${TAG}/"
  if ! jq -e --arg dist "$DIST_BASE" '.platforms | all(.[]; (.url // "") | startswith($dist))' "$WORK_DIR/latest.json" >/dev/null; then
    echo "Error: latest.json platform URLs do not point to distribution release."
    exit 1
  fi
fi

SRC_COUNT="$(gh release view "$TAG" -R "$SOURCE_REPO" --json assets -q '.assets | length')"
DIST_COUNT="$(gh release view "$TAG" -R "$DIST_REPO" --json assets -q '.assets | length')"
DIST_URL="$(gh release view "$TAG" -R "$DIST_REPO" --json url -q '.url')"

if [[ "$DIST_COUNT" -lt 6 ]]; then
  echo "Error: distribution release has too few assets (${DIST_COUNT})."
  exit 1
fi

echo "Done."
echo "Source assets: $SRC_COUNT"
echo "Distribution assets: $DIST_COUNT"
echo "Distribution release: $DIST_URL"
