# Migration Guide: v1 to v2

This guide helps you migrate from Maestro Rules System v1.x to v2.x.

---

## Overview of Breaking Changes

Version 2.0.0 introduced significant architectural changes:

| Area | v1.x | v2.x |
|------|------|------|
| **Directory Structure** | Flat structure | Modular `.agent/` hierarchy |
| **Skill Format** | Plain Markdown | YAML header + Markdown |
| **Agent Definition** | Inline in rules | Separate agent files |
| **Rule Loading** | All loaded | Selective loading |
| **Configuration** | Hardcoded | Environment-based |

---

## Migration Steps

### Step 1: Backup Your Configuration

Before starting, backup your existing configuration:

```bash
# Create backup
cp -r .claude .claude.v1.backup
cp -r rules rules.v1.backup

# Or use git
git add -A && git commit -m "Pre-migration backup"
git tag v1-final
```

---

### Step 2: Create New Directory Structure

The v2 structure is modular and organized:

```bash
# Create v2 directory structure
mkdir -p .agent/agents
mkdir -p .agent/skills
mkdir -p .agent/rules
mkdir -p .agent/workflows
mkdir -p .agent/.shared
```

**New Structure:**
```
project/
├── .agent/
│   ├── agents/           # Agent definitions (16 specialists)
│   ├── skills/           # Skill modules (36 skills)
│   ├── rules/            # Numbered rule files
│   ├── workflows/        # Process templates
│   └── .shared/          # Shared resources
├── AGENTS.md             # Master constitution
├── MODE.md               # Mode selector
└── CODEBASE.md           # System map
```

---

### Step 3: Migrate Skills

#### v1 Skill Format (Plain Markdown)
```markdown
# My Skill

This skill does X, Y, Z.

## Section 1
...
```

#### v2 Skill Format (YAML Header + Markdown)
```markdown
---
name: my-skill
description: Brief description of what this skill does
allowed-tools: Read, Glob, Grep, Bash
---

# My Skill

This skill does X, Y, Z.

## Section 1
...
```

**Migration Script:**

```bash
#!/bin/bash
# migrate-skills.sh

for skill_dir in .claude/skills/*/; do
    skill_name=$(basename "$skill_dir")
    skill_file="${skill_dir}SKILL.md"
    
    if [ -f "$skill_file" ]; then
        # Create new directory
        mkdir -p ".agent/skills/$skill_name"
        
        # Add YAML header to skill file
        content=$(cat "$skill_file")
        cat > ".agent/skills/$skill_name/SKILL.md" << EOF
---
name: $skill_name
description: TODO - Add description
allowed-tools: Read, Glob, Grep, Bash
---

$content
EOF
        
        echo "Migrated: $skill_name"
    fi
done
```

---

### Step 4: Migrate Agents

In v1, agents were often defined inline in rule files. In v2, each agent has its own file.

#### Create Agent Files

Create a file for each agent in `.agent/agents/`:

```markdown
---
name: backend-specialist
description: Expert in server-side development...
tools: Read, Grep, Glob, Bash, Edit, Write
model: inherit
skills: clean-code, api-patterns, database-design
---

# Backend Specialist

You are an expert backend developer...

## Core Responsibilities
...
```

**Required Fields:**
- `name` - Agent identifier
- `description` - What the agent does
- `tools` - Allowed tools
- `skills` - Skills to load

---

### Step 5: Migrate Rules

#### v1 Rules
```
rules/
├── 01-general.md
├── 02-coding.md
└── ...
```

#### v2 Rules
```
.agent/rules/
├── 00-ARCHITECT-MANIFESTO.md    # Core principles
├── 01-safety-and-persistence.md
├── 05-self-reflection.md
├── 10-parallel-execution.md
├── 20-observability.md
├── 30-error-handling.md
├── 40-api-design.md
├── 50-security-and-testing.md
├── 100-tech-stack.md             # Language-specific
└── GEMINI.md                     # Comprehensive reference
```

**Numbering Convention:**
- `00-09` - Core principles
- `10-19` - Execution patterns
- `20-29` - Observability
- `30-39` - Error handling
- `40-49` - API design
- `50-99` - Domain-specific
- `100+` - Tech stack / language-specific

---

### Step 6: Update References

