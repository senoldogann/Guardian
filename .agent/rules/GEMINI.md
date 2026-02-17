---
trigger: always_on
---

# Modular Rules Index

> **SPAP v2.2** | Context-Optimized Loading

---

## Rule Files

| # | Rule | Load When |
|---|------|-----------|
| 00 | [ARCHITECT-MANIFESTO.md](.agent/rules/00-ARCHITECT-MANIFESTO.md) | **ALWAYS** (Core) |
| 01 | [safety-and-persistence.md](.agent/rules/01-safety-and-persistence.md) | Data operations |
| 05 | [self-reflection.md](.agent/rules/05-self-reflection.md) | Complex decisions |
| 10 | [parallel-execution.md](.agent/rules/10-parallel-execution.md) | Multi-agent tasks |
| 20 | [observability.md](.agent/rules/20-observability.md) | Deployment/monitoring |
| 30 | [error-handling.md](.agent/rules/30-error-handling.md) | Error-prone code |
| 40 | [api-design.md](.agent/rules/40-api-design.md) | API development |
| 50 | [security-and-testing.md](.agent/rules/50-security-and-testing.md) | Security/auth/tests |
| 100 | [tech-stack.md](.agent/rules/100-tech-stack.md) | Tech decisions |

---

## Selective Loading Protocol

> **RULE:** "Don't load what you don't use." - Context efficiency is paramount.

### Loading Hierarchy

```
L0 (Root):      AGENTS.md + .agent/docs/governance/MODE.md     [ALWAYS - ~50 lines]
L1 (Kernel):    GEMINI.md               [ALWAYS - ~220 lines]
L2 (Specialist): Relevant rule file     [ON DEMAND - ~50-100 lines each]
L3 (Technical): 100-tech-stack-[lang].md [ON DEMAND - Language specific]
L4 (Skills):    Relevant SKILL.md       [ON DEMAND - variable]
```

### Conditional Loading Matrix

| Task Domain | Load These Rules |
|-------------|------------------|
| **API Development** | 00, 40, 50 |
| **Frontend/UI** | 00, 05 |
| **Backend/Database** | 00, 01, 30, 40 |
| **Security/Auth** | 00, 01, 50 |
| **Deployment/DevOps** | 00, 20, 30 |
| **Multi-Agent Orchestration** | 00, 05, 10 |
| **Architecture Decisions** | 00, 05, 100, 100-[lang] |
| **Simple Bug Fix** | 00 only |

### Enforcement Protocol

```
ON agent.activate():
    1. READ AGENTS.md + .agent/docs/governance/MODE.md
    2. IDENTIFY task domain from request
    3. LOAD only matching rules from matrix above
    4. IF coding task: LOAD .agent/rules/100-tech-stack-<language>.md
    5. SKIP rules not in matching set
    
FORBIDDEN:
    - Loading ALL rules at once
    - Starting work without reading AGENTS.md
    - Ignoring Selective Loading Matrix
    - Loading the generic 100-tech-stack.md when a specific language rule exists
```

> **MANDATORY:** Read appropriate agent file and skills BEFORE implementation.

---

## �📥 REQUEST CLASSIFIER (STEP 2)

**Before ANY action, classify the request:**

| Request Type | Trigger Keywords | Active Tiers | Result |
|--------------|------------------|--------------|--------|
| **QUESTION** | "what is", "how does", "explain" | TIER 0 only | Text Response |
| **SURVEY/INTEL**| "analyze", "list files", "overview" | TIER 0 + Explorer | Session Intel (No File) |
| **SIMPLE CODE** | "fix", "add", "change" (single file) | TIER 0 + TIER 1 (lite) | Inline Edit |
| **COMPLEX CODE**| "build", "create", "implement", "refactor" | TIER 0 + TIER 1 (full) + Agent | **{task-slug}.md Required** |
| **DESIGN/UI** | "design", "UI", "page", "dashboard" | TIER 0 + TIER 1 + Agent | **{task-slug}.md Required** |
| **SLASH CMD** | /create, /orchestrate, /debug | Command-specific flow | Variable |

---

## TIER 0: UNIVERSAL RULES (Always Active)

### 🌐 Language Handling

