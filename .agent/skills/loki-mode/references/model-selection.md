# Model Selection Strategy

> **CRITICAL: Use the right model for each task type.**

---

## Model Assignment Matrix

| Model | Use For | Examples |
|-------|---------|----------|
| **Opus 4.5** | PLANNING ONLY | System design, architecture, security audits |
| **Sonnet 4.5** | DEVELOPMENT | Implementation, API endpoints, integration tests |
| **Haiku 4.5** | OPERATIONS | Unit tests, docs, bash commands, monitoring |

---

## Task Categories by Model

### Opus (Planning Only - Restricted)

- System architecture design
- High-level planning and strategy
- Security audits and threat modeling
- Major refactoring decisions
- Technology selection

### Sonnet (Development)

- Feature implementation
- API endpoint development
- Bug fixes (non-trivial)
- Integration tests and E2E tests
- Code refactoring
- Database migrations

### Haiku (Operations - Use Extensively)

- Writing/running unit tests
- Generating documentation
- Running bash commands
- Simple bug fixes (typos, imports)
- File operations, linting
- Monitoring, health checks
- Boilerplate generation

---

## Task Tool Usage

```python
# Opus for planning/architecture ONLY
Task(subagent_type="Plan", model="opus", 
     description="Design system architecture", 
     prompt="...")

# Sonnet for development (default)
Task(subagent_type="general-purpose", 
     description="Implement API endpoint", 
     prompt="...")

# Haiku for operations (PREFER for speed)
Task(subagent_type="general-purpose", model="haiku", 
     description="Run unit tests", 
     prompt="...")
```

---

## Parallelization Strategy

```python
# Launch 10+ Haiku agents for unit tests
for test_file in test_files:
    Task(subagent_type="general-purpose", 
         model="haiku",
         description=f"Run tests: {test_file}",
         run_in_background=True)
```

---

## Agent Selection by Complexity

| Complexity | Max Agents | Planning | Development | Testing | Review |
|------------|------------|----------|-------------|---------|--------|
| Trivial | 1 | - | haiku | haiku | skip |
| Simple | 2 | - | haiku | haiku | single |
| Moderate | 4 | sonnet | sonnet | haiku | 3 parallel |
| Complex | 8 | opus | sonnet | haiku | + devil's advocate |
| Critical | 12 | opus | sonnet | sonnet | + human checkpoint |

---

## Background Agents

```python
# Launch background agent - returns immediately
Task(description="Long analysis", 
     run_in_background=True, 
     prompt="...")
# Output truncated to 30K chars
# Use Read tool for full output file
```

---

## Agent Resumption

```python
# First call returns agent_id
result = Task(description="Complex refactor", prompt="...")

# Resume later with agent_id
Task(resume="agent-abc123", 
     prompt="Continue from where you left off")
```

**When to use resume:**
- Context window limits reached
- Rate limit recovery
- Multi-session work
- Checkpoint/restore operations

---

## Model Fallbacks

```
opus -> sonnet -> haiku (if rate limited)
```

---

## Cost Optimization Tips

1. **Haiku First** - Default to Haiku for simple tasks
2. **Parallel Haiku** - 10+ agents for test suites
3. **Sonnet for Code** - Only for actual implementation
4. **Opus Sparingly** - Architecture and security only
5. **Background Mode** - For long-running analysis
