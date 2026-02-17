# System Codebase Map

> **Maestro Architecture**
> This file maps the project structure, key dependencies, and architectural boundaries.
> **Last Updated:** 2026-02-02

---

## Project Structure

```
.
├── .agent/                  # Antigravity AI Engine (Root of Intelligence)
│   ├── docs/                # Project documentation & plans
│   │   ├── governance/      # Core rules & definitions
│   │   │   ├── CODEBASE.md  # This file (System Map)
│   │   │   ├── AGENTS.md    # Master Agent Definition
│   │   │   └── MODE.md      # Operational Mode Selector
│   │   ├── reports/         # Analysis reports
│   │   └── PLAN.md          # Active project plan
│   ├── scripts/             # System automation & verification scripts
│   │   ├── checklist.py     # Master audit script
│   │   ├── verify_all.py    # Master orchestration script
│   │   └── ...
│   ├── rules/               # Global AI Rules (Constitution & Manifesto)
│   │   ├── GEMINI.md        # Modular Rules Index
│   │   └── ...
│   ├── skills/              # Capability Modules
│   ├── workflows/           # Slash Command Definitions
│   └── _library/            # Cold Storage / Elite Library
└── scan_results.json        # Security & Health Scan Reports
```

---

## Key File Dependencies

### 1. The "Maestro" Core
These files are the brain of the operation.
- **`GEMINI.md`**: The Constitution. Defines all rules, tiers, and the Socratic Gate.
- **`ARCHITECTURE.md`**: The Blueprint. Lists available agents, skills, and workflows.
- **`AGENTS.md`**: The Persona. Defines pro-mode configuration and tech stack.
- **`CODEBASE.md`**: The Map. (This file) Ensures context awareness.
- **`MODE.md`**: The Mode Selector. Chooses Interactive (Antigravity) or Autonomous (Loki) mode.

### 2. Operational Dependencies
- **`orchestrator.md`** depends on:
    - `.agent/docs/PLAN.md` (Must exist before sub-agents are invoked)
    - `.agent/docs/governance/CODEBASE.md` (For context)
    - `.agent/ARCHITECTURE.md` (For capability lookups)
    - `.agent/docs/governance/MODE.md` (To determine operational mode)

### 3. Verification Dependencies
All agents depend on `.agent/scripts/` to verify their work.
- `.agent/scripts/checklist.py`: The final gatekeeper.
- `.agent/scripts/prune_memory.py`: Memory maintenance automation.

---

## Domain Boundaries

| Domain | Directory / Pattern | Owner Agent |
|--------|---------------------|-------------|
| **AI Config** | `.agent/**` | `orchestrator` / `project-planner` |
| **Scripts** | `.agent/scripts/**` | `devops-engineer` / `orchestrator` |
| **Docs** | `.agent/docs/**` | `documentation-writer` / `project-planner` |
| **Backend** | `src/api/**` (Theoretical) | `backend-specialist` |
| **Frontend** | `src/ui/**` (Theoretical) | `frontend-specialist` |

---

## Elite Library Index (Cold Storage)
*Assets in `.agent/_library/` are not loaded into active memory but are available for manual retrieval.*

### Elite Skills
- **loki-mode**: Fully autonomous project startup orchestrator.
  - Core: `SKILL.md` (~180 lines, modularized)
  - References: `references/` (quick-reference, model-selection, routing-patterns, etc.)
  - Memory: Enhanced memory system with pruning and handoff acknowledgment

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `checklist.py` | Master audit and verification |
| `common_utils.py` | Shared utilities for scripts |
| `dependency_analyzer.py` | Dependency auditing |
| `prune_memory.py` | Memory pruning (episodic, handoffs, CONTINUITY.md) |
| `verify_all.py` | Master orchestration for verification |

---

## Maintenance Protocols

1. **Before Architecting**: Read `CODEBASE.md` + `ARCHITECTURE.md` + `AGENTS.md` + `MODE.md`.
2. **Before Orchestrating**: Ensure `.agent/docs/PLAN.md` exists.
3. **Before Finishing**: Run `.agent/scripts/checklist.py`.
4. **Periodically**: Run `.agent/scripts/prune_memory.py` to prevent context bloat.