When user's prompt is NOT in English:
1. **Internally translate** for better comprehension
2. **Respond in user's language** - match their communication
3. **Code comments/variables** remain in English
4. **Real-time Currency Check:** Eğer projenin veya teknolojinin gereklilikleri 2026 yılı best-practice'lerini karşılamıyorsa, mutlaka `web_search` kullanın.

### 🧹 Clean Code (Global Mandatory)

**ALL code MUST follow `@[skills/clean-code]` rules. No exceptions.**

- Concise, direct, solution-focused
- No verbose explanations
- No over-commenting
- No over-engineering
- **Self-Documentation:** Every agent is responsible for documenting their own changes in relevant `.md` files.
- **Global Testing Mandate:** Every agent is responsible for writing and running tests for their changes. Follow the "Testing Pyramid" (Unit > Integration > E2E) and the "AAA Pattern" (Arrange, Act, Assert).
- **Global Performance Mandate:** "Measure first, optimize second." Every agent must ensure their changes adhere to 2025-2026 performance standards (Core Web Vitals for Web, query optimization for DB, bundle limits for FS).
- **Anti-AI Commentary:** "Obvious" veya "incremental" yorumlardan (örn: `// i'yi artır`) kaçın. Yorumlar asla "Ne" (kodun kendisi) yapıldığını anlatmamalı; sadece "Neden" (mantık/niyet) yapıldığını açıklamalıdır. Kodun kendisi kendini anlatmalıdır (Self-Expressive).
- **Infrastructure & Safety Mandate:** Every agent is responsible for the deployability and operational safety of their changes. Follow the "5-Phase Deployment Process" (Prepare, Backup, Deploy, Verify, Confirm/Rollback). Always verify environment variables and secrets security.

### 📁 File Dependency Awareness

**Before modifying ANY file:**
1. Check `CODEBASE.md` → File Dependencies
2. Identify dependent files
3. Update ALL affected files together

### 🗺️ System Map Read

> 🔴 **MANDATORY:** Read `ARCHITECTURE.md` at session start to understand Agents, Skills, and Scripts.

**Path Awareness:**
- Agents: `.agent/` (Project)
- Skills: `.agent/skills/` (Project)
- Runtime Scripts: `.agent/skills/<skill>/scripts/`


### 🧠 Read → Understand → Apply

```
❌ WRONG: Read agent file → Start coding
✅ CORRECT: Read → Understand WHY → Apply PRINCIPLES → Code
```

**Before coding, answer:**
1. What is the GOAL of this agent/skill?
2. What PRINCIPLES must I apply?
3. How does this DIFFER from generic output?

---

## TIER 1: CODE RULES (When Writing Code)

### 📱 Project Type Routing

| Project Type | Primary Agent | Skills |
|--------------|---------------|--------|
| **MOBILE** (iOS, Android, RN, Flutter) | `mobile-developer` | mobile-design |
| **WEB** (Next.js, React web) | `frontend-specialist` | frontend-design |
| **BACKEND** (API, server, DB) | `backend-specialist` | api-patterns, database-design |

> 🔴 **Mobile + frontend-specialist = WRONG.** Mobile = mobile-developer ONLY.

### 🛑 Socratic Gate

**For complex requests, STOP and ASK first:**

### 🛑 GLOBAL SOCRATIC GATE (TIER 0)

**MANDATORY: Every user request must pass through the Socratic Gate before ANY tool use or implementation.**

| Request Type | Strategy | Required Action |
|--------------|----------|-----------------|
| **New Feature / Build** | Deep Discovery | ASK minimum 3 strategic questions |
| **Code Edit / Bug Fix** | Context Check | Confirm understanding + ask impact questions |
| **Vague / Simple** | Clarification | Ask Purpose, Users, and Scope |
| **Full Orchestration** | Gatekeeper | **STOP** subagents until user confirms plan details |
| **Direct "Proceed"** | Validation | **STOP** → Even if answers are given, ask 2 "Edge Case" questions |

**Protocol:** 
1. **Never Assume:** If even 1% is unclear, ASK.
2. **Capability Check (Pro-Mode):** BEFORE presenting a plan, the agent MUST run an internal audit: "Do I have the necessary skills for this domain (e.g., GraphQL, Web3, ML)?" If specialized expertise is missing, pro-actively use `@[skills/find-skills]` to discover and suggest the best skill package to the user.
3. **Handle Spec-heavy Requests:** When user gives a list (Answers 1, 2, 3...), do NOT skip the gate. Instead, ask about **Trade-offs** or **Edge Cases** (e.g., "LocalStorage confirmed, but should we handle data clearing or versioning?") before starting.
4. **Implicit Orchestration (Pro-Mode):** Even for simple requests, the agent MUST internally invoke the perspectives of `security-auditor`, `performance-optimizer`, and `frontend-specialist` (UX). Proactively offer optimizations without being asked.
5. **Wait:** Do NOT invoke subagents or write code until the user clears the Gate.
6. **Reference:** Full protocol in `@[skills/brainstorming]`.

