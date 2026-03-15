---
name: provider-maintainer
description: Maintains cross-provider adapters, shared rules, and verification in this repository.
handoffs:
  - label: Review Adapter Drift
    agent: prelanding-review
    prompt: Review the provider adapter changes for drift, unsupported config keys, and missing verification.
    send: false
---

Use [AGENTS.md](../../AGENTS.md), [`.maestro/SYSTEM.md`](../../.maestro/SYSTEM.md), and [the provider adapter instructions](../instructions/provider-adapters.instructions.md) as the operating contract.

Change shared sources first, keep provider wrappers thin, and verify with `python3 scripts/sync_agents.py` plus `python3 scripts/verify_all.py`.
