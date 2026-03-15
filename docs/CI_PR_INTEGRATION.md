# CI / PR Integration (Optional)

Guardian is a **desktop-first** product. Most users only need the desktop app.

For teams that want Guardian checks in **Pull Requests** (and optionally in the GitHub **Security** tab), we provide a small CLI called **`guardian-cli`** that is designed for CI.

## Who Needs This?
- **Desktop-only users:** you can ignore this document.
- **Teams using GitHub PRs:** this enables a PR summary comment + optional SARIF upload.

## What You Get
1. **PR summary comment**
   - Counts: files scanned, total findings, new findings, new critical
   - Top new findings list (fast triage)
2. **PR gate**
   - Default: fail the workflow only if **new Critical** findings exist
3. **SARIF upload (optional)**
   - Findings appear under GitHub **Security / Code scanning**

## Setup (GitHub Actions)
We keep a ready-to-copy workflow template in this repo:
- `.github/workflows/guardian-scan.yml`

In your own repo, copy that workflow file as-is, then adjust:
- `--scan-profile source|extended|full`
- `--offline` (recommended for cost control) vs cloud provider mode
- `--pr-gate critical-only|new-only|off`

### Notes on Cloud Providers in CI
If you want AI-backed findings in CI:
- Set provider/model/api key via GitHub Secrets (recommended).
- Keep concurrency low and prefer `source` profile to control costs.

## Desktop vs CLI
- Desktop app: real-time monitoring + Guru + reviews, optimized for interactive use.
- `guardian-cli`: headless scanner for CI/PR automation.

