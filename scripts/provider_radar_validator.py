#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / ".maestro" / "policy" / "policy.json"
STATE_PATH = ROOT / ".maestro" / "provider-radar" / "state.json"
WATCHLIST_PATH = ROOT / ".maestro" / "provider-radar" / "watchlist.json"


def main() -> int:
    if not WATCHLIST_PATH.exists():
        print("Provider radar watchlist is missing.")
        return 1
    if not STATE_PATH.exists():
        print("Provider radar state is missing. Run python3 scripts/provider_doc_radar.py refresh")
        return 1

    policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    max_age_days = int(policy.get("provider_radar_max_age_days", 45))

    from provider_doc_radar import status  # local import to keep CLI module single-sourced

    return status(max_age_days)


if __name__ == "__main__":
    raise SystemExit(main())

