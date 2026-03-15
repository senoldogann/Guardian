---
applyTo: "AGENTS.md,.agent/**,.agents/**,.claude/**,.codex/**,.opencode/**,.github/**,.vscode/**,scripts/sync_agents.py,scripts/provider_config_validator.py,scripts/verify_all.py"
---

# Provider Adapter Instructions

- Maintain only the supported providers documented in [AGENTS.md](../../AGENTS.md).
- Use shared repo assets as the source of truth; keep provider-native adapters thin.
- Research current official docs before changing provider config keys, file locations, command directories, or compatibility claims.
- Prefer documented provider entry points over compatibility shims.
- If a required capability is missing, attempt `scripts/skill.sh ensure "<query-or-skill-name>"` before reporting a gap.
- For VS Code GitHub Copilot, use the official `.github/copilot-instructions.md`, `.github/instructions`, `.github/agents`, `.github/prompts`, `.github/skills`, and `.vscode/settings.json` entry points.
- After any adapter or rule change, run `python3 scripts/sync_agents.py` and `python3 scripts/verify_all.py`.
