# Maestro Shared Core

Read this file first, then read [`.maestro/SYSTEM.md`](/Users/dogan/Desktop/most-current-rules/.maestro/SYSTEM.md).

## Source Of Truth
- Shared policy and architecture live in `AGENTS.md`, `.maestro/SYSTEM.md`, and `.maestro/ARCHITECTURE.md`
- Shared agents, skills, and workflows live only under `.maestro/`
- Provider adapters are generated outputs and must stay thin

## Supported Providers
- `antigravity`
- `claude`
- `codex`
- `copilot`
- `opencode`

## Required Workflow
- Research current official docs before changing provider config or behavior
- Prefer documented provider entry points over compatibility shims
- If a shared capability is missing, run `scripts/skill.sh ensure "<query-or-skill-name>"`
- If a task clearly needs a missing specialized capability, do not stop at "skill missing"; attempt acquisition with `scripts/skill.sh ensure "<query-or-skill-name>"` before giving up
- Refresh the provider radar with `python3 scripts/provider_doc_radar.py refresh` when official docs may have changed
- Rebuild the active skill registry with `python3 scripts/build_skill_registry.py` after adding, removing, or curating skills
- Use `python3 scripts/skill_router_cli.py --query "<task>"` when you need deterministic skill routing
- Only stop for user input when multiple remote candidates remain, the trust level is unclear, or installation is blocked
- After changing shared rules, skills, workflows, or provider packs, run `python3 scripts/sync_agents.py`
- Before considering the task complete, run `python3 scripts/verify_all.py`
- Before a major release or template handoff, run `python3 scripts/run_eval_suite.py`
- After changing provider architecture or adapter generation, run `python3 scripts/provider_smoke_matrix.py`

## Provider Selection
- Choose provider packs with `python3 scripts/bootstrap_providers.py --profile <name>` or `--providers <csv>`
- Keep always-on instruction files short and provider-neutral
- Remove unselected provider adapters so they do not add accidental context

## Common Start Commands
- Only Codex: `python3 scripts/bootstrap_providers.py --profile codex-only --verify`
- Mixed IDE and CLI stack: `python3 scripts/bootstrap_providers.py --profile mixed-workbench --verify`
- All supported providers: `python3 scripts/bootstrap_providers.py --profile full --verify`

## Role Packs
- For enterprise Azure fullstack work across React, TypeScript, React Native, Python, Rust, Go, CI/CD, API security, testing, and observability, use `.maestro/skills/enterprise-azure-fullstack-readiness/SKILL.md`
- For Azure-heavy repos, use `.maestro/skills/azure-platform-master/SKILL.md` before service-specific implementation

## Preferred Skill Surface
- This template keeps the active `.maestro/skills` library focused on React, TypeScript, React Native, Python, Rust, Go, Azure, CI/CD, frontend design, architecture, security, and testing
- Irrelevant ecosystems are archived under `.maestro/skills-archive/` so they do not pollute provider context
- Re-apply the curated surface with `python3 scripts/apply_skill_profile.py`

## World-Class Ops
- Provider doc drift is tracked under `.maestro/provider-radar/`
- Machine-readable governance lives under `.maestro/policy/`
- Skill metadata and deterministic routing live under `.maestro/skill-registry/`
- Infrastructure eval definitions live under `.maestro/evals/`
- Structured execution traces are written under `.maestro/telemetry/`
