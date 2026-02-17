# Versioning & Deprecation Policy

> **Document Version:** 1.0.0  
> **Effective Date:** 2025-02-02  
> **Purpose:** Define versioning standards and deprecation procedures for Maestro rules and skills

---

## Semantic Versioning

All rules and skills follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (incompatible with previous versions)
MINOR: New features (backward compatible)
PATCH: Bug fixes (backward compatible)
```

### Version Location

```yaml
# In SKILL.md or rule file header
---
name: skill-name
version: 1.2.3
min-compatible: 1.0.0
---
```

---

## Deprecation Lifecycle

### Stages

| Stage | Duration | Action Required |
|-------|----------|-----------------|
| **Active** | Indefinite | Full support |
| **Deprecated** | 6 months | Migration warnings, documentation |
| **End of Life** | 3 months | Final warnings, removal scheduled |
| **Removed** | - | No longer available |

### Deprecation Process

1. **Announcement** (Day 0)
   - Add `deprecated: true` to file header
   - Document reason and replacement
   - Add to CHANGELOG.md
   - Issue warning in validation scripts

2. **Migration Period** (Months 1-6)
   - Keep feature functional
   - Emit warnings when used
   - Provide migration guide
   - Update documentation

3. **End of Life** (Months 7-9)
   - Final warning notices
   - Prepare removal PR
   - Notify all users

4. **Removal** (Month 9+)
   - Remove deprecated feature
   - Update CHANGELOG.md
   - Major version bump if breaking

### Deprecation Header Format

```yaml
---
name: old-skill-name
version: 2.3.1
deprecated: true
deprecated-since: 2025-02-01
removal-date: 2025-08-01
replacement: new-skill-name
migration-guide: ./docs/migration/old-to-new.md
---
```

---

## Backward Compatibility

### Compatibility Guarantees

| Change Type | Backward Compatible? | Version Bump |
|-------------|---------------------|--------------|
| Add new optional field | ✅ Yes | MINOR |
| Add new rule file | ✅ Yes | MINOR |
| Fix bug in existing rule | ✅ Yes | PATCH |
| Change rule behavior | ❌ No | MAJOR |
| Remove rule/field | ❌ No | MAJOR |
| Rename file/skill | ❌ No | MAJOR |

### Breaking Change Criteria

A change is **breaking** if existing workflows would:
- Fail to execute
- Produce different results
- Require code changes to maintain functionality

### Migration Guides

For every breaking change, provide:

```markdown
# Migration Guide: v1.x to v2.x

## Summary
Brief description of what changed and why.

## Breaking Changes

### 1. Renamed `old-name` to `new-name`

**Before (v1.x):**
```yaml
skill: old-name
```

**After (v2.x):**
```yaml
skill: new-name
```

**Migration Steps:**
1. Find all references to `old-name`
2. Replace with `new-name`
3. Run validation

## New Features
- Feature A: Description
- Feature B: Description

## Deprecated Features
- `feature-x`: Use `feature-y` instead (removal: v3.0)
```

---

## Version Tracking

### CHANGELOG.md Format

```markdown
# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- New feature X

### Changed
- Updated feature Y

### Deprecated
- Feature Z (use feature W instead)

### Removed
- Removed deprecated feature V

### Fixed
- Bug fix for feature T

### Security
- Security fix for vulnerability S

## [2.1.0] - 2025-02-15

### Added
- Python tech stack rules (100-tech-stack-python.md)
- Go tech stack rules (100-tech-stack-go.md)

### Changed
- Updated GEMINI.md with new guidelines

## [2.0.0] - 2025-02-01

### Changed
- **BREAKING:** Restructured skill directory layout

### Migration
See [Migration Guide v1 to v2](./docs/migration/v1-to-v2.md)
```

---

## Compatibility Matrix

### Current Compatibility

| Component | Min Version | Current | Max Tested |
|-----------|-------------|---------|------------|
| AGENTS.md | 2.0.0 | 2.2.0 | 2.2.0 |
| GEMINI.md | 2.0.0 | 2.2.0 | 2.2.0 |
| Skills | 1.0.0 | varies | varies |
| Scripts | 1.0.0 | 1.1.0 | 1.1.0 |

### Upgrade Path

```
v1.x → v2.0 (Breaking)
     ↓
v2.0 → v2.1 (Compatible)
     ↓
v2.1 → v2.2 (Compatible)
```

---

## Automated Checks

### Version Validation Script

```python
# scripts/check_versions.py
"""Validate version consistency across all files."""

import re
from pathlib import Path

def check_versions(root: Path) -> list:
    issues = []
    
    for file in root.rglob("*.md"):
        content = file.read_text()
        
        # Check for version header
        if "---" in content[:100]:
            match = re.search(r'version:\s*([\d.]+)', content)
            if not match:
                issues.append(f"{file}: Missing version in header")
        
        # Check for deprecated without date
        if "deprecated: true" in content:
            if "deprecated-since:" not in content:
                issues.append(f"{file}: Deprecated but missing deprecated-since date")
            if "removal-date:" not in content:
                issues.append(f"{file}: Deprecated but missing removal-date")
    
    return issues
```

---

## Release Process

### Pre-Release Checklist

- [ ] All tests pass
- [ ] CHANGELOG.md updated
- [ ] Version numbers bumped
- [ ] Migration guide written (if breaking)
- [ ] Deprecation notices added
- [ ] Documentation updated
- [ ] Backward compatibility verified

### Release Steps

1. Create release branch: `release/v2.1.0`
2. Update version numbers in all files
3. Update CHANGELOG.md
4. Run full test suite
5. Create PR and review
6. Merge to main
7. Tag release: `git tag -a v2.1.0 -m "Release v2.1.0"`
8. Push tags: `git push --tags`
