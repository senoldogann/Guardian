# Antigravity Kit Architecture

> **Version 5.3 (SPAP v2.2 Compliant)** - Universal AI Agent Capability Expansion Toolkit

---

See `.agent/docs/governance/CODEBASE.md` for the system map and file dependencies.

## 📋 Overview

Antigravity Kit is a modular system consisting of:
- **16 Specialist Agents** - Role-based AI personas
- **52 Skills** - Domain-specific knowledge modules
- **12 Workflows** - Slash command procedures

### 🌐 Multi-Provider Compatibility

| Provider | Platform | Config Files |
|----------|----------|--------------|
| **OpenCode** | Terminal TUI | `opencode.json` |
| **KiloCode** | VS Code Extension | `.kilocode/settings.json` |
| **Codex CLI** | Terminal (OpenAI) | `AGENTS.md`, `AGENTS.override.md` |
| **Antigravity** | Desktop IDE | `.agent/` |

---

## 🏗️ Directory Structure

```
.
├── AGENTS.md                    # Master Agent Definition (Universal)
├── AGENTS.override.md           # Codex CLI override file
├── opencode.json                # OpenCode config
├── .kilocode/                   # KiloCode compatibility layer
│   ├── settings.json
│   └── rules/                   # Symlinks to .agent/rules/
├── .agent/
│   ├── ARCHITECTURE.md          # This file
│   ├── agents/                  # 16 Specialist Agents
│   ├── skills/                  # 52 Capability Modules
│   ├── workflows/               # 12 Slash Command Definitions
│   ├── rules/                   # Global Constitutional Rules
│   └── docs/                    # Documentation
└── docs/
    └── phases-plan/             # Deep Phase Execution plans
```

---

## 🤖 Agents (16)

Specialist AI personas for different domains. Managed by the `orchestrator` and governed by the **Master Ajan** definition in `AGENTS.md`.

| Agent | Focus | Skills Used |
|-------|-------|-------------|
| `orchestrator` | Multi-agent coordination | parallel-agents, behavioral-modes |
| `project-planner` | Discovery, task planning | brainstorming, plan-writing, architecture |
| `frontend-specialist` | Web UI/UX | frontend-design, react-patterns, tailwind-patterns |
| `backend-specialist` | API, business logic | api-patterns, nodejs-best-practices, database-design |
| `database-architect` | Schema, SQL | database-design, prisma-expert |
| `mobile-developer` | iOS, Android, RN | mobile-design |
| `devops-engineer` | CI/CD, Docker | deployment-procedures, docker-expert |
| `security-auditor` | Security compliance | vulnerability-scanner, red-team-tactics |
| `penetration-tester` | Offensive security | red-team-tactics |
| `test-engineer` | Testing strategies | testing-patterns, tdd-workflow, webapp-testing |
| `debugger` | Root cause analysis | systematic-debugging |
| `performance-optimizer` | Speed, Web Vitals | performance-profiling |
| `seo-specialist` | Ranking, visibility | seo-fundamentals, geo-fundamentals |
| `game-developer` | Game logic, mechanics | game-development |
| `documentation-writer` | Manuals, docs | documentation-templates |
| `explorer-agent` | Codebase analysis | - |

---

## 🧠 Skills (45)

Domain-specific knowledge modules. Skills are loaded on-demand based on task context.

### Frontend & UI
| Skill | Description |
|-------|-------------|
| `react-patterns` | React hooks, state, performance |
| `nextjs-best-practices` | App Router, Server Components |
| `tailwind-patterns` | Tailwind CSS v4 utilities |
| `frontend-design` | UI/UX patterns, design systems |
| `ui-ux-pro-max` | 50 styles, 21 palettes, 50 fonts |
| `vercel-react-best-practices` | Vercel React/Next.js best practices |
| `remotion-best-practices` | Remotion video creation in React |

### Backend & API
| Skill | Description |
|-------|-------------|
| `api-patterns` | REST, GraphQL, tRPC |
| `nestjs-expert` | NestJS modules, DI, decorators |
| `nodejs-best-practices` | Node.js async, modules |
| `python-patterns` | Python standards, FastAPI |

### Database
| Skill | Description |
|-------|-------------|
| `database-design` | Schema design, optimization |
| `prisma-expert` | Prisma ORM, migrations |

### TypeScript/JavaScript
| Skill | Description |
|-------|-------------|
| `typescript-expert` | Type-level programming, performance |

### Cloud & Infrastructure
| Skill | Description |
|-------|-------------|
| `docker-expert` | Containerization, Compose |
| `deployment-procedures` | CI/CD, deploy workflows |
| `server-management` | Infrastructure management |

