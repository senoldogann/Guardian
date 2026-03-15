# World-Class Operations

## Purpose
These scripts turn the Maestro template from a provider adapter pack into an operationally mature multi-provider system.

## Core Commands
- Refresh official provider-doc snapshots: `python3 scripts/provider_doc_radar.py refresh`
- Check cached provider-doc freshness: `python3 scripts/provider_radar_validator.py`
- Rebuild the active skill registry: `python3 scripts/build_skill_registry.py`
- Route a task to the best active skills: `python3 scripts/skill_router_cli.py --query "react typescript azure security"`
- Enforce executable governance: `python3 scripts/policy_guard.py`
- Run infrastructure evals: `python3 scripts/run_eval_suite.py`

## Skill Registry Model
- Generated registry entries include `tags`, `stack`, `phase`, `aliases`, `requires`, `conflicts_with`, `load_cost`, and `routing_boost`
- Manual overrides live in [`.maestro/skill-registry/overrides.json`](/Users/dogan/Desktop/most-current-rules/.maestro/skill-registry/overrides.json)
- Deterministic routing uses those fields instead of relying only on raw skill names

## Telemetry
- Structured run traces are written to [`.maestro/telemetry/events.jsonl`](/Users/dogan/Desktop/most-current-rules/.maestro/telemetry/events.jsonl)
- Recent run summaries are written to [`.maestro/telemetry/runs.json`](/Users/dogan/Desktop/most-current-rules/.maestro/telemetry/runs.json)

## Eval Results
- Latest eval result: [`.maestro/evals/results/latest.json`](/Users/dogan/Desktop/most-current-rules/.maestro/evals/results/latest.json)
