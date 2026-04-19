#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/upload_release_snapshot.sh <tag> [dist_repo]

Examples:
  scripts/upload_release_snapshot.sh v1.3.0
  scripts/upload_release_snapshot.sh v1.3.0 senoldogann/guardian-distribution

Requirements:
  - gh CLI installed and authenticated
  - jq installed
  - Target release must already exist in the distribution repo
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

TAG="$1"
DIST_REPO="${2:-senoldogann/guardian-distribution}"
RELEASES_PER_PAGE="100"

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

if ! gh release view "$TAG" -R "$DIST_REPO" >/dev/null 2>&1; then
  echo "Error: distribution release '$TAG' not found in '$DIST_REPO'."
  exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/guardian-release-snapshot-${TAG}-XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

RAW_JSON="$WORK_DIR/dist-releases.raw.json"
SNAPSHOT_JSON="$WORK_DIR/releases.json"
VERIFY_DIR="$WORK_DIR/verify"
mkdir -p "$VERIFY_DIR"

echo "Generating releases.json snapshot for ${DIST_REPO}:${TAG} ..."
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
printf '[]\n' > "$RAW_JSON"

PAGE="1"
while true; do
  PAGE_JSON="$WORK_DIR/releases-page-${PAGE}.json"
  gh api "repos/${DIST_REPO}/releases?per_page=${RELEASES_PER_PAGE}&page=${PAGE}" > "$PAGE_JSON"

  PAGE_COUNT="$(jq 'length' "$PAGE_JSON" | tr -d '[:space:]')"
  if [[ "$PAGE_COUNT" == "0" ]]; then
    rm -f "$PAGE_JSON"
    break
  fi

  jq -s 'add' "$RAW_JSON" "$PAGE_JSON" > "$RAW_JSON.tmp"
  mv "$RAW_JSON.tmp" "$RAW_JSON"
  rm -f "$PAGE_JSON"

  if [[ "$PAGE_COUNT" -lt "$RELEASES_PER_PAGE" ]]; then
    break
  fi

  PAGE="$((PAGE + 1))"
done

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
}' "$RAW_JSON" > "$SNAPSHOT_JSON"

gh release upload "$TAG" "$SNAPSHOT_JSON" -R "$DIST_REPO" --clobber >/dev/null
gh release download "$TAG" -R "$DIST_REPO" -p releases.json -D "$VERIFY_DIR" >/dev/null

if [[ ! -s "$VERIFY_DIR/releases.json" ]]; then
  echo "Error: releases.json upload verification failed."
  exit 1
fi

if ! jq -e --arg repo "$DIST_REPO" '.repo == $repo and (.releases | type == "array")' "$VERIFY_DIR/releases.json" >/dev/null; then
  echo "Error: generated releases.json verification failed."
  exit 1
fi

echo "Uploaded releases.json snapshot: https://github.com/${DIST_REPO}/releases/download/${TAG}/releases.json"