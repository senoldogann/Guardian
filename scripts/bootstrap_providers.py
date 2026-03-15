#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from maestro_telemetry import traced_script

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / ".maestro" / "provider-packs" / "providers.json"
PROJECT_PROVIDERS_PATH = ROOT / ".maestro" / "project-providers.json"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Select which provider adapters should exist in this project."
    )
    parser.add_argument(
        "--profile",
        help="Named provider profile from .maestro/provider-packs/providers.json",
    )
    parser.add_argument(
        "--providers",
        help="Comma-separated provider list, for example: codex,copilot",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Enable every supported provider pack.",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List supported provider ids and exit.",
    )
    parser.add_argument(
        "--list-profiles",
        action="store_true",
        help="List named provider profiles and exit.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Run scripts/verify_all.py after syncing the selected providers.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = load_json(MANIFEST_PATH)
    supported = manifest.get("supported_providers", {})
    profiles = manifest.get("profiles", {})

    with traced_script("bootstrap_providers") as trace:
        if args.list:
            print("Supported providers:")
            for provider_id, metadata in sorted(supported.items()):
                print(f"- {provider_id}: {metadata.get('label', provider_id)}")
            return 0

        if args.list_profiles:
            print("Provider profiles:")
            for profile_id, metadata in sorted(profiles.items()):
                providers = ", ".join(metadata.get("providers", []))
                description = metadata.get("description", "")
                print(f"- {profile_id}: {providers}")
                if description:
                    print(f"  {description}")
            return 0

        selection_flags = [
            bool(args.profile),
            bool(args.providers),
            bool(args.all),
        ]
        if sum(selection_flags) > 1:
            print("Use only one of --profile, --providers, or --all.")
            return 1

        if not args.profile and not args.providers and not args.all:
            print(
                "Pass --profile <name>, --providers <list>, or --all. "
                "Use --list-profiles to see named profiles."
            )
            return 1

        if args.profile:
            profile = profiles.get(args.profile)
            if not profile:
                print(f"Unknown profile: {args.profile}")
                return 1
            selected = sorted(set(profile.get("providers", [])))
        elif args.all:
            selected = sorted(supported)
        else:
            selected = sorted(
                {
                    provider.strip()
                    for provider in (args.providers or "").split(",")
                    if provider.strip()
                }
            )

        invalid = sorted(set(selected) - set(supported))
        if invalid:
            print("Unsupported provider ids:", ", ".join(invalid))
            return 1

        write_json(PROJECT_PROVIDERS_PATH, {"selected_providers": selected})
        if args.profile:
            print(f"Selected profile: {args.profile}")
        print("Selected providers:", ", ".join(selected))
        trace.event("providers-selected", {"providers": selected})

        subprocess.check_call([sys.executable, str(ROOT / "scripts" / "sync_agents.py")])

        if args.verify:
            subprocess.check_call([sys.executable, str(ROOT / "scripts" / "verify_all.py")])

        print("Bootstrap complete.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
