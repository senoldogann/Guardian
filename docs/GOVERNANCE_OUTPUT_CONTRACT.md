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

## Weekly Governance Extensions
- `scripts/generate_governance_summary.py`
  - Generates `.guardian/governance_summary.{json,md}` from latest critiques snapshot.
- `scripts/governance_replay.py`
  - Replays historical gate reports against current policy to detect decision drift.
- `scripts/override_debt_ledger.py`
  - Builds debt ledger for override follow-up governance.