Search for and update any hardcoded paths:

```bash
# Find old path references
grep -r "\.claude/skills" --include="*.md" .
grep -r "rules/" --include="*.md" .

# Common replacements
sed -i '' 's/.claude\/skills/.agent\/skills/g' **/*.md
sed -i '' 's/rules\//.agent\/rules\//g' **/*.md
```

---

### Step 7: Create Master Files

#### AGENTS.md (Master Constitution)

```markdown
# 🏗️ Project Constitution

> This document is the supreme source of truth.

## Priority Order
1. User safety
2. Code quality
3. Project requirements
4. Performance optimization

## When in Doubt
- Verify > Assume
- Ask > Guess
- Small steps > Big changes
```

#### MODE.md (Mode Selector)

```markdown
# Operational Mode

## Current Mode: INTERACTIVE

### Mode Options
- **INTERACTIVE**: Confirm before major changes
- **AUTONOMOUS**: Execute independently with safeguards
```

#### CODEBASE.md (System Map)

```markdown
# Codebase Map

## Structure
[Document your project structure]

## Quick Reference
[Common patterns and entry points]
```

---

### Step 8: Environment Configuration

Create `.env.example`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# API Keys (do not commit actual values)
API_KEY=your-api-key-here
SECRET_KEY=your-secret-key-here

# Feature Flags
ENABLE_NEW_FEATURE=false
```

Add to `.gitignore`:
```
.env
.env.local
*.log
node_modules/
```

---

### Step 9: Verify Migration

Run verification checklist:

```bash
# Check structure exists
ls -la .agent/
ls -la .agent/agents/
ls -la .agent/skills/
ls -la .agent/rules/

# Verify skill format
for f in .agent/skills/*/SKILL.md; do
    if ! head -1 "$f" | grep -q "^---"; then
        echo "Missing YAML header: $f"
    fi
done

# Check master files
test -f AGENTS.md && echo "✓ AGENTS.md exists" || echo "✗ Missing AGENTS.md"
test -f MODE.md && echo "✓ MODE.md exists" || echo "✗ Missing MODE.md"
test -f CODEBASE.md && echo "✓ CODEBASE.md exists" || echo "✗ Missing CODEBASE.md"
```

---

### Step 10: Clean Up

After successful migration:

```bash
# Remove old directories (after verification!)
rm -rf .claude.v1.backup  # Only after confirming v2 works
rm -rf rules.v1.backup

# Or keep as reference
mv .claude.v1.backup archive/v1-backup
```

---

## Post-Migration Checklist

- [ ] All skills have YAML headers
- [ ] All agents have separate files
- [ ] Rules follow numbering convention
- [ ] AGENTS.md created
- [ ] MODE.md created
- [ ] CODEBASE.md created
- [ ] .env.example created
- [ ] .gitignore updated
- [ ] Old path references updated
- [ ] System tested and working

---

## Common Migration Issues

### Issue: Skill not loading

**Symptom:** Agent can't find skill

**Solution:** Check YAML header format:
```yaml
---
name: skill-name     # Must match directory name
description: ...
allowed-tools: ...   # Comma-separated list
---
```

### Issue: Agent not triggered

**Symptom:** Orchestrator doesn't route to agent

**Solution:** Check agent file has proper triggers in description

### Issue: Rules not applied

**Symptom:** Rules seem ignored

**Solution:** Verify rule numbering (lower = higher priority)

---

## Rollback Procedure

If migration fails:

```bash
# Restore from backup
rm -rf .agent
mv .claude.v1.backup .claude

# Or restore from git
git checkout v1-final
```

---

## Getting Help

If you encounter issues:

1. Check `docs/TROUBLESHOOTING.md`
2. Review `docs/VERSIONING.md` for compatibility info
3. Verify structure matches this guide

---

## Version Compatibility Matrix

| v1.x Feature | v2.x Equivalent |
|--------------|-----------------|
| `.claude/skills/` | `.agent/skills/` |
| `rules/` | `.agent/rules/` |
| Inline agents | `.agent/agents/` |
| Global config | `AGENTS.md` + `MODE.md` |
| Hardcoded paths | Environment variables |

---

> **Note:** v2.x is not backward compatible with v1.x configurations. Complete migration is required.
