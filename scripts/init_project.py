#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PROFILE = "mixed-workbench"
COPY_ROOTS = (
    Path("AGENTS.md"),
    Path(".maestro"),
    Path("scripts"),
    Path("docs"),
)
SKIP_NAME_PARTS = {
    "__pycache__",
    ".DS_Store",
    ".git",
    "node_modules",
}
SKIP_PREFIXES = (
    Path(".maestro/provider-packs/copilot/github/skills"),
    Path(".maestro/skills-archive"),
    Path(".maestro/telemetry"),
    Path(".maestro/evals/results"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Copy the Maestro template core into a target project directory and "
            "generate the selected provider adapters there."
        )
    )
    parser.add_argument(
        "target",
        nargs="?",
        default=".",
        help="Target project directory. Defaults to the current directory.",
    )
    parser.add_argument(
        "--profile",
        default=DEFAULT_PROFILE,
        help=(
            "Named provider profile to apply after copying. "
            f"Defaults to '{DEFAULT_PROFILE}'."
        ),
    )
    parser.add_argument(
        "--providers",
        help="Comma-separated provider list to use instead of a named profile.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Enable every supported provider instead of using a named profile.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Run verification after bootstrapping the target project.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite conflicting Maestro-managed files in the target directory.",
    )
    return parser.parse_args()


def should_skip(relative_path: Path) -> bool:
    if any(part in SKIP_NAME_PARTS for part in relative_path.parts):
        return True
    if relative_path.parent == Path(".maestro/skills") and relative_path.name.startswith("SKILL_INDEX_"):
        return True
    if relative_path == Path(".maestro/skills/SKILL_INDEX.md"):
        return True
    return any(relative_path == prefix or prefix in relative_path.parents for prefix in SKIP_PREFIXES)


def remove_path(path: Path) -> None:
    if not path.exists() and not path.is_symlink():
        return
    if path.is_symlink() or path.is_file():
        path.unlink()
    else:
        shutil.rmtree(path)


def scan_conflicts(source: Path, destination: Path, conflicts: list[Path]) -> None:
    relative_path = source.relative_to(ROOT)
    if should_skip(relative_path):
        return

    if source.is_symlink() or source.is_file():
        if destination.exists() or destination.is_symlink():
            conflicts.append(destination)
        return

    if source.is_dir():
        if destination.exists() and not destination.is_dir():
            conflicts.append(destination)
            return
        for child in sorted(source.iterdir()):
            scan_conflicts(child, destination / child.name, conflicts)


def copy_entry(source: Path, destination: Path, force: bool) -> None:
    relative_path = source.relative_to(ROOT)
    if should_skip(relative_path):
        return

    if source.is_symlink():
        if force:
            remove_path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.symlink_to(os.readlink(source))
        return

    if source.is_file():
        if force:
            remove_path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return

    destination.mkdir(parents=True, exist_ok=True)
    for child in sorted(source.iterdir()):
        copy_entry(child, destination / child.name, force)


def bootstrap_target(target_root: Path, args: argparse.Namespace) -> None:
    command = [sys.executable, str(target_root / "scripts" / "bootstrap_providers.py")]
    if args.all:
        command.append("--all")
    elif args.providers:
        command.extend(["--providers", args.providers])
    else:
        command.extend(["--profile", args.profile])
    if args.verify:
        command.append("--verify")
    subprocess.check_call(command, cwd=target_root)


def main() -> int:
    args = parse_args()
    target_root = Path(args.target).expanduser().resolve()

    selection_flags = [bool(args.providers), bool(args.all)]
    if sum(selection_flags) > 1:
        print("Use only one of --profile, --providers, or --all.")
        return 1

    target_root.mkdir(parents=True, exist_ok=True)

    conflicts: list[Path] = []
    if not args.force:
        for relative_root in COPY_ROOTS:
            source = ROOT / relative_root
            destination = target_root / relative_root
            scan_conflicts(source, destination, conflicts)

    if conflicts:
        print("Conflicting files already exist in the target directory:")
        for path in conflicts[:20]:
            print(f"- {path}")
        if len(conflicts) > 20:
            print(f"- ... and {len(conflicts) - 20} more")
        print("Re-run with --force to overwrite Maestro-managed files.")
        return 1

    for relative_root in COPY_ROOTS:
        source = ROOT / relative_root
        destination = target_root / relative_root
        copy_entry(source, destination, args.force)

    bootstrap_target(target_root, args)

    print("")
    print("Maestro project initialized.")
    print(f"Target: {target_root}")
    if args.all:
        print("Selected providers: all")
    elif args.providers:
        print(f"Selected providers: {args.providers}")
    else:
        print(f"Selected profile: {args.profile}")
    print(f"Next: cd {target_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
