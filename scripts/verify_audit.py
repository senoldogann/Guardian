#!/usr/bin/env python3

import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional


def analyze_history(root_path: str) -> None:
    history_path = os.path.join(root_path, ".guardian", "history.jsonl")

    if not os.path.exists(history_path):
        print(f"❌ History file not found: {history_path}")
        return

    print(f"🔍 Analyzing Log: {history_path}")

    sessions: List[List[Dict[str, Any]]] = []
    current_session: List[Dict[str, Any]] = []
    last_time: Optional[datetime] = None

    with open(history_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                entry = json.loads(line)
                timestamp = datetime.fromisoformat(
                    entry["timestamp"].replace("Z", "+00:00")
                )

                # Split sessions if > 1 minute gap
                if last_time and (timestamp - last_time).total_seconds() > 60:
                    sessions.append(current_session)
                    current_session = []

                current_session.append(entry)
                last_time = timestamp
            except Exception:
                pass

    if current_session:
        sessions.append(current_session)

    print(f"📊 Found {len(sessions)} Sessions:")
    for i, s in enumerate(sessions):
        print(f"  Session {i + 1}: {len(s)} API Calls")

    if len(sessions) >= 2:
        first = len(sessions[0])
        last = len(sessions[-1])
        reduction = ((first - last) / first) * 100
        print(f"\n✅ Efficiency Audit:")
        print(f"  First Run: {first} calls")
        print(f"  Last Run:  {last} calls")
        print(f"  Reduction: {reduction:.1f}%")

        if reduction > 80 or last < 5:
            print("\n🏆 RESULT: PASS (Incremental Audit is working!)")
        else:
            print("\n⚠️ RESULT: WARNING (Reduction low, maybe many files changed?)")
    else:
        print("\nℹ️ Not enough data. Restart Guardian 1-2 times to verify reduction.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_audit.py <project_root>")
        sys.exit(1)

    analyze_history(sys.argv[1])