### 🏁 Final Checklist Protocol

**Trigger:** When the user says "son kontrolleri yap", "final checks", "çalıştır tüm testleri", or similar phrases.

#### 🛡️ Verification Before Completion (Anti-Hallucination)
Before reporting ANY task as "Completed", the agent MUST:
1.  **Evidence of Success:** Provide direct evidence (terminal output, screenshot, or file content) that the change actually works as intended.
2.  **No Hallucinated Success:** Never assume code works. If you cannot run it, state the assumption clearly.
3.  **Sanitization Check:** Ensure no `console.log`, `print()`, temporary files, or "debugging leftovers" remain in production-level code.
4.  **Edge Case Reflection:** Ask: "What is the one edge case that could break this?" and verify it.

| Task Stage | Command | Purpose |
|------------|---------|---------|
| **Manual Audit** | `python scripts/checklist.py .` | Priority-based project audit |
| **Pre-Deploy** | `python scripts/checklist.py . --url <URL>` | Full Suite + Performance + E2E |

**Priority Execution Order:**
1. **Security** → 2. **Lint** → 3. **Schema** → 4. **Tests** → 5. **UX** → 6. **Seo** → 7. **Lighthouse/E2E**

**Rules:**
- **Completion:** A task is NOT finished until `checklist.py` returns success.
- **Reporting:** If it fails, fix the **Critical** blockers first (Security/Lint).


**Available Scripts (Check [ARCHITECTURE.md](.agent/ARCHITECTURE.md) for full list):**
| Script | Skill | Usage |
|--------|-------|-------|
| `security_scan.py` | vulnerability-scanner | Security Audit |
| `lint_runner.py` | lint-and-validate | Style Check |
| `test_runner.py` | testing-patterns | Logic Verify |
| `ux_audit.py` | frontend-design | UI Check |
| `lighthouse_audit.py` | performance | Performance |
| `playwright_runner.py` | webapp-testing | E2E |

> 🔴 **Agents & Skills can invoke ANY script** via `python .agent/skills/<skill>/scripts/<script>.py`

### 🎭 Gemini Mode Mapping

| Mode | Agent | Behavior |
|------|-------|----------|
| **plan** | `project-planner` | 4-phase methodology. NO CODE before Phase 4. |
| **ask** | - | Focus on understanding. Ask questions. |
| **edit** | `orchestrator` | Execute. Check `{task-slug}.md` first. |

**Plan Mode (4-Phase):**
1. ANALYSIS → Research, questions
2. PLANNING → `{task-slug}.md`, task breakdown
3. SOLUTIONING → Architecture, design (NO CODE!)
4. IMPLEMENTATION → Code + tests

> 🔴 **Edit mode:** If multi-file or structural change → Offer to create `{task-slug}.md`. For single-file fixes → Proceed directly.

---

## TIER 2: DESIGN RULES (Reference)

> **Design rules are in the specialist agents, NOT here.**

| Task | Read |
|------|------|
| Web UI/UX | `.agent/frontend-specialist.md` |
| Mobile UI/UX | `.agent/mobile-developer.md` |

**These agents contain:**
- Purple Ban (no violet/purple colors)
- Template Ban (no standard layouts)
- Anti-cliché rules
- Deep Design Thinking protocol

> 🔴 **For design work:** Open and READ the agent file. Rules are there.

---

## 📁 SYSTEM NAVIGATION

> 🔴 **CRITICAL:** Full lists of Agents, Skills, and Workflows are maintained in [ARCHITECTURE.md](.agent/ARCHITECTURE.md). Always refer to it for up-to-date system capabilities.

- **Check Agents:** See `.agent/agents/` for specialist logic.
- **Check Skills:** See `.agent/skills/` for domain modules.
- **Check Scripts:** See `scripts/` or `.agent/skills/<name>/scripts/` for automation.

---