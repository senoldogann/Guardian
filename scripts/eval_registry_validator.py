#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / ".maestro" / "evals" / "registry.json"


def main() -> int:
    if not REGISTRY_PATH.exists():
        print("Eval registry is missing.")
        return 1

    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    tasks = payload.get("tasks", [])
    seen_ids: set[str] = set()
    errors: list[str] = []

    for task in tasks:
        task_id = task.get("id")
        if not task_id:
            errors.append("Task missing id")
            continue
        if task_id in seen_ids:
            errors.append(f"Duplicate task id: {task_id}")
        seen_ids.add(task_id)

        command = task.get("command")
        if not isinstance(command, list) or not command:
            errors.append(f"{task_id}: command must be a non-empty list")
            continue
        if len(command) >= 2 and command[1].startswith("scripts/"):
            script_path = ROOT / command[1]
            if not script_path.exists():
                errors.append(f"{task_id}: missing script {command[1]}")

        expected_exit_code = task.get("expected_exit_code")
        if not isinstance(expected_exit_code, int):
            errors.append(f"{task_id}: expected_exit_code must be an integer")

    if errors:
        print("Eval registry validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Eval registry validation passed for {len(tasks)} tasks.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