### Testing & Quality
| Skill | Description |
|-------|-------------|
| `testing-patterns` | Jest, Vitest, strategies |
| `webapp-testing` | E2E, Playwright |
| `tdd-workflow` | Test-driven development |
| `code-review-checklist` | Code review standards |
| `lint-and-validate` | Linting, validation |
| `verification-before-completion` | Mandatory self-audit before finishing |
| `agent-browser` | Browser interaction for agents |
| `browser-use` | Browser-based automation |
| `engineering-checklist` | Modular anti-pattern & best practice guide |

### Security
| Skill | Description |
|-------|-------------|
| `vulnerability-scanner` | Security auditing, OWASP |
| `security-review` | Code & Architecture Security Review |
| `red-team-tactics` | Offensive security |

### Architecture & Planning
| Skill | Description |
|-------|-------------|
| `app-builder` | Full-stack app scaffolding |
| `architecture` | System design patterns |
| `system-design` | Scalability & Distributed Systems |
| `plan-writing` | Task planning, breakdown |
| `brainstorming` | Socratic questioning |
| `agent-memory-mcp` | Persistent Context & Memory |
| `c4-architecture` | C4 Model Diagramming with Mermaid |

### Mobile
| Skill | Description |
|-------|-------------|
| `mobile-design` | Mobile UI/UX patterns |

### Game Development
| Skill | Description |
|-------|-------------|
| `game-development` | Game logic, mechanics |

### SEO & Growth
| Skill | Description |
|-------|-------------|
| `seo-fundamentals` | SEO, E-E-A-T, Core Web Vitals |
| `geo-fundamentals` | GenAI optimization |

### Shell/CLI
| Skill | Description |
|-------|-------------|
| `bash-linux` | Linux commands, scripting |
| `powershell-windows` | Windows PowerShell |

### Other
| Skill | Description |
|-------|-------------|
| `find-skills` | Helps users discover and install agent skills |
| `clean-code` | Coding standards (Global) |
| `behavioral-modes` | Agent personas |
| `parallel-agents` | Multi-agent patterns |
| `mcp-builder` | Model Context Protocol |
| `documentation-templates` | Doc formats |
| `i18n-localization` | Internationalization |
| `performance-profiling` | Web Vitals, optimization |
| `systematic-debugging` | Troubleshooting |

---

## 🔄 Workflows (11)

Slash command procedures. Invoke with `/command`.

| Command | Description |
|---------|-------------|
| `/brainstorm` | Socratic discovery |
| `/create` | Create new features |
| `/debug` | Debug issues |
| `/deploy` | Deploy application |
| `/enhance` | Improve existing code |
| `/orchestrate` | Multi-agent coordination |
| `/plan` | Task breakdown |
| `/preview` | Preview changes |
| `/status` | Check project status |
| `/test` | Run tests |
| `/ui-ux-pro-max` | Design with 50 styles |
| `/deep-phase-execution` | Deep Analysis & Phased Execution Workflow (The "Pro" Loop) |

---

## 🎯 Skill Loading Protocol

```
User Request → Skill Description Match → Load SKILL.md
                                            ↓
                                    Read references/
                                            ↓
                                    Read scripts/
```

### Skill Structure

```
skill-name/
├── SKILL.md           # (Required) Metadata & instructions
├── scripts/           # (Optional) Python/Bash scripts
├── references/        # (Optional) Templates, docs
└── assets/            # (Optional) Images, logos
```

### Enhanced Skills (with scripts/references)

| Skill | Files | Coverage |
|-------|-------|----------|
| `typescript-expert` | 5 | Utility types, tsconfig, cheatsheet |
| `ui-ux-pro-max` | 27 | 50 styles, 21 palettes, 50 fonts |
| `app-builder` | 20 | Full-stack scaffolding |

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| **Total Agents** | 16 |
| **Total Skills** | 50 |
| **Total Workflows** | 11 |
| **Coverage** | ~90% web/mobile development |

---

## 🔗 Quick Reference

| Need | Agent | Skills |
|------|-------|--------|
| Web App | `frontend-specialist` | react-patterns, nextjs-best-practices |
| API | `backend-specialist` | api-patterns, nodejs-best-practices |
| Mobile | `mobile-developer` | mobile-design |
| Database | `database-architect` | database-design, prisma-expert |
| Security | `security-auditor` | vulnerability-scanner |
| Testing | `test-engineer` | testing-patterns, webapp-testing |
| Debug | `debugger` | systematic-debugging |
| Plan | `project-planner` | brainstorming, plan-writing |
