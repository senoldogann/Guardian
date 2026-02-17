---
description: Deep Analysis & Phased Execution Workflow (The "Pro" Loop)
---

# 🚀 Deep Phase Execution Protocol

> **Trigger:** When user requests "Detailed Project", "Complex Build", or explicitly asks for "Deep Analysis".

## Phase 0: The Architect's Analysis (Zero-Code)

1.  **Deep Discovery:**
    *   Run `web_search` to find 2026/Current Best Practices for the specific domain.
    *   *Output:* Detailed analysis of *why* specific technologies are chosen.
2.  **Tech Stack Selection:**
    *   Use `.agent/rules/100-tech-stack-*.md` logic.
    *   Rejection of "Generic" choices in favor of specific, problem-solving choices.
3.  **Master Plan Creation:**
    *   Update `task.md` with high-level phases.
    *   **MANDATORY:** Create directory `docs/phases-plan/`.

## The Recursive Loop (Phase 1..N)

**STOP:** You cannot execute Phase N+1 until Phase N is 100% Verified.

### Step 1: Micro-Planning
Create/Update `docs/phases-plan/phase-[N]-[name].md`.
*   Detailed list of files to touch.
*   Exact data structures needed.
*   Test scenarios (Happy path + 2 Edge cases).

### Step 2: TDD & Implementation
1.  **Write Tests First:** Create integration/unit tests that *fail* (Red).
2.  **Implementation:** Write the code to pass the tests (Green).
3.  **Refactor:** Apply `clean-code` principles.

### Step 3: The Verification Gate (Strict)
Run the verification suite:
```bash
# Must pass with 0 errors
npm test (or equivalent)
python scripts/lint_runner.py
python scripts/security_scan.py
```

### Step 4: User Checkpoint
*   Update `task.md`.
*   Commit changes.
*   **Notify User:** "Phase [N] Complete & Verified. Proceed to Phase [N+1]?"

## User Authority
At any point, if the user modifies the plan, the Agent must:
1.  Pause.
2.  Update `docs/phases-plan/phase-[N].md`.
3.  Re-verify impact on previous phases.
