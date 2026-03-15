#!/usr/bin/env python3
from __future__ import annotations

import sys

from skill_profile_support import ACTIVE_SKILLS_DIR, get_profile, list_skill_dirs


def main() -> int:
    profile = get_profile()
    active_skill_names = sorted(path.name for path in list_skill_dirs(ACTIVE_SKILLS_DIR))
    unexpected = [name for name in active_skill_names if not profile.should_keep(name)]

    print(f"Skill profile validator: {profile.name}")
    print(f"Active skill count: {len(active_skill_names)}")

    if unexpected:
        print("Unexpected active skills found outside the preferred stack:")
        for name in unexpected[:50]:
            print(f"- {name}")
        if len(unexpected) > 50:
            print(f"- ... and {len(unexpected) - 50} more")
        return 1

    print("Preferred stack skill surface is clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

