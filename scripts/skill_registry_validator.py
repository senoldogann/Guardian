#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

from skill_profile_support import ACTIVE_SKILLS_DIR, ROOT, list_skill_dirs

REGISTRY_PATH = ROOT / ".maestro" / "skill-registry" / "registry.json"
VALID_LOAD_COSTS = {"low", "medium", "high"}


def main() -> int:
    if not REGISTRY_PATH.exists():
        print("Skill registry is missing.")
        return 1

    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    registry_skills = payload.get("skills", [])
    by_name = {entry.get("name"): entry for entry in registry_skills}
    active_skill_names = {path.name for path in list_skill_dirs(ACTIVE_SKILLS_DIR)}

    missing = sorted(active_skill_names - set(by_name))
    invalid_paths = sorted(
        name
        for name, entry in by_name.items()
        if name in active_skill_names and "skills-archive" in entry.get("path", "")
    )
    invalid_metadata = []
    for name, entry in by_name.items():
        if name not in active_skill_names:
            continue
        if entry.get("load_cost") not in VALID_LOAD_COSTS:
            invalid_metadata.append(f"{name}: invalid load_cost")
        if not isinstance(entry.get("routing_boost", 0), int):
            invalid_metadata.append(f"{name}: routing_boost must be an integer")
        for field in ("tags", "phase", "stack", "aliases", "requires", "conflicts_with"):
            if not isinstance(entry.get(field, []), list):
                invalid_metadata.append(f"{name}: {field} must be a list")

    if missing or invalid_paths or invalid_metadata:
        if missing:
            print("Active skills missing from registry:")
            for name in missing[:50]:
                print(f"- {name}")
        if invalid_paths:
            print("Registry entries leaked archived paths:")
            for name in invalid_paths:
                print(f"- {name}")
        if invalid_metadata:
            print("Registry entries failed metadata validation:")
            for issue in invalid_metadata[:50]:
                print(f"- {issue}")
        return 1

    print(f"Skill registry validation passed for {len(active_skill_names)} active skills.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
