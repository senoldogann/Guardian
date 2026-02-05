#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

echo "[verify] Running unit/integration tests..."
npm run test

echo "[verify] Running E2E tests..."
npm run test:e2e

echo "[verify] Building frontend..."
npm run build

echo "[verify] Running Rust checks/tests..."
(cd src-tauri && cargo check)
(cd src-tauri && cargo test)

echo "[verify] All checks passed."
