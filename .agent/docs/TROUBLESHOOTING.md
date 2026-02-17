# Troubleshooting Guide

> **Purpose:** Quick solutions for common issues with Maestro Rules & Scripts System

---

## Quick Diagnostics

Run these commands first to identify issues:

```bash
# Check Python availability
python3 --version

# Validate system structure
python3 scripts/checklist.py

# Run full verification
python3 scripts/verify_all.py

# Check for issues in code
python3 scripts/dod_validator.py .
```

---

## Common Issues

### 1. "Module not found" Errors

**Symptoms:**
```
ModuleNotFoundError: No module named 'xyz'
```

**Solutions:**

```bash
# Install missing dependencies
pip3 install -r requirements.txt

# For specific modules
pip3 install pydantic httpx pytest

# If using virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows
pip3 install -r requirements.txt
```

---

### 2. Skill Not Loading

**Symptoms:**
- Agent doesn't recognize skill
- "Skill not found" messages
- Skill capabilities not available

**Diagnosis:**
```bash
# Check skill exists
ls -la .agent/skills/skill-name/

# Verify SKILL.md has correct format
head -20 .agent/skills/skill-name/SKILL.md
```

**Solutions:**

1. **Check SKILL.md header format:**
```yaml
---
name: skill-name          # Must match directory name
description: "..."
---
```

2. **Verify file permissions:**
```bash
chmod +r .agent/skills/skill-name/*.md
```

3. **Check for syntax errors:**
```bash
# Validate YAML header
python3 -c "import yaml; yaml.safe_load(open('.agent/skills/skill-name/SKILL.md').read().split('---')[1])"
```

---

### 3. Memory Bloat / Slow Performance

**Symptoms:**
- Agent responses slowing down
- Context limit warnings
- Memory directory growing large

**Diagnosis:**
```bash
# Check memory size
du -sh .agent/memory/
du -sh .loki/memory/

# Count memory files
find .agent/memory -type f | wc -l
```

**Solutions:**

```bash
# Run memory pruning
python3 scripts/prune_memory.py

# Manual cleanup (keep last 10)
cd .agent/memory
ls -t | tail -n +11 | xargs rm -f
```

---

### 4. Validation Script Failures

**Symptoms:**
```
scripts/verify_all.py failed
checklist.py reports errors
```

**Diagnosis:**
```bash
# Run with verbose output
python3 scripts/verify_all.py --verbose

# Check individual validators
python3 scripts/lint_runner.py .
python3 scripts/test_runner.py .
python3 scripts/dod_validator.py .
```

**Common Fixes:**

| Error | Fix |
|-------|-----|
| "Linter not found" | Install: `npm install -g eslint` or `pip install ruff` |
| "Test framework not found" | Install: `pip install pytest` or `npm install jest` |
| "Syntax errors" | Fix code syntax before re-running |
| "Coverage below threshold" | Add more tests or lower threshold |

---

### 5. Agent Handoff Failures

**Symptoms:**
- Context lost between agents
- Agent doesn't have expected information
- "I don't have context about..." messages

**Solutions:**

1. **Ensure handoff acknowledgment:**
```
The receiving agent must confirm:
"I understand. Taking over [specific task] with context: [summary]"
```

2. **Check agent boundary enforcement:**
- Verify agent is appropriate for task
- Don't force agent outside its domain

3. **Provide explicit context:**
```
When handing off, include:
- Current state
- Completed steps
- Remaining tasks
- Relevant file paths
```

---

### 6. Rule Conflicts

**Symptoms:**
- Contradictory behavior
- Agent confused about which rule to follow
- Inconsistent outputs

**Resolution Priority:**

```
1. docs/governance/AGENTS.md (Supreme Truth - always wins)
2. GEMINI.md (Constitutional rules)
3. Task-specific rules (00-XX-name.md)
4. Skill-specific rules (SKILL.md)
```

**Solutions:**

