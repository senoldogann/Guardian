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

echo "[verify] Building frontend..."
npm run build

echo "[verify] Installing guardian-vscode dependencies..."
(cd guardian-vscode && npm ci)

echo "[verify] Validating guardian-vscode..."
(cd guardian-vscode && npm run validate)

echo "[verify] Installing website dependencies..."
(cd website && npm ci)

echo "[verify] Validating website..."
(
	cd website
	npm run lint
	npm run copy:check
	npm run test:run
	npm run test:coverage
	npm run build
)

echo "[verify] Running Rust workspace quality gates..."
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo check --workspace
cargo test --workspace

echo "[verify] Running critical dependency audits..."
npm audit --audit-level=critical
(cd guardian-vscode && npm audit --audit-level=critical)
(cd website && npm audit --audit-level=critical)

if ! command -v cargo-audit >/dev/null 2>&1; then
	cargo install cargo-audit --locked
fi
cargo audit

echo "[verify] All checks passed."
