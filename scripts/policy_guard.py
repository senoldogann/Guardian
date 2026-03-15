#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from pathlib import Path

from maestro_telemetry import traced_script
from skill_profile_support import ACTIVE_SKILLS_DIR, ROOT, list_skill_dirs

POLICY_PATH = ROOT / ".maestro" / "policy" / "policy.json"
MANIFEST_PATH = ROOT / ".maestro" / "provider-packs" / "providers.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def file_size(path: Path) -> int:
    return path.stat().st_size if path.exists() else 0


def main() -> int:
    with traced_script("policy_guard") as trace:
        policy = load_json(POLICY_PATH)
        manifest = load_json(MANIFEST_PATH)
        errors: list[str] = []

        supported_policy = sorted(policy.get("supported_provider_ids", []))
        supported_manifest = sorted(manifest.get("supported_providers", {}).keys())
        if supported_policy != supported_manifest:
            errors.append("Policy supported_provider_ids drifted from providers.json")

        for relative_path, max_bytes in policy.get("always_on_doc_max_bytes", {}).items():
            path = ROOT / relative_path
            if path.exists() and file_size(path) > max_bytes:
                errors.append(
                    f"{relative_path} exceeds size budget ({file_size(path)} > {max_bytes})"
                )

        active_skill_count = len(list_skill_dirs(ACTIVE_SKILLS_DIR))
        if active_skill_count > int(policy.get("max_active_skills", 400)):
            errors.append(
                f"Active skill count exceeds policy budget ({active_skill_count})"
            )

        for relative_path in policy.get("skill_symlink_paths", []):
            path = ROOT / relative_path
            if not path.exists():
                continue
            if path.is_symlink() and "skills-archive" in os.readlink(path):
                errors.append(f"Archived skills leaked through provider bridge: {relative_path}")

        claude_path = ROOT / ".claude" / "settings.json"
        if claude_path.exists():
            claude = load_json(claude_path)
            deny_entries = claude.get("permissions", {}).get("deny", [])
            for required in policy.get("claude_required_denies", []):
                if required not in deny_entries:
                    errors.append(f"Claude deny rule missing: {required}")

        opencode_path = ROOT / "opencode.json"
        if opencode_path.exists():
            opencode = load_json(opencode_path)
            bash_deny = set(opencode.get("permission", {}).get("bash", {}))
            read_deny = set(opencode.get("permission", {}).get("read", {}))
            for required in policy.get("opencode_required_bash_denies", []):
                if required not in bash_deny:
                    errors.append(f"OpenCode bash deny missing: {required}")
            for required in policy.get("opencode_required_read_denies", []):
                if required not in read_deny:
                    errors.append(f"OpenCode read deny missing: {required}")

        trace.event("policy-check-complete", {"error_count": len(errors)})
        if errors:
            print("Policy guard failures:")
            for error in errors:
                print(f"- {error}")
            return 1

        print("Policy guard passed.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

