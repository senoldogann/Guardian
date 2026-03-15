# Pilot Rollout Status - 2026-03-15

## Scope
- Manifest: `docs/pilot/PILOT_REPO_MANIFEST.real.json`
- Roster: `docs/pilot/APPROVER_ROSTER.json`
- Window: 7 days

## Executed
- `python3 scripts/pilot_validate_readiness.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --approver-roster docs/pilot/APPROVER_ROSTER.json --output-dir .guardian/pilot-real-readiness`
- `python3 scripts/pilot_dryrun.py --manifest docs/pilot/PILOT_REPO_MANIFEST.real.json --summary-dir .guardian/pilot-dryrun-real --cli-bin guardian-cli/target/release/guardian-cli`
- Weekly report generation:
  - `scripts/pilot_generate_weekly_report.sh /Users/dogan/Desktop/guardian/.guardian/pilot-shadow-repos/design-partner-a`
  - `scripts/pilot_generate_weekly_report.sh /Users/dogan/Desktop/guardian/.guardian/pilot-shadow-repos/design-partner-b`
  - `scripts/pilot_generate_weekly_report.sh /Users/dogan/Desktop/guardian/.guardian/pilot-shadow-repos/design-partner-c`
  - `scripts/pilot_generate_weekly_report.sh /Users/dogan/Desktop/guardian`
- Rollout trend aggregation:
  - `scripts/pilot_generate_rollout_trend.sh docs/pilot/PILOT_REPO_MANIFEST.real.json`
- AI-heavy threshold calibration:
  - `scripts/pilot_generate_ai_heavy_calibration.sh docs/pilot/PILOT_REPO_MANIFEST.real.json`

## Results
- Readiness: `READY` (blockers=0, warnings=0)
- Strict dry-run totals:
  - repos=4
  - allowed=3
  - blocked=0
  - overridden=1
  - errors=0
- Override reason quality (core repo):
  - strong=1
  - weak=0
  - missing=0
  - override_reason_coverage=1.0
- Rollout trend snapshot:
  - weeks=2 (`2026-03-14`, `2026-03-15`)
  - block_rate_direction=decreasing
  - ai_heavy_direction=increasing
  - strict_gate_active_stable=true (repos=4)
  - override_reason_coverage_met=true (coverage=1.0, threshold=0.95)
  - block_rate_trend_reported=false (weeks=2/4)
- AI-heavy calibration snapshot (30-day window):
  - total_decisions=31, ai_heavy_decisions=23, ai_heavy_rate=0.7419
  - ai_heavy_low_signal_rate=0.9
  - recommendation.action=increase (confidence=medium, factor=1.2)
  - suggested thresholds: files=18, lines=1450, mixed_files=10, mixed_lines=850

## Exit Gate Check (Faz 5)
- [x] En az 2 design-partner repoda strict gate aktif ve stabil
- [x] Override reason coverage >= %95
- [ ] Blocklanan riskli AI degisiklik oraninin trendi raporlandi (multi-week pending)
- [x] En az 1 kritik kacagin release oncesi engellendigi kanitlandi

## Remaining
1. Haftalik cadence ile en az 2 hafta daha trend biriktir (hedef: 4 hafta).
2. AI-heavy kalibrasyonunu 2 hafta daha veri ile tekrar hesaplayip final threshold kararini ver.
3. Faz 5 final sign-off ve "pilot complete" ilanini yap.
