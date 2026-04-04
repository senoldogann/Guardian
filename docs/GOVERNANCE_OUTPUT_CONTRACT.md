# Governance Output Contract

This document defines the canonical outputs Guardian writes under `.guardian/` so humans, CLI jobs, IDE views, and LLM agents can consume the same decision surface.

## Runtime Artifacts
- `.guardian/critiques.json`
  - Active findings snapshot.
  - Machine-readable source of truth for current monitor view.
- `.guardian/release_gate_report.json`
  - Latest CLI gate decision (`PASS`, `PASS_WITH_WARNING`, `BLOCK_UNTIL_APPROVED`, `OVERRIDDEN`).
  - Includes policy path, reasons, and override metadata.
- `.guardian/release_decisions.jsonl`
  - Append-only audit trail for approvals/overrides.
  - Used for compliance review and weekly governance analytics.
  - Legacy rows that predate `action`, `critical_findings`, `warning_findings`, or `policy_path` are still readable with default values so manual approval state is not lost during upgrades.
- `.guardian/governance_summary.json`
  - Unified cross-consumer summary (counts + recommendation + finding list + consumer guides).
- `.guardian/governance_summary.md`
  - Human-friendly equivalent summary.

## Consumer Rules
- IDE
  - Prioritize `Critical` rows.
  - Surface recommendation from `governance_summary.json.summary.release_recommendation`.
- CLI/CI
  - Use `guardian-cli scan --release-gate strict --format json --out .guardian/release_gate_report.json`.
  - Block deploy when decision is `BLOCK_UNTIL_APPROVED`.
- LLM Agents
  - Read `critiques.json` + `release_gate_report.json` + `governance_summary.json` first.
  - Never auto-approve release based only on fix suggestions.

## Decision Engine Semantics
- `PASS`
  - No blocking policy condition is active.
  - No warnings above policy threshold and no pending AI-heavy approval requirement.
  - CLI exit code is `0` in `strict|warn|off`.
- `PASS_WITH_WARNING`
  - Policy gate passed, but warning debt exists or an AI-heavy change was manually approved.
  - Requires explicit human review discipline, but publish is allowed.
  - CLI exit code is `0` in `strict|warn|off`.
- `BLOCK_UNTIL_APPROVED`
  - At least one blocker is active:
    - `block_on_critical=true` and one or more `Critical` findings exist.
    - warning count exceeds `pass_max_warnings`.
    - `require_human_approval_on_ai_heavy=true`, current intake is AI-heavy, and no manual approval exists.
  - CLI exit code is `1` in `--release-gate strict`, `0` in `warn|off`.
- `OVERRIDDEN`
  - A human approver explicitly overrides a blocked release with a non-empty reason when policy requires one.
  - Override metadata is persisted to `.guardian/release_decisions.jsonl` and surfaced in `.guardian/release_gate_report.json`.
  - CLI exit code is `0` in `strict|warn|off`.

## Approval State Rules
- Desktop reads active critiques first; if memory state is empty, it falls back to `.guardian/critiques.json`.
- `set_release_decision` can record `PASS` or `PASS_WITH_WARNING`, but not `OVERRIDDEN`.
- `override_release_block` is the only valid desktop path for `OVERRIDDEN` and requires both `approver` and a non-empty `reason`.
- Latest audit record wins when rebuilding the current desktop decision view.
- Fix suggestions never imply approval by themselves; release state changes only through manual approval/override actions.
- Team approver roles, override scope, and reason quality bar are defined in [`/Users/dogan/Desktop/guardian/docs/RELEASE_APPROVAL_POLICY.md`](/Users/dogan/Desktop/guardian/docs/RELEASE_APPROVAL_POLICY.md).

## Weekly Governance Extensions
- `scripts/generate_governance_summary.py`
  - Generates `.guardian/governance_summary.{json,md}` from latest critiques snapshot.
- `scripts/governance_replay.py`
  - Replays historical gate reports against current policy to detect decision drift.
- `scripts/override_debt_ledger.py`
  - Builds debt ledger for override follow-up governance.
