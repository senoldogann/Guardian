# Changelog

All notable changes to the Maestro Rules & Scripts System are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- GraphQL patterns skill
- PHP/Laravel tech stack rules
- Infrastructure as Code (Terraform) skill

---

## [2.4.0] - 2025-02-02

### Added

#### Language Support
- `100-tech-stack-csharp.md` - C# best practices (ASP.NET Core, EF Core, Records, xUnit)

#### Skills
- `kubernetes-expert/SKILL.md` - Comprehensive Kubernetes deployment, Helm, GitOps, troubleshooting

#### Documentation
- `docs/migration/v1-to-v2.md` - Complete migration guide from v1 to v2

### Changed
- Added `kubernetes-expert` skill to devops-engineer agent

### Removed
- Removed 16 unused/unreferenced skills (57% size reduction, ~1.2MB saved):
  - agent-browser, agent-memory-mcp, browser-use, docker-expert
  - engineering-checklist, find-skills, git-commit-formatter, i18n-localization
  - nestjs-expert, prisma-expert, remotion-best-practices, security-review
  - system-design, typescript-expert, ui-ux-pro-max, vercel-react-best-practices

### Statistics
- Skills: 52 → 37 (36 original + 1 new kubernetes-expert)
- Skills folder size: 2.1MB → 908KB (57% reduction)
- Languages with full tech stack support: 6 (TypeScript, Python, Go, Rust, Java, C#)

---

## [2.3.0] - 2025-02-02

### Added

#### Quality Control Scripts
- `scripts/lint_runner.py` - Multi-language linting (TypeScript, Python, Go, Rust, Java, C#)
- `scripts/test_runner.py` - Universal test execution with coverage tracking
- `scripts/dod_validator.py` - Definition of Done automated validation

#### Language-Specific Tech Stack Rules
- `100-tech-stack-python.md` - Python best practices (FastAPI, Django, async patterns)
- `100-tech-stack-go.md` - Go best practices (error handling, concurrency, interfaces)
- `100-tech-stack-rust.md` - Rust best practices (ownership, async, traits)
- `100-tech-stack-java.md` - Java best practices (Spring Boot, records, modern Java)

#### Documentation
- `docs/VERSIONING.md` - Versioning and deprecation policy
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
- `docs/CHANGELOG.md` - This file
- `docs/SECURITY-GUIDELINES.md` - Security best practices and patterns

#### System Files
- `MODE.md` - Operational mode selector
- `.gitignore` - Prevent bloat patterns
- `scripts/prune_memory.py` - Memory management automation
- `ANALYSIS.md` - Optimization analysis report

### Changed
- Split `nestjs-expert/SKILL.md` (551 → 100 lines) with reference files
- Split `security-review/SKILL.md` (495 → 80 lines) with reference files
- Updated `ui-ux-pro-max/SKILL.md` paths to use `.agent/.shared/`
- Updated `CODEBASE.md` with correct structure and references

### Removed
- Deleted `vercel-react-best-practices/AGENTS.md` (2,934 lines, bloated)
- Removed duplicate `ui-ux-pro-max/data/` and `scripts/` directories
- Deleted 18 `validation-report-*.md` generated files
- Removed empty `docs/` directory
- Removed empty `.agent/.shared/bmad-lib/_config/custom/` directory
- Deleted `.DS_Store` files

### Fixed
- Fixed broken path references in `ui-ux-pro-max/SKILL.md`
- Fixed missing scripts referenced in agents

### Security
- Added security guidelines document
- Created `.env.example` template

---

## [2.2.0] - 2025-01-26

### Added
- SPAP v2.2 (Senior Principal Architect Protocol) compliance
- 16 specialized agents in `.agent/agents/`
- 52 skills in `.agent/skills/`
- 11 workflow templates in `.agent/workflows/`
- Dual-mode operation (Interactive + Autonomous)

### Changed
- Restructured skill organization
- Updated GEMINI.md with comprehensive rules

---

## [2.1.0] - 2025-01-15

### Added
- Socratic Gate protocol for complex decisions
- Definition of Done (DoD) framework
- Anti-hallucination measures

### Changed
- Enhanced agent boundary enforcement
- Improved handoff protocols

---

## [2.0.0] - 2025-01-01

### Changed
- **BREAKING:** Complete restructure of rules directory
- **BREAKING:** New skill format with YAML headers
- New modular agent system

### Migration
See [Migration Guide v1 to v2](./migration/v1-to-v2.md)

---

## [1.0.0] - 2024-12-01

### Added
- Initial release
- Basic rule system
- Core skills

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.4.0 | 2025-02-02 | C# rules, Kubernetes skill, 16 unused skills removed |
| 2.3.0 | 2025-02-02 | Quality scripts, language rules, documentation |
| 2.2.0 | 2025-01-26 | SPAP v2.2, 16 agents, 52 skills |
| 2.1.0 | 2025-01-15 | Socratic Gate, DoD |
| 2.0.0 | 2025-01-01 | Major restructure |
| 1.0.0 | 2024-12-01 | Initial release |

---

## Upgrade Notes

### Upgrading to 2.4.0

No breaking changes. New features and optimizations:

1. C# tech stack rules available in `.agent/rules/`
2. Kubernetes expert skill added to devops-engineer agent
3. Migration guide available in `docs/migration/`
4. System is now 57% smaller due to unused skill cleanup

**Note:** If you were using any of the removed skills directly, you'll need to recreate them or find alternatives.

### Upgrading to 2.3.0

No breaking changes. New features are additive:

1. New scripts available in `scripts/` directory
2. New language-specific rules in `.agent/rules/`
3. New documentation in `docs/`

### Upgrading to 2.2.0

Compatible with 2.1.x. Update your rule references if using absolute paths.

### Upgrading to 2.0.0 from 1.x

**Breaking changes** - follow migration guide:

1. Skill files now require YAML headers
2. Directory structure changed
3. Agent files moved to `.agent/agents/`
