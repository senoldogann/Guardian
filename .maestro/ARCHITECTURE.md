# Maestro Architecture

## Runtime Layers
- `AGENTS.md`: minimal provider-neutral core
- `.maestro/`: shared source tree
- Provider adapters: generated entry points for the selected providers only

## Shared Assets
- `.maestro/agents/`: shared specialist definitions
- `.maestro/skills/`: shared skill library
- `.maestro/provider-radar/`: provider documentation watchlist and cached snapshots
- `.maestro/evals/`: executable eval definitions and results
- `.maestro/policy/`: executable governance rules
- `.maestro/skill-registry/`: active skill metadata and router inputs
- `.maestro/telemetry/`: structured run traces for scripts
- `.maestro/workflows/`: shared workflow wrappers
- `.maestro/provider-packs/antigravity/`: Antigravity-specific runtime files
- `.maestro/provider-packs/copilot/github/`: GitHub Copilot-specific static wrapper files
- `.maestro/provider-packs/opencode/commands/`: OpenCode command wrappers

## Adapter Principles
- Keep shared logic in `.maestro/*`
- Generate provider-native adapters from shared sources
- Remove unselected providers so they do not add accidental context
- Keep always-on docs small and high signal
- Prefer official provider entry points over compatibility shims
- Verify after every adapter change

## Generated Adapter Layout
| Provider | Generated Files |
| --- | --- |
| `antigravity` | `.agent/` |
| `claude` | `CLAUDE.md`, `.claude/` |
| `codex` | `.codex/`, `.agents/` |
| `copilot` | `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`, `.github/prompts/`, `.github/skills`, `.vscode/settings.json` |
| `opencode` | `opencode.json`, `.opencode/` |

## Selection Flow
1. Choose providers with `python3 scripts/bootstrap_providers.py --profile <name>` or `--providers ...`
2. Persist the selection in `.maestro/project-providers.json`
3. Run `scripts/sync_agents.py` to generate only those adapters
4. Run `scripts/verify_all.py` to confirm the generated state
5. Run `scripts/provider_smoke_matrix.py` when provider architecture changes
