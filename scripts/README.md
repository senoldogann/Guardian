# Scripts Reference

Utility and automation scripts for the Guardian project.

## Categories

- **Build** — Compilation, bundling, artifact collection
- **Release** — Versioning, publishing, distribution
- **Testing** — Test runners, coverage, benchmarks
- **Dev** — Local development, project setup, debugging
- **CI** — Continuous integration helpers
- **Maestro / Agent Infra** — Provider management, skill registry, agent sync
- **Pilot / Rollout** — Feature rollout, readiness checks, weekly ops
- **Governance** — Policy enforcement, auditing, telemetry

---

## Build

| Script | Description | Usage |
|--------|-------------|-------|
| `build_release.sh` | Build a release bundle | `bash scripts/build_release.sh` |
| `collect_macos_artifacts.sh` | Collect macOS (arm64+intel) build artifacts for a tag | `scripts/collect_macos_artifacts.sh <tag> <out_dir> <arm_dir> <intel_dir>` |
| `write_tauri_latest_json.sh` | Generate Tauri `latest.json` update manifest | `bash scripts/write_tauri_latest_json.sh` |
| `merge_latest_json.sh` | Merge per-platform `latest.json` files into one | `scripts/merge_latest_json.sh <tag> <output> <json...>` |

## Release

| Script | Description | Usage |
|--------|-------------|-------|
| `bump_version.sh` | Bump project version (patch/minor/major) | `bash scripts/bump_version.sh patch` |
| `release_local.sh` | Create a local release from build artifacts | `scripts/release_local.sh <tag> <artifacts_dir> [dist_repo]` |
| `release_all_local.sh` | Full local release pipeline (all platforms) | `bash scripts/release_all_local.sh` |
| `publish_distribution.sh` | Publish release to the distribution repo | `bash scripts/publish_distribution.sh` |
| `publish_distribution_local.sh` | Publish release locally (no remote push) | `bash scripts/publish_distribution_local.sh` |

## Testing

| Script | Description | Usage |
|--------|-------------|-------|
| `coverage_gate.mjs` | Enforce minimum test-coverage thresholds | `node scripts/coverage_gate.mjs` |
| `verify.sh` | Quick project health check (lint + test) | `bash scripts/verify.sh` |
| `verify_all.py` | Comprehensive verification (tests, lint, validators) | `python3 scripts/verify_all.py` |
| `verify_audit.py` | Audit dependencies for known vulnerabilities | `python3 scripts/verify_audit.py` |
| `review_precision_benchmark.py` | Benchmark code-review precision metrics | `python3 scripts/review_precision_benchmark.py` |
| `run_eval_suite.py` | Run the full evaluation suite | `python3 scripts/run_eval_suite.py` |
| `secret_scan.sh` | Scan the repo for leaked secrets | `bash scripts/secret_scan.sh` |

## Dev

| Script | Description | Usage |
|--------|-------------|-------|
| `init-project.sh` | Bootstrap a new Guardian project (shell) | `bash scripts/init-project.sh` |
| `init_project.py` | Bootstrap a new Guardian project (Python) | `python3 scripts/init_project.py` |
| `quickstart.py` | Interactive setup wizard | `python3 scripts/quickstart.py` |
| `setup-runner.sh` | Configure a self-hosted CI runner | `bash scripts/setup-runner.sh` |
| `decode_jwt.py` | Decode and inspect a JWT token | `python3 scripts/decode_jwt.py` |
| `dependency_analyzer.py` | Analyze project dependency graph | `python3 scripts/dependency_analyzer.py` |
| `common_utils.py` | Shared Python utilities (ANSI colors, helpers) | Imported by other scripts |
| `checklist.py` | Generate/validate project checklists | `python3 scripts/checklist.py` |

## CI

| Script | Description | Usage |
|--------|-------------|-------|
| `ci/release_gate_ci_smoke.sh` | Smoke test gate before CI releases | `bash scripts/ci/release_gate_ci_smoke.sh` |
| `ci/render_guardian_pr_comment.mjs` | Render a Guardian report as a PR comment | `node scripts/ci/render_guardian_pr_comment.mjs <report.json>` |

## Maestro / Agent Infrastructure

