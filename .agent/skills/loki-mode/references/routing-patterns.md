# Routing Patterns

> **Based on AWS Bedrock Agent Patterns** - Optimize dispatch based on task complexity.

---

## Two Dispatch Modes

| Mode | When to Use | Behavior |
|------|-------------|----------|
| **Direct Routing** | Simple, single-domain tasks | Route directly to specialist, skip orchestration |
| **Supervisor Mode** | Complex, multi-step tasks | Full decomposition, coordination, synthesis |

---

## Decision Logic

```
Task Received
    |
    +-- Is task single-domain?
    |   +-- YES: Direct Route to specialist
    |   |        - Faster (no orchestration overhead)
    |   |        - Minimal context (avoid confusion)
    |   |
    |   +-- NO: Supervisor Mode
    |            - Full task decomposition
    |            - Coordinate multiple agents
    |            - Synthesize results
    |
    +-- Fallback: If intent unclear -> Supervisor Mode
```

---

## Direct Routing Examples

```python
# Simple tasks -> Direct dispatch to Haiku
Task(model="haiku", 
     description="Fix import in utils.py", 
     prompt="...")  # Direct

Task(model="haiku", 
     description="Run linter on src/", 
     prompt="...")  # Direct

Task(model="haiku", 
     description="Generate docstring", 
     prompt="...")  # Direct
```

---

## Supervisor Mode Examples

```python
# Complex tasks -> Full orchestration (default Sonnet)
Task(description="Implement user auth with OAuth", 
     prompt="...")  # Supervisor

Task(description="Refactor database layer", 
     prompt="...")  # Supervisor
```

---

## Context Depth by Mode

| Mode | Context Provided |
|------|-----------------|
| **Direct Routing** | Minimal - just task and relevant file(s) |
| **Supervisor Mode** | Full - CONTINUITY.md, architecture, dependencies |

> "Complex task histories might confuse simpler subagents." - AWS Best Practices

---

## Confidence-Based Routing

```
confidence >= 0.95  -->  Auto-approve with audit log
confidence >= 0.70  -->  Quick human review
confidence >= 0.40  -->  Detailed human review
confidence < 0.40   -->  Escalate immediately
```

---

## Narrow Scope Pattern

```yaml
task_constraints:
  max_steps_before_review: 3-5
  characteristics:
    - Specific, well-defined objectives
    - Pre-classified inputs
    - Deterministic success criteria
    - Verifiable outputs
```

---

## Context Isolation with Sub-Agents

**Use sub-agents to prevent token waste:**

```
Main agent (focused) --> Sub-agent (file search)
                     --> Sub-agent (test running)
                     --> Sub-agent (linting)
```

**Benefits:**
- Main context stays clean
- Noisy operations isolated
- Faster iteration

---

## Multi-Tiered Fallbacks

### Workflow-Level

```
Full workflow fails
    -> Simplified workflow
    -> Decompose to subtasks
    -> Human escalation
```

### Human Escalation Triggers

| Trigger | Action |
|---------|--------|
| retry_count > 3 | Pause and escalate |
| domain in [payments, auth, pii] | Require approval |
| confidence_score < 0.6 | Pause and escalate |
| wall_time > expected * 3 | Pause and escalate |
| tokens_used > budget * 0.8 | Pause and escalate |

---

## Deterministic Outer Loops

**Wrap agent outputs with rule-based validation (NOT LLM-judged):**

```
1. Agent generates output
2. Run linter (deterministic)
3. Run tests (deterministic)
4. Check compilation (deterministic)
5. Only then: human or AI review
```

---

## Context Engineering Principles

```yaml
principles:
  - "Less is more" - focused beats comprehensive
  - Manual selection outperforms automatic RAG
  - Fresh conversations per major task
  - Remove outdated information aggressively

context_budget:
  target: "< 10k tokens for context"
  reserve: "90% for model reasoning"
```
