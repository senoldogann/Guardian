---
applyTo: ".maestro/skills/gstack/**,.maestro/workflows/**,.opencode/commands/**,.github/agents/**,.github/prompts/**"
---

# Shared Workflow Instructions

- `gstack` lives once under [`.maestro/skills/gstack`](../../.maestro/skills/gstack); wrappers must reference it instead of copying large prompt bodies.
- Keep `browse`, `plan-ceo-review`, `plan-eng-review`, `review`, `ship`, and `retro` aligned across Claude, OpenCode, Codex, and GitHub Copilot.
- Prefer provider-neutral paths such as `.maestro/skills/...` in shared workflow docs.
- If you change vendored `gstack` code or dependencies, rebuild with `./setup`, rerun `bun test`, and rerun `bun audit`.
