# Sub-Agents Directory

This directory stores agent lineage and context files during multi-agent orchestration.

## Purpose

When agents spawn sub-agents, each sub-agent's context is tracked here to:
- Preserve decision lineage
- Enable context handoffs
- Track task ownership
- Maintain audit trail

## File Schema

Each spawned agent creates a JSON file: `{agent_id}.json`

```json
{
  "agent_id": "eng-001-backend-api",
  "agent_type": "general-purpose",
  "model": "sonnet",
  "spawned_at": "2026-01-04T05:30:00Z",
  "spawned_by": "orchestrator-main",
  "lineage": ["orchestrator-main", "eng-001-backend-api"],
  "inherited_context": {
    "phase": "development",
    "current_task": "task-005",
    "tech_stack": ["Node.js", "Express", "TypeScript"]
  },
  "decisions_made": [
    {
      "timestamp": "2026-01-04T05:31:15Z",
      "question": "Should we use Prisma or raw SQL?",
      "answer": "Raw SQL with better-sqlite3",
      "rationale": "PRD requires minimal dependencies"
    }
  ],
  "tasks_completed": ["task-005"],
  "commits_created": ["abc123f"],
  "status": "active|completed|failed",
  "completed_at": null
}
```

## Lifecycle

1. **On Spawn**: Parent agent creates `{agent_id}.json` with inherited context
2. **During Execution**: Agent updates `decisions_made`, `tasks_completed`
3. **On Completion**: Agent sets `status: completed`, adds `completed_at`
4. **Cleanup**: Files older than 7 days are archived by `prune_memory.py`

## Usage

```python
# When spawning a sub-agent
ON agent.spawn():
    agent.context.parent_id = spawner.agent_id
    agent.context.lineage = [...spawner.lineage, spawner.agent_id]
    WRITE .agent/sub-agents/${agent.agent_id}.json
```

## Related

- `scripts/prune_memory.py` - Cleans old agent files
- `.loki/memory/handoffs/` - Agent-to-agent context transfers
- `.loki/memory/ledgers/` - Agent checkpoints
