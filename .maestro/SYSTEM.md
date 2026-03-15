# Maestro System Map

## Shared Source Of Truth
- `AGENTS.md`: minimal always-on core for every supported provider
- `.maestro/SYSTEM.md`: provider map, generated adapter contract, provider selection model
- `.maestro/ARCHITECTURE.md`: runtime and directory layout
- `.maestro/agents/`: shared specialist source files
- `.maestro/skills/`: active shared skill source files exposed to providers
- `.maestro/skills-archive/`: archived skills intentionally kept out of provider context
- `.maestro/workflows/`: shared workflow source files
- `.maestro/provider-packs/`: provider-native pack sources and metadata
- `.maestro/project-providers.json`: active provider selection for the current project
- `.maestro/provider-radar/`: official provider-doc watchlist and cached snapshots
- `.maestro/evals/`: executable eval registry and result artifacts
- `.maestro/policy/`: machine-readable governance rules
- `.maestro/skill-registry/`: generated skill metadata and manual overrides
- `.maestro/telemetry/`: structured script traces and recent run summaries

## Provider Model
This repository uses a two-layer model:

1. Shared source lives under `.maestro/`
2. Provider-native adapters are generated from that shared source into provider entry points only when selected

This keeps shared logic centralized while reducing cross-provider context drift in real projects.

## Supported Providers
| Provider | Generated Entry Points | Shared Source Consumption |
| --- | --- | --- |
| `antigravity` | `.agent/` | `.agent/*` is generated from `.maestro/*` plus the Antigravity rules pack |
| `claude` | `CLAUDE.md`, `.claude/` | `.claude/agents`, `.claude/skills`, `.claude/commands` point to shared `.maestro/*` |
| `codex` | `.codex/`, `.agents/` | Codex reads `AGENTS.md` and `.maestro/SYSTEM.md`; shared skills are exposed through `.agents/skills` |
| `copilot` | `.github/`, `.vscode/settings.json` | GitHub Copilot reads `AGENTS.md`, `.github/copilot-instructions.md`, and `.github/*` wrappers generated from `.maestro/*` |
| `opencode` | `opencode.json`, `.opencode/` | OpenCode reads `AGENTS.md` and `.maestro/SYSTEM.md`; shared agents and skills are exposed through `.opencode/*` |

## Directory Contract
```text
.
├── AGENTS.md
├── .maestro/
│   ├── SYSTEM.md
│   ├── ARCHITECTURE.md
│   ├── agents/
│   ├── skills/
│   ├── workflows/
│   ├── provider-packs/
│   ├── provider-radar/
│   ├── evals/
│   ├── policy/
│   ├── skill-registry/
│   ├── telemetry/
│   └── project-providers.json
├── .agent/                 # only when antigravity is selected
├── .claude/                # only when claude is selected
├── .codex/                 # only when codex is selected
├── .agents/                # only when codex is selected
├── .github/                # only when copilot is selected
├── .vscode/settings.json   # only when copilot is selected
├── .opencode/              # only when opencode is selected
└── scripts/
```

## Sync Rules
- `scripts/sync_agents.py` owns adapter generation and cleanup
- `scripts/bootstrap_providers.py` changes the active provider set and then calls sync
- Prefer named profiles such as `codex-only`, `cli-stack`, `mixed-workbench`, and `full` for common setups
- Do not hand-maintain generated provider wrappers when the same change belongs in `.maestro/*`
- Unselected provider adapters should be removed from the project so they do not create unnecessary context

## Skill Acquisition Rules
- Missing capability is not an acceptable stopping point when the capability can be acquired
- Agents should first search shared `.maestro/skills`, then local provider bridges, then user-level installed skills
- If the capability is still missing, agents should run `scripts/skill.sh ensure "<query-or-skill-name>"` before declaring the skill unavailable
- Agents should only stop for user confirmation when multiple remote candidates remain, when a remote source appears low-trust or risky, or when installation is blocked
- Newly acquired repo-shared skills must be indexed and then consumed through the normal provider bridges
- The preferred active skill surface is intentionally focused on React, TypeScript, React Native, Python, Rust, Go, Azure, CI/CD, frontend design, architecture, security, and testing
- Re-apply that curation with `python3 scripts/apply_skill_profile.py`
- Rebuild the machine-readable registry with `python3 scripts/build_skill_registry.py`
- Use `python3 scripts/skill_router_cli.py --query "<task>"` for deterministic routing instead of broad skill guessing

## Provider Drift Rules
- Official provider docs are tracked through `.maestro/provider-radar/watchlist.json`
- Refresh cached snapshots with `python3 scripts/provider_doc_radar.py refresh`
- Validate freshness with `python3 scripts/provider_radar_validator.py`

## Verification Rules
- Run `python3 scripts/sync_agents.py` after changing shared rules, skills, workflows, or provider packs
- Run `python3 scripts/verify_all.py` before completion
- Run `python3 scripts/provider_smoke_matrix.py` after provider architecture or adapter-generation changes
- Validation must account for the active provider selection in `.maestro/project-providers.json`
- Validation also checks that archived ecosystems do not leak back into active `.maestro/skills`
- Run `python3 scripts/policy_guard.py` when governance-sensitive files change
- Run `python3 scripts/run_eval_suite.py` for release-grade infrastructure evaluation
- Core scripts emit structured telemetry under `.maestro/telemetry/`

## Shared Workflow Packs
- `gstack` lives under `.maestro/skills/gstack/`
- `azure-platform-master` lives under `.maestro/skills/azure-platform-master/`
- `enterprise-azure-fullstack-readiness` lives under `.maestro/skills/enterprise-azure-fullstack-readiness/`
- Shared wrapper entry points such as `browse`, `plan-ceo-review`, `plan-eng-review`, `review`, `ship`, and `retro` are re-exposed per provider from that one source
