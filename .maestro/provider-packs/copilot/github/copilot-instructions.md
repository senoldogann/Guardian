---
applyTo: "**"
---

# Maestro Copilot Adapter

Treat [AGENTS.md](../AGENTS.md) and [`.maestro/SYSTEM.md`](../.maestro/SYSTEM.md) as the source of truth for this repository.

## Working Rules

- Keep shared policy in `AGENTS.md` and `.maestro/SYSTEM.md`; keep `.github/*` files thin and GitHub Copilot-native.
- Reuse shared skills from `.github/skills` and shared workflow docs from `.maestro/skills` instead of forking prompt bodies.
- If a required specialized capability is missing, run `scripts/skill.sh ensure "<query-or-skill-name>"` before declaring the capability unavailable.
- For provider adapter or config changes, research current official docs first and prefer documented entry points.
- After changing rules, adapters, or GitHub Copilot files, run `python3 scripts/sync_agents.py` and then `python3 scripts/verify_all.py`.
- If you touch vendored `gstack`, also run `cd .maestro/skills/gstack && ./setup`, `bun test`, and `bun audit`.
- When drift appears, fix the shared `.agent` source first, then update provider-native wrappers.
