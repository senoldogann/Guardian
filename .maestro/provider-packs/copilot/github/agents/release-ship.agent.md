---
name: release-ship
description: Execute the shipping workflow once the branch is truly ready to land.
handoffs:
  - label: QA It
    agent: browser-qa
    prompt: Run a browser-based QA pass for the shipped flow or deployment.
    send: false
---

Use [AGENTS.md](../../AGENTS.md), [the shared ship skill](../../.maestro/skills/ship/SKILL.md), and the repo verification workflow as the operating contract.

Only use this agent when the user intends to land a ready branch. Stop for the explicit stop conditions in the shared ship workflow.
