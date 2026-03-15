# Provider Profiles

Use provider profiles to generate only the adapter surfaces you actually need in a project.

## Initialize a new project from this template

From this template repository, copy the Maestro core into a target directory and apply a profile in one step:

```bash
./scripts/init-project.sh /path/to/new-project --profile mixed-workbench --verify
```

If you are already inside the target directory, you can also use:

```bash
/path/to/most-current-rules/scripts/init-project.sh . --profile mixed-workbench --verify
```

This copies only the shared Maestro core (`AGENTS.md`, `.maestro`, `scripts`, `docs`) and then generates the selected provider adapters inside the target project.

## List profiles

```bash
python3 scripts/bootstrap_providers.py --list-profiles
```

## Recommended starts

### Codex only

```bash
python3 scripts/bootstrap_providers.py --profile codex-only --verify
```

### VS Code Copilot only

```bash
python3 scripts/bootstrap_providers.py --profile vscode-copilot --verify
```

### Mixed CLI stack

```bash
python3 scripts/bootstrap_providers.py --profile cli-stack --verify
```

### Mixed IDE and CLI workbench

This is the recommended profile when you switch between Antigravity, Codex, VS Code Copilot, and OpenCode in the same repo.

```bash
python3 scripts/bootstrap_providers.py --profile mixed-workbench --verify
```

### Everything enabled

```bash
python3 scripts/bootstrap_providers.py --profile full --verify
```

## Custom combinations

If you want a custom mix, use explicit providers:

```bash
python3 scripts/bootstrap_providers.py --providers antigravity,codex,copilot,opencode --verify
```

Provider ids:
- `antigravity`
- `claude`
- `codex`
- `copilot`
- `opencode`

## Smoke test the matrix

After changing provider architecture, run:

```bash
python3 scripts/provider_smoke_matrix.py
```

This regenerates and validates every smoke-enabled profile, then restores your original provider selection.
