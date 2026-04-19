# CI / PR Integration

Guardian ships two complementary automation surfaces:

- Desktop app: interactive monitoring, Guru flows, and editor-first remediation
- `guardian-cli`: headless scanner for PR automation, SARIF upload, and release gating

## What the PR Workflow Does

`.github/workflows/guardian-scan.yml` runs on every pull request to `main`, including dependency and lockfile changes.

It produces:

1. PR summary comment
   - files scanned
   - total findings
   - new findings
   - new critical findings
2. PR gate
   - default policy: block when new critical findings exist
3. SARIF upload
   - uploaded automatically when the token context permits it
4. Standardized gate artifact
   - `guardian-pr-gate-report.json`
   - `guardian-report.json`
   - `guardian.sarif`
   - `guardian-run-manifest.json`
   - `guardian-evidence.json`

Artifact naming follows `guardian-scan-v<version>-<short_sha>` for release traceability.

## Gate Policy

- Critical findings: blocking
- Moderate findings: tracked outside the PR gate policy unless a stricter profile is chosen
- Restricted fork tokens: SARIF upload is skipped automatically, but the PR report artifact is still generated

## Workflow Inputs You May Tune

- `--scan-profile source|extended|full`
- `--offline` for deterministic low-cost CI
- `--pr-gate critical-only|new-only|off`

## Desktop vs CLI

- Desktop app: real-time monitoring + Guru + review loops
- `guardian-cli`: CI-safe scan surface for pull requests, release gates, and standardized artifact generation

