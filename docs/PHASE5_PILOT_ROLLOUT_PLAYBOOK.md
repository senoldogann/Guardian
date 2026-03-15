# Phase 5 Pilot Rollout Playbook

This playbook operationalizes Faz 5 for 2-3 design-partner teams.

## Goal

Run Guardian as a release decision control layer in pilot repos and produce weekly governance evidence.

## Scope

- Product mode: desktop + CLI (local/private-first)
- Decision model: `PASS`, `PASS_WITH_WARNING`, `BLOCK_UNTIL_APPROVED`, `OVERRIDDEN`
- Policy source-of-truth: `guardian.policy.yaml` in each pilot repo

## Entry Gate Checklist

- [ ] Faz 4 CI jobs merged on default branch:
  - `.github/workflows/ci-cd-v1.yml` `release-gate-ci-smoke`
  - `.github/workflows/release-windows.yml` `release-gate`
- [x] Pilot repos confirmed (minimum 2 repos)
- [x] Team approver list confirmed (who can approve/override)
- [x] Initial `guardian.policy.yaml` reviewed per repo

Latest real dry-run snapshot (2026-03-14):
- Manifest: `docs/pilot/PILOT_REPO_MANIFEST.real.json` (4 repos, absolute paths)
- Readiness: `.guardian/pilot-real-readiness/2026-03-14/readiness.json` -> `READY`
- Dry-run summary: `.guardian/pilot-dryrun-real/2026-03-14/summary.json` (`allowed=2`, `blocked=1`, `overridden=1`, `errors=0`)
- Leak cases: `.guardian/pilot-leak-cases-real/2026-03-14/leak_cases.json` (`prevented_release=1`, `controlled_override=1`)

## Pilot Steps Per Repo

1. Baseline preparation
   - Ensure policy exists and reflects team risk tolerance.
   - Run local gate-only rehearsal:
     - `scripts/release_all_local.sh --gate-only`
2. Dry-run period (recommended 1 week)
   - Keep CI release-gate active.
   - Collect decisions and override reasons.
3. Strict rollout
   - Require release gate in release workflow.
   - Block publish on `BLOCK_UNTIL_APPROVED`.
4. Weekly report generation and storage
   - Use:
     - `GUARDIAN_PILOT_TEAM=<team> GUARDIAN_PILOT_REPO=<repo> scripts/pilot_generate_weekly_report.sh /abs/repo/path`
   - Outputs:
     - `.guardian/pilot-reports/<YYYY-MM-DD>/dashboard_lite.json`
     - `.guardian/pilot-reports/<YYYY-MM-DD>/dashboard_lite.md`

## Multi-Repo Dry-Run (Orchestration)

Use a manifest to run strict release-gate dry-run across pilot repos in one command.

1. Copy the example manifest:
   - `docs/pilot/PILOT_REPO_MANIFEST.example.json` -> `docs/pilot/PILOT_REPO_MANIFEST.json`
2. Fill absolute repo paths and optional approver/override fields.
3. Run:
   - `python3 scripts/pilot_dryrun.py --manifest docs/pilot/PILOT_REPO_MANIFEST.json --cli-bin guardian-cli/target/release/guardian-cli`
   - If your manifest lives outside repo root, add:
     - `--repo-base-dir /absolute/path/that/relative/repo/paths/should/use`

Outputs:
- `.guardian/pilot-dryrun/<YYYY-MM-DD>/summary.json`
- `.guardian/pilot-dryrun/<YYYY-MM-DD>/summary.md`

Optional:
- add `--fail-on-block` to return exit code `1` when any repo is blocked.

## Real Pilot Readiness Validation

Use this before real design-partner dry-run start.

1. Copy templates:
   - `docs/pilot/PILOT_REPO_MANIFEST.real.template.json` -> `docs/pilot/PILOT_REPO_MANIFEST.real.json`
   - `docs/pilot/APPROVER_ROSTER.template.json` -> `docs/pilot/APPROVER_ROSTER.json`
   - Note: these working files are already created in repo and ready to edit.
2. Fill:
   - absolute repo paths
   - approver ids (must exist in roster and `can_override=true`)
