# Loki Mode Quick Reference Card

> **Load on demand** - Compact reference for active sessions

---

## Critical First Steps (Every Turn)

1. **READ** `.loki/CONTINUITY.md` - Your working memory + "Mistakes & Learnings"
2. **RETRIEVE** Relevant memories from `.loki/memory/`
3. **CHECK** `.loki/state/orchestrator.json` - Current phase/metrics
4. **REVIEW** `.loki/queue/pending.json` - Next tasks
5. **FOLLOW** RARV: REASON, ACT, REFLECT, **VERIFY**
6. **TRACK** Efficiency: tokens, time, agent count

---

## Key Files (Priority Order)

| File | Purpose | Update When |
|------|---------|-------------|
| `.loki/CONTINUITY.md` | Working memory | Every turn |
| `.loki/memory/semantic/` | Patterns & anti-patterns | After task completion |
| `.loki/memory/episodic/` | Interaction traces | After each action |
| `.loki/specs/openapi.yaml` | API spec (source of truth) | Architecture changes |
| `CLAUDE.md` | Project context | Significant changes |

---

## Decision Tree

```
START
  |
  +-- Read CONTINUITY.md
  |
  +-- Task in-progress?
  |   +-- YES: Resume
  |   +-- NO: Check pending queue
  |
  +-- Pending tasks?
  |   +-- YES: Claim highest priority
  |   +-- NO: Check phase completion
  |
  +-- Phase done?
  |   +-- YES: Advance to next phase
  |   +-- NO: Generate tasks for phase
  |
LOOP
```

---

## SDLC Phase Flow

```
Bootstrap -> Discovery -> Architecture -> Infrastructure
     |           |            |              |
  (Setup)   (Analyze PRD)  (Design)    (Cloud/DB Setup)
                                             |
Development <- QA <- Deployment <- Business Ops <- Growth
     |         |         |            |            |
  (Build)    (Test)   (Release)    (Monitor)    (Iterate)
```

---

## Essential Patterns

| Pattern | Flow |
|---------|------|
| **Spec-First** | OpenAPI -> Tests -> Code -> Validate |
| **Code Review** | Blind (3x parallel) -> Debate -> Devil's Advocate -> Merge |
| **Guardrails** | Input Guard -> Execute -> Output Guard |
| **Explore-Plan-Code** | Research -> Plan (NO CODE) -> Execute |
| **Self-Verification** | Code -> Test -> Fail -> Learn -> Update CONTINUITY -> Retry |
| **Narrow Scope** | 3-5 steps max -> Human review -> Continue |

---

## RARV Cycle

```
REASON: What needs to be done next?
  - Read CONTINUITY.md
  - Check orchestrator.json
  - Identify highest priority task

ACT: Execute the task
  - Dispatch via Task tool OR execute directly
  - Commit changes atomically

REFLECT: Did it work?
  - Verify success
  - UPDATE CONTINUITY.md
  - Check completion promise

VERIFY: Test your work
  - Run tests (unit, integration, E2E)
  - Check compilation
  - Verify against spec
  - IF FAIL: Capture error, update Mistakes & Learnings, retry
```

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

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Agent stuck | Read CONTINUITY.md first |
| Task repeating | Check queue state |
| Code review failing | Run static analysis first |
| Rate limit hit | Use exponential backoff |
| Can't find what to do | Use Decision Tree |

---

## Red Flags

**NEVER:**
- Skip code review between tasks
- Proceed with unfixed Critical/High issues
- Dispatch reviewers sequentially
- Delete .loki/state/ while running

**ALWAYS:**
- Launch all 3 reviewers in single message
- Specify model: "opus" for reviewers
- Checkpoint before spawning subagents
- Fix Critical/High/Medium immediately
