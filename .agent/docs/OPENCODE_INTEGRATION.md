# OpenCode Integration Guide

> **Status:** Active | **Method:** Symlink Integration

This project uses a hybrid structure where the core "Maestro" system resides in `.agent/`, but it is exposed to the `opencode` CLI tool via symbolic links in `.opencode/`.

## Directory Structure

```
.
├── docs/governance/AGENTS.md # Root rules file
├── opencode.json             # OpenCode configuration
├── .agent/                   # THE SOURCE OF TRUTH
│   └── skills/               # Real skill definitions
└── .opencode/                # Integration layer
    └── tools -> ../.agent/skills  (Symlink)
```

## How It Works

1.  **Skills (Tools):** OpenCode looks in `.opencode/tools`. We have symlinked this to point to `.agent/skills`. Any change you make in `.agent/skills` is immediately visible to OpenCode as a custom tool.
2.  **Rules:** `opencode.json` is configured using the `instructions` key to load `docs/governance/AGENTS.md` and key rules from `.agent/rules/`.
3.  **Models:** The default model is configured using the `model` key in `opencode.json`.
