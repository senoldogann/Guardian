#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from skill_profile_support import ACTIVE_SKILLS_DIR, ROOT, get_profile, list_skill_dirs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Keep only the preferred engineering skill surface active and archive the rest."
        )
    )
    parser.add_argument(
        "--profile",
        default="preferred-stack",
        help="Skill profile name. Defaults to preferred-stack.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without moving any skills.",
    )
    return parser.parse_args()


def replace_path(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() or destination.is_symlink():
        if destination.is_dir() and not destination.is_symlink():
            shutil.rmtree(destination)
        else:
            destination.unlink()
    shutil.move(str(source), str(destination))


def main() -> int:
    args = parse_args()
    profile = get_profile(args.profile)

    active_names = {path.name for path in list_skill_dirs(ACTIVE_SKILLS_DIR)}
    archived_names = {path.name for path in list_skill_dirs(profile.archive_dir)}

    to_archive = sorted(
        skill_name for skill_name in active_names if not profile.should_keep(skill_name)
    )
    to_restore = sorted(
        skill_name
        for skill_name in archived_names
        if profile.should_keep(skill_name) and skill_name not in active_names
    )

    print(f"Skill profile: {profile.name}")
    print(profile.description)
    print(f"Active skills before: {len(active_names)}")
    print(f"Archive target: {profile.archive_dir}")
    print(f"Will archive: {len(to_archive)}")
    print(f"Will restore: {len(to_restore)}")

    if to_archive:
        print("Archive sample:", ", ".join(to_archive[:20]))
    if to_restore:
        print("Restore sample:", ", ".join(to_restore[:20]))

    if args.dry_run:
        return 0

    for skill_name in to_archive:
        replace_path(
            ACTIVE_SKILLS_DIR / skill_name,
            profile.archive_dir / skill_name,
        )

    for skill_name in to_restore:
        replace_path(
            profile.archive_dir / skill_name,
            ACTIVE_SKILLS_DIR / skill_name,
        )

    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "generate_skill_index.py")])
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "build_skill_registry.py")])

    active_after = len(list_skill_dirs(ACTIVE_SKILLS_DIR))
    print(f"Active skills after: {active_after}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
