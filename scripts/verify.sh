#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

echo "[verify] Running secret scan..."
bash scripts/secret_scan.sh

echo "[verify] Checking formatting..."
npm run format:check

echo "[verify] Running lint checks..."
npm run lint

echo "[verify] Running unit/integration tests..."
npm run test

echo "[verify] Running coverage + gate..."
npm run test:coverage
npm run coverage:gate

echo "[verify] Running E2E tests..."
npm run test:e2e

echo "[verify] Building frontend..."
npm run build

echo "[verify] Running Rust checks/tests..."
(cd src-tauri && cargo check)
(cd src-tauri && cargo test)

echo "[verify] All checks passed."