1. **Check for conflicts:**
```bash
# Search for conflicting terms
grep -r "must NOT" .agent/rules/
grep -r "always" .agent/rules/
```

2. **AGENTS.md wins all conflicts:**
If rules conflict, the one in AGENTS.md takes precedence.

---

### 7. Security Scan Failures

**Symptoms:**
```
scan_results.json shows critical issues
Secret exposure detected
Dangerous patterns found
```

**Solutions:**

1. **Secret exposure:**
```bash
# Find exposed secrets
grep -rn "Bearer\|password\|api_key" --include="*.py" --include="*.js"

# Move to environment variables
# Before: api_key = "sk-xxx"
# After: api_key = os.getenv("API_KEY")
```

2. **Dangerous patterns:**
```python
# Before (dangerous):
eval(user_input)

# After (safe):
import ast
ast.literal_eval(user_input)  # Only for simple literals
```

3. **SQL injection:**
```python
# Before (dangerous):
f"SELECT * FROM users WHERE id = {user_id}"

# After (safe):
"SELECT * FROM users WHERE id = %s", (user_id,)
```

---

### 8. TypeScript/JavaScript Specific

**Symptoms:**
- Type errors
- Module resolution failures
- Build failures

**Solutions:**

```bash
# Clear caches
rm -rf node_modules/.cache
rm -rf .next/cache
rm -rf dist/

# Reinstall dependencies
rm -rf node_modules
npm install

# Check TypeScript config
npx tsc --noEmit

# Fix common issues
npx tsc --build --clean
```

---

### 9. Docker Build Failures

**Symptoms:**
- Image build fails
- Container won't start
- Permission errors

**Solutions:**

```bash
# Clean Docker cache
docker builder prune -a

# Rebuild without cache
docker build --no-cache -t myapp .

# Check for permission issues
# Ensure non-root user in Dockerfile:
USER 1001

# Debug container
docker run -it --entrypoint /bin/sh myapp
```

---

### 10. Test Failures

**Symptoms:**
- Tests pass locally but fail in CI
- Flaky tests
- Timeout errors

**Solutions:**

1. **Environment differences:**
```bash
# Ensure same Node/Python version
node --version
python3 --version

# Use exact versions in CI
```

2. **Flaky tests:**
```python
# Add retries for flaky tests
@pytest.mark.flaky(reruns=3)
def test_network_operation():
    ...
```

3. **Timeout issues:**
```bash
# Increase timeout
pytest --timeout=60
jest --testTimeout=30000
```

---

## Debug Mode

Enable debug output for more information:

```bash
# Python scripts
DEBUG=1 python3 scripts/verify_all.py

# Node.js
DEBUG=* npm test

# Verbose logging
python3 scripts/lint_runner.py . --verbose
```

---

## Getting Help

If issues persist:

1. **Check AGENTS.md** for authoritative guidance
2. **Check CODEBASE.md** for system overview
3. **Check relevant SKILL.md** for domain-specific help
4. **Run diagnostics:** `python3 scripts/verify_all.py --verbose`
5. **Check logs** in `.agent/logs/` or `.loki/logs/`

---

## FAQ

### Q: How do I add a new skill?

```bash
mkdir -p .agent/skills/my-skill
cat > .agent/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
version: 1.0.0
description: "What this skill does"
---

# My Skill

Skill content here...
EOF
```

### Q: How do I update a rule?

1. Edit the rule file in `.agent/rules/`
2. Bump version if applicable
3. Update CHANGELOG.md
4. Run `python3 scripts/verify_all.py`

### Q: How do I disable a skill temporarily?

Rename the file:
```bash
mv .agent/skills/my-skill/SKILL.md .agent/skills/my-skill/SKILL.md.disabled
```

### Q: How do I reset the system?

```bash
# Clean generated files
rm -rf .agent/memory/*
rm -rf .loki/memory/*
rm -rf validation-report-*.md

# Verify structure
python3 scripts/checklist.py
```
