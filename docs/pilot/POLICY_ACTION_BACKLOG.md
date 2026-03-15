# Pilot Policy Action Backlog

Last Updated: 2026-03-14 23:54:22Z
Scope: Shadow rehearsal + real manifest dry-run (`design-partner-a`, `design-partner-b`, `design-partner-c`, `design-partner-core`)

## Evidence Inputs

- Dry-run summary: `.guardian/pilot-dryrun/2026-03-14/summary.json`
- Real dry-run summary: `.guardian/pilot-dryrun-real/2026-03-14/summary.json`
- Repo reports:
  - `.guardian/pilot-shadow-repos/design-partner-a/.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-shadow-repos/design-partner-b/.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-shadow-repos/design-partner-c/.guardian/pilot-reports/2026-03-14/dashboard_lite.json`
  - `.guardian/pilot-reports/2026-03-14/dashboard_lite.json`

## Priority Backlog

- [ ] Tune `ai_heavy_requires_human_approval` threshold with real pilot PR samples to reduce false positives.
- [x] Add stronger rule mapping for `override.reason` to classify policy packs/rules beyond fallback `api_backend_guardrail`.
- [x] Add audit writer in CLI dry-run path so dashboard-lite can read historical override coverage from `release_decisions.jsonl`.
- [ ] Create weekly owner rotation for reviewing `BLOCK_UNTIL_APPROVED` outcomes and follow-up actions.
- [ ] Define minimum acceptable override quality policy (`strong >= 95%`) before strict rollout in real design-partner repos.

## Ready For Real Pilot

- [x] `PASS_WITH_WARNING` scenario rehearsal complete.
- [x] `BLOCK_UNTIL_APPROVED` scenario rehearsal complete.
- [x] `OVERRIDDEN` scenario rehearsal complete.
- [x] Real design-partner repo manifests imported.
- [x] Real approver roster confirmed.