| Script | Description | Usage |
|--------|-------------|-------|
| `sync_agents.py` | Sync agent definitions after rule/skill changes | `python3 scripts/sync_agents.py` |
| `bootstrap_providers.py` | Select and initialize provider packs | `python3 scripts/bootstrap_providers.py --profile <name>` |
| `apply_skill_profile.py` | Apply the curated skill surface profile | `python3 scripts/apply_skill_profile.py` |
| `build_skill_registry.py` | Rebuild the active skill registry | `python3 scripts/build_skill_registry.py` |
| `skill.sh` | Ensure/acquire a skill by name or query | `bash scripts/skill.sh ensure "<query>"` |
| `skill_router_cli.py` | Deterministic skill routing for a task | `python3 scripts/skill_router_cli.py --query "<task>"` |
| `skill_profile_support.py` | Skill profile support utilities | `python3 scripts/skill_profile_support.py` |
| `skill_profile_validator.py` | Validate skill profile configuration | `python3 scripts/skill_profile_validator.py` |
| `skill_registry_validator.py` | Validate skill registry integrity | `python3 scripts/skill_registry_validator.py` |
| `generate_skill_index.py` | Generate `SKILL_INDEX.md` from skills directory | `python3 scripts/generate_skill_index.py` |
| `eval_registry_validator.py` | Validate eval registry definitions | `python3 scripts/eval_registry_validator.py` |
| `fix_agent_tools.py` | Fix agent tool definitions in `.maestro/agents/` | `python3 scripts/fix_agent_tools.py` |
| `context_optimizer.py` | Smart rule loading / context optimization | `python3 scripts/context_optimizer.py` |
| `prune_memory.py` | Prune stale agent memory entries | `python3 scripts/prune_memory.py` |
| `provider_config_validator.py` | Validate provider configurations | `python3 scripts/provider_config_validator.py` |
| `provider_doc_radar.py` | Track provider documentation drift | `python3 scripts/provider_doc_radar.py refresh` |
| `provider_radar_validator.py` | Validate provider radar data | `python3 scripts/provider_radar_validator.py` |
| `provider_smoke_matrix.py` | Run provider smoke tests across adapters | `python3 scripts/provider_smoke_matrix.py` |
| `maestro_telemetry.py` | Structured execution telemetry | `python3 scripts/maestro_telemetry.py` |

### Codex Wrappers

| Script | Description | Usage |
|--------|-------------|-------|
| `codex-fast.sh` | Run Codex in fast mode | `bash scripts/codex-fast.sh` |
| `codex-research.sh` | Run Codex in research mode | `bash scripts/codex-research.sh` |
| `codex-review.sh` | Run Codex in review mode | `bash scripts/codex-review.sh` |
| `codex-safe.sh` | Run Codex in safe mode | `bash scripts/codex-safe.sh` |

## Pilot / Rollout

| Script | Description | Usage |
|--------|-------------|-------|
| `pilot_autopilot.sh` | Automated pilot rollout orchestration | `bash scripts/pilot_autopilot.sh` |
| `pilot_dryrun.py` | Simulate a pilot rollout (dry run) | `python3 scripts/pilot_dryrun.py` |
| `pilot_validate_readiness.py` | Validate pilot readiness criteria | `python3 scripts/pilot_validate_readiness.py` |
| `pilot_validate_ci_gate_flow.py` | Validate CI gate flow for pilot | `python3 scripts/pilot_validate_ci_gate_flow.py` |
| `pilot_exit_gate_check.py` | Check pilot exit gate conditions | `python3 scripts/pilot_exit_gate_check.py` |
| `pilot_rollout_trend.py` | Analyze pilot rollout trends | `python3 scripts/pilot_rollout_trend.py` |
| `pilot_generate_rollout_trend.sh` | Generate rollout trend report | `bash scripts/pilot_generate_rollout_trend.sh` |
| `pilot_ai_heavy_calibration.py` | AI-heavy pilot calibration analysis | `python3 scripts/pilot_ai_heavy_calibration.py` |
| `pilot_generate_ai_heavy_calibration.sh` | Generate AI calibration report | `bash scripts/pilot_generate_ai_heavy_calibration.sh` |
| `pilot_collect_leak_prevented_cases.py` | Collect cases where leaks were prevented | `python3 scripts/pilot_collect_leak_prevented_cases.py` |
| `pilot_generate_weekly_report.sh` | Generate weekly pilot report | `bash scripts/pilot_generate_weekly_report.sh` |
| `pilot_weekly_ops.sh` | Weekly pilot operations runner | `bash scripts/pilot_weekly_ops.sh` |

## Governance

| Script | Description | Usage |
|--------|-------------|-------|
| `policy_guard.py` | Enforce policy rules programmatically | `python3 scripts/policy_guard.py` |
| `governance_replay.py` | Replay governance decisions for auditing | `python3 scripts/governance_replay.py` |
| `generate_governance_summary.py` | Generate governance summary report | `python3 scripts/generate_governance_summary.py` |
| `generate_dashboard_lite.py` | Generate a lightweight project dashboard | `python3 scripts/generate_dashboard_lite.py` |
| `override_debt_ledger.py` | Manage technical-debt override ledger | `python3 scripts/override_debt_ledger.py` |

---

## Scripts in `package.json`

The following scripts are already wired into `npm run`:

| npm command | Maps to |
|-------------|---------|
| `npm run version:bump` | `scripts/bump_version.sh patch` |
| `npm run version:minor` | `scripts/bump_version.sh minor` |
| `npm run version:major` | `scripts/bump_version.sh major` |
| `npm run coverage:gate` | `scripts/coverage_gate.mjs` |
| `npm run verify` | `scripts/verify.sh` |

### Candidates not yet in `package.json`

These scripts could benefit from npm aliases but were **not** added automatically:

- `scripts/secret_scan.sh` → e.g. `"secret:scan"`
- `scripts/verify_all.py` → e.g. `"verify:all"`
- `scripts/verify_audit.py` → e.g. `"verify:audit"`
- `scripts/build_release.sh` → e.g. `"build:release"`
- `scripts/release_local.sh` → e.g. `"release:local"`
- `scripts/dependency_analyzer.py` → e.g. `"deps:analyze"`
