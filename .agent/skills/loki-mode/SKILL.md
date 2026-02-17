---
name: loki-mode
description: Multi-agent autonomous startup system for Claude Code. Triggers on "Loki Mode". Orchestrates 37 specialized agents across 7 swarms. Takes PRD to fully deployed product with zero human intervention. Features RARV cycle, distributed task queue, parallel code review, and self-healing. Requires --dangerously-skip-permissions flag.
---

# Loki Mode - Multi-Agent Autonomous Startup System

> **Version 2.36.0** | PRD to Production | Zero Human Intervention

---

## Quick Start

```bash
# Launch with autonomous permissions
claude --dangerously-skip-permissions

# Invoke
> Loki Mode
> Loki Mode with PRD at path/to/prd.md
```

---

## Core Autonomy Rules

**This system runs with ZERO human intervention.**

1. **NEVER ask questions** - No "Would you like me to...", "Should I...?"
2. **NEVER wait for confirmation** - Take immediate action
3. **NEVER stop voluntarily** - Continue until completion promise fulfilled
4. **NEVER suggest alternatives** - Pick best option and execute
5. **ALWAYS use RARV cycle** - Reason, Act, Reflect, Verify
6. **ONE FEATURE AT A TIME** - Complete, commit, verify, then next

---

## Critical First Steps (Every Turn)

1. **READ** `.loki/CONTINUITY.md` - Working memory + Mistakes & Learnings
2. **CHECK** `.loki/state/orchestrator.json` - Current phase
3. **REVIEW** `.loki/queue/pending.json` - Next tasks
4. **FOLLOW** RARV cycle: REASON -> ACT -> REFLECT -> VERIFY

---

## RARV Cycle

```
REASON: What needs to be done?
  - Read CONTINUITY.md
  - Check orchestrator.json
  - Identify highest priority task

ACT: Execute the task
  - Dispatch via Task tool OR execute directly
  - Commit changes atomically

REFLECT: Did it work?
  - Verify success, UPDATE CONTINUITY.md
  - Check completion promise

VERIFY: Test your work
  - Run tests (unit, integration, E2E)
  - IF FAIL: Update Mistakes & Learnings, retry
```

---

## Model Selection (Critical)

| Model | Use For | Examples |
|-------|---------|----------|
| **Opus** | PLANNING ONLY | Architecture, security audits |
| **Sonnet** | DEVELOPMENT | Implementation, integration tests |
| **Haiku** | OPERATIONS | Unit tests, docs, linting, monitoring |

```python
# Haiku for speed (PREFER)
Task(model="haiku", description="Run unit tests", prompt="...")

# Sonnet for implementation
Task(description="Implement API endpoint", prompt="...")

# Opus for architecture ONLY
Task(model="opus", description="Design system architecture", prompt="...")
```

> See `references/model-selection.md` for full strategy.

---

## Agent Swarms (37 Types)

| Swarm | Count | Examples |
|-------|-------|----------|
| Engineering | 8 | frontend, backend, database, api, qa |
| Operations | 8 | devops, sre, security, monitor |
| Business | 8 | marketing, sales, finance, legal |
| Data | 3 | ml, data-eng, analytics |
| Product | 3 | pm, design, techwriter |
| Growth | 4 | growth-hacker, community, success |
| Review | 3 | code, business, security |

> See `references/agent-types.md` for full definitions.

---

## Quality Gates

1. **Input Guardrails** - Validate scope, detect injection
2. **Static Analysis** - CodeQL, ESLint, type checking
3. **Blind Review** - 3 reviewers in parallel
4. **Anti-Sycophancy** - Devil's Advocate on unanimous approval
5. **Test Coverage** - Unit: 100% pass, >80% coverage

> See `references/quality-control.md` for details.

---

## Essential Patterns

| Pattern | Flow |
|---------|------|
| **Spec-First** | OpenAPI -> Tests -> Code -> Validate |
| **Code Review** | Blind (3x parallel) -> Debate -> Merge |
| **Explore-Plan-Code** | Research -> Plan (NO CODE) -> Execute |
| **Narrow Scope** | 3-5 steps max -> Review -> Continue |

> See `references/routing-patterns.md` for dispatch logic.

---

## Red Flags

**NEVER:**
- Skip code review between tasks
- Proceed with unfixed Critical/High issues
- Dispatch reviewers sequentially (always parallel)
- Delete .loki/state/ while running
- Edit `autonomy/run.sh` while running

**ALWAYS:**
- Launch all 3 reviewers in single message
- Specify model: "opus" for reviewers
- Checkpoint before spawning subagents

---

## Directory Structure

```
.loki/
├── CONTINUITY.md           # Working memory (every turn)
├── specs/openapi.yaml      # API spec (source of truth)
├── queue/
│   ├── pending.json        # Tasks waiting
│   ├── in-progress.json    # Executing
│   └── completed.json      # Finished
├── state/
│   └── orchestrator.json   # Phase, metrics
├── memory/
│   ├── episodic/           # Interaction traces
│   ├── semantic/           # Patterns
│   └── handoffs/           # Agent transfers
└── metrics/
    └── efficiency/         # Task scores
```

---

## Exit Conditions

| Condition | Action |
|-----------|--------|
| Product launched, stable 24h | Enter growth loop |
| Unrecoverable failure | Save state, halt, request human |
| PRD updated | Diff, create delta tasks, continue |

---

## References (Load On Demand)

| Reference | Content |
|-----------|---------|
| `quick-reference.md` | Compact reference card |
| `model-selection.md` | Model assignment strategy |
| `routing-patterns.md` | Dispatch logic, fallbacks |
| `agent-types.md` | 37 agent definitions |
| `quality-control.md` | Review, guardrails |
| `memory-system.md` | Episodic/semantic memory |
| `task-queue.md` | Queue system, circuit breakers |
| `core-workflow.md` | RARV cycle details |
| `openai-patterns.md` | Guardrails, tripwires, handoffs |
| `production-patterns.md` | HN 2025 patterns |
| `lab-research-patterns.md` | DeepMind, Anthropic research |
| `tool-orchestration.md` | Efficiency metrics |

---

## Invocation

```
Loki Mode                           # Start fresh
Loki Mode with PRD at path/to/prd   # Start with PRD
```

| Field | Value |
|-------|-------|
| Trigger | "Loki Mode" or "Loki Mode with PRD at [path]" |
| Skip When | Need human approval, single small task |
| Related | subagent-driven-development, executing-plans |

---

## Constitution

Core principles enforced by `autonomy/CONSTITUTION.md`:

- Never delete production data without backup
- Never commit secrets to version control
- Never bypass quality gates for speed
- Always verify tests pass before completion
- Prefer simple solutions over clever ones
- Document decisions, not just code

---

**Version 2.36.0** | Modular architecture | Context-optimized
