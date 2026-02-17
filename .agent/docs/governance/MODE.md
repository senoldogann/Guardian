# Operational Mode Selector

> **SPAP v2.2 Compliant** | Read this file AFTER `AGENTS.md` to determine active mode.

---

## Current Mode

```
ACTIVE_MODE=interactive
```

> Change to `autonomous` when launching Loki Mode with a PRD.

---

## Mode Definitions

### Interactive Mode (Default)

**When to Use:** Standard development with human-in-the-loop.

| Aspect | Configuration |
|--------|---------------|
| **System** | Antigravity Kit |
| **Location** | `.agent/` |
| **Agents** | 16 specialists |
| **Orchestration** | Native Agent Tool |
| **Memory** | `agent-memory-mcp` (optional) |
| **State Tracking** | Stateless (no `.loki/`) |
| **User Interaction** | Socratic discovery, confirmations |

**Loading Protocol:**
```
1. .agent/docs/governance/AGENTS.md (Supreme Authority)
2. .agent/docs/governance/MODE.md (This file - verify mode)
3. .agent/rules/GEMINI.md (Constitutional Rules)
4. .agent/ARCHITECTURE.md (Capability Lookup)
5. Relevant agent file from .agent/agents/
6. On-demand skills from .agent/skills/
```

**Activation:**
```bash
claude  # Standard invocation
```

---

### Autonomous Mode (Loki)

**When to Use:** PRD-to-production with zero human intervention.

| Aspect | Configuration |
|--------|---------------|
| **System** | Loki Mode |
| **Location** | `.agent/_library/skills/loki-mode/` |
| **Agents** | 37 specialized types (7 swarms) |
| **Orchestration** | RARV cycle via `autonomy/run.sh` |
| **Memory** | `.loki/memory/` hierarchy |
| **State Tracking** | Full state in `.loki/` |
| **User Interaction** | None after PRD submission |

**Loading Protocol:**
```
1. AGENTS.md (Supreme Authority)
2. MODE.md (This file - verify mode)
3. .agent/_library/skills/loki-mode/SKILL.md
4. .loki/CONTINUITY.md (working memory)
5. References loaded on-demand from references/
```

**Activation:**
```bash
# Option 1: Runner script
./.agent/_library/skills/loki-mode/autonomy/run.sh ./.agent/docs/requirements.md

# Option 2: Manual with permissions
claude --dangerously-skip-permissions
> Loki Mode with PRD at path/to/prd.md
```

---

## Mode-Specific Resources

### Interactive Mode Resources

| Resource | Path | Purpose |
|----------|------|---------|
| Agents | `.agent/agents/*.md` | 16 specialist personas |
| Skills | `.agent/skills/*/SKILL.md` | 52 capability modules |
| Rules | `.agent/rules/*.md` | Constitutional rules |
| Workflows | `.agent/workflows/*.md` | Slash commands |
| Scripts | `.agent/scripts/*.py` | Verification automation |

### Autonomous Mode Resources

| Resource | Path | Purpose |
|----------|------|---------|
| Skill | `.agent/_library/skills/loki-mode/SKILL.md` | Core instructions |
| References | `.agent/_library/skills/loki-mode/references/` | Detailed protocols |
| Autonomy | `.agent/_library/skills/loki-mode/autonomy/` | Runner + Constitution |
| Runtime State | `.loki/` | Generated at runtime |

---

## Memory System Selection

| Mode | Memory System | Storage | Persistence |
|------|---------------|---------|-------------|
| **Interactive** | `agent-memory-mcp` | MCP Server | `~/.agent-memory/` |
| **Autonomous** | Loki built-in | JSON files | `.loki/memory/` (git-tracked) |

**Rule:** Never mix memory systems. Each mode uses exactly one.

---

## Mode Switching Protocol

### Interactive to Autonomous

```markdown
1. Ensure PRD exists at target path
2. Update MODE.md: ACTIVE_MODE=autonomous
3. Initialize .loki/ structure (run.sh does this automatically)
4. Launch with: ./autonomy/run.sh ./path/to/prd.md
5. Do NOT invoke Interactive agents during execution
```

### Autonomous to Interactive

```markdown
1. Wait for Loki Mode completion (COMPLETED file exists)
2. Update MODE.md: ACTIVE_MODE=interactive
3. Archive .loki/ if needed (git commit)
4. Resume normal claude invocations
5. Interactive agents can now be used
```

---

## Conflict Resolution

If both modes have been invoked in error:

1. **Check for `.loki/` directory** - If exists, Autonomous was active
2. **Check for running `run.sh`** - Kill process if switching to Interactive
3. **Preserve state** - Commit any `.loki/` changes before mode switch
4. **Clear signals** - Remove `.loki/signals/*` files
5. **Update this file** - Set correct `ACTIVE_MODE`

---

## Quick Reference

```
Interactive Mode:
  - Human-in-the-loop
  - 16 agents in .agent/
  - Socratic discovery
  - Optional memory

Autonomous Mode:
  - Zero intervention
  - 37 agents via Loki
  - RARV cycle
  - Full state tracking
```
