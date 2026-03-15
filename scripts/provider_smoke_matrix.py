#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / ".maestro" / "provider-packs" / "providers.json"
PROJECT_PROVIDERS_PATH = ROOT / ".maestro" / "project-providers.json"

CHECKS = (
    "sync_agents.py",
    "provider_config_validator.py",
    "policy_guard.py",
    "checklist.py",
)


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_selected_providers(providers: list[str]) -> None:
    PROJECT_PROVIDERS_PATH.write_text(
        json.dumps({"selected_providers": providers}, indent=2) + "\n",
        encoding="utf-8",
    )


def run_script(script_name: str) -> tuple[bool, str]:
    command = [sys.executable, str(ROOT / "scripts" / script_name)]
    result = subprocess.run(command, capture_output=True, text=True, cwd=ROOT)
    output = result.stdout
    if result.stderr:
        output = output + ("\n" if output else "") + result.stderr
    return result.returncode == 0, output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run provider generation smoke tests across named profiles."
    )
    parser.add_argument(
        "--profiles",
        help="Comma-separated profile ids. Defaults to every profile marked smoke=true.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = load_json(MANIFEST_PATH)
    profiles = manifest.get("profiles", {})

    if args.profiles:
        profile_ids = [item.strip() for item in args.profiles.split(",") if item.strip()]
    else:
        profile_ids = [
            profile_id
            for profile_id, metadata in sorted(profiles.items())
            if metadata.get("smoke")
        ]

    invalid = [profile_id for profile_id in profile_ids if profile_id not in profiles]
    if invalid:
        print("Unknown profile ids:", ", ".join(invalid))
        return 1

    original_payload = None
    if PROJECT_PROVIDERS_PATH.exists():
        original_payload = PROJECT_PROVIDERS_PATH.read_text(encoding="utf-8")

    failures: list[str] = []
    try:
        for profile_id in profile_ids:
            metadata = profiles[profile_id]
            providers = sorted(set(metadata.get("providers", [])))
            print(f"=== Smoke Profile: {profile_id} ===")
            print("Providers:", ", ".join(providers))
            write_selected_providers(providers)

            for script_name in CHECKS:
                ok, output = run_script(script_name)
                print(output, end="" if output.endswith("\n") else "\n")
                if not ok:
                    failures.append(f"{profile_id}: {script_name}")
                    break
    finally:
        if original_payload is not None:
            PROJECT_PROVIDERS_PATH.write_text(original_payload, encoding="utf-8")
        else:
            write_selected_providers(sorted(manifest.get("supported_providers", {}).keys()))

        ok, output = run_script("sync_agents.py")
        print(output, end="" if output.endswith("\n") else "\n")
        if not ok:
            failures.append("restore: sync_agents.py")

    if failures:
        print("Provider smoke matrix failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("Provider smoke matrix passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
