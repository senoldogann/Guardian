# Guardian Moats Implementation Plan

Last Updated: 2026-03-15

## Moat 1 — Governance Replay
- Status: [x] Foundation integrated
- Goal: Historical release decisions can be replayed with current policy to detect decision drift.
- Implementation:
  - `scripts/governance_replay.py`
  - Output: `.guardian/governance-replay/<date>/replay_summary.{json,md}`
- Next:
  - [ ] Compare replay drift against real production incidents
  - [ ] Auto-open policy tuning tasks when drift > threshold

## Moat 2 — Override Debt Ledger
- Status: [x] Foundation integrated
- Goal: Every override is tracked as governance debt with due date and reason quality.
- Implementation:
  - `scripts/override_debt_ledger.py`
  - Output: `.guardian/override_debt_ledger.{json,md}`
- Next:
  - [ ] Integrate ticket linking (`follow_up_ticket`)
  - [ ] Escalation for weak/missing reason quality

## Moat 3 — Dual-AI Adversarial Review
- Status: [ ] Planned
- Goal: A second reviewer model challenges first-pass findings before surfacing.
- Phase Tasks:
  - [ ] Add challenge lane config (`GUARDIAN_CHALLENGE_PROVIDER`, `GUARDIAN_CHALLENGE_MODEL`)
  - [ ] Add consensus/contest schema (`accepted`, `contested`, `rejected`)
  - [ ] Add latency budget + timeout fallback

## Moat 4 — Patch-Proof Suggestions
- Status: [ ] Planned
- Goal: Show fix suggestions only after compile/test smoke validation.
- Phase Tasks:
  - [ ] Run language-aware dry checks (Rust/TS/Python) in sandbox
  - [ ] Attach verification status to suggestion payload (`verified` / `unverified`)
  - [ ] Block one-click apply when verification fails

## Moat 5 — Release Decision Receipt
- Status: [ ] Planned
- Goal: Produce signed immutable receipt for each release decision.
- Phase Tasks:
  - [ ] Add canonical receipt payload (policy hash + approver + reasons + evidence refs)
  - [ ] Hash/sign receipt and persist under `.guardian/receipts/`
  - [ ] Verify receipt in CI gate before publish

## Integration Hook
- Weekly governance workflow now runs:
  - dashboard-lite report
  - governance replay
  - override debt ledger
  via `scripts/pilot_generate_weekly_report.sh`.