3. Run:
   - `python3 scripts/pilot_validate_readiness.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --approver-roster docs/pilot/APPROVER_ROSTER.json`

Outputs:
- `.guardian/pilot-real-readiness/<YYYY-MM-DD>/readiness.json`
- `.guardian/pilot-real-readiness/<YYYY-MM-DD>/readiness.md`

Status rule:
- `READY` -> no blockers, real strict dry-run can start.
- `BLOCKED` -> fix blockers first (missing policy, missing approver, invalid path, roster mismatch).

Autopilot (zero manual setup for shadow repos):
- `scripts/pilot_autopilot.sh`
- This prepares shadow pilot repos, runs dry-run, and writes weekly reports automatically.
- Default shadow manifest includes 3 sample outcomes:
  - `PASS_WITH_WARNING`
  - `BLOCK_UNTIL_APPROVED`
  - `OVERRIDDEN`

## Override Reason Quality Rubric

- `strong`
  - Contains clear risk context + action context.
  - Example: production incident, mitigation/hotfix, and validation/rollback detail.
- `weak`
  - Too short or generic.
  - Example: "urgent fix", "needs release now".
- `missing`
  - Empty or absent reason.

Guardian dashboard-lite reports these buckets under `override_reason_quality`.

## Weekly Operating Cadence

1. Generate weekly reports for each pilot repo.
2. Review KPI snapshot:
   - block rate
   - override coverage
   - override reason coverage
   - top policy rule/pack signals
3. Create action items for top recurring policy violations.
   - Keep actions in: `docs/pilot/POLICY_ACTION_BACKLOG.md`
4. Track prevented release leaks (incidents blocked pre-release).
   - Generate case list:
     - `python3 scripts/pilot_collect_leak_prevented_cases.py --summary-dir .guardian/pilot-dryrun`
   - Outputs:
     - `.guardian/pilot-leak-cases/<YYYY-MM-DD>/leak_cases.json`
     - `.guardian/pilot-leak-cases/<YYYY-MM-DD>/leak_cases.md`
5. Validate CI/release gate wiring before real rollout:
   - `python3 scripts/pilot_validate_ci_gate_flow.py --ci-workflow .github/workflows/ci-cd-v1.yml --release-workflow .github/workflows/release-windows.yml`
   - Outputs:
     - `.guardian/pilot-ci-gate-validation/<YYYY-MM-DD>/ci_gate_validation.json`
     - `.guardian/pilot-ci-gate-validation/<YYYY-MM-DD>/ci_gate_validation.md`
6. Aggregate cross-repo weekly trend for exit-gate evidence:
   - `scripts/pilot_generate_rollout_trend.sh docs/pilot/PILOT_REPO_MANIFEST.real.json`
   - Optional strict gate for reporting completeness:
     - `python3 scripts/pilot_rollout_trend.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --min-weeks 4 --fail-on-exit-gate`
   - Outputs:
     - `.guardian/pilot-rollout-trend/<YYYY-MM-DD>/rollout_trend.json`
     - `.guardian/pilot-rollout-trend/<YYYY-MM-DD>/rollout_trend.md`
7. Generate AI-heavy threshold calibration recommendation from pilot evidence:
   - `scripts/pilot_generate_ai_heavy_calibration.sh docs/pilot/PILOT_REPO_MANIFEST.real.json`
   - Outputs:
     - `.guardian/pilot-calibration/<YYYY-MM-DD>/ai_heavy_calibration.json`
     - `.guardian/pilot-calibration/<YYYY-MM-DD>/ai_heavy_calibration.md`
   - Use recommendation as policy-tuning input; apply threshold constant changes only after multi-week stability review.

## Exit Gate Evidence (Pilot Completion)

- [ ] At least 2 pilot repos ran strict gate stably.
- [ ] Override reason coverage >= 95%.
- [ ] Monthly trend documented for block rate and top policy signals.
- [ ] At least one critical pre-release leak prevention case recorded.

## Completion Log Template

- Completion Date:
- Owner:
- Pilot Repos:
- Completed Items:
- KPI Summary:
- Evidence (reports/links):
- Blockers:
- Next Phase Decision:
