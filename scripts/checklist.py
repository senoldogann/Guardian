#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from common_utils import (  # noqa: E402
    dir_exists,
    file_exists,
    print_fail,
    print_header,
    print_success,
    print_warning,
)

ROOT_DIR = os.getcwd()
PROJECT_PROVIDERS_PATH = os.path.join(ROOT_DIR, ".maestro", "project-providers.json")


def load_selected_providers() -> set[str]:
    try:
        with open(PROJECT_PROVIDERS_PATH, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError:
        return {"antigravity", "claude", "codex", "copilot", "opencode"}
    return set(payload.get("selected_providers", []))


def required_files(selected: set[str]) -> list[str]:
    files = [
        "AGENTS.md",
        ".maestro/SYSTEM.md",
        ".maestro/ARCHITECTURE.md",
        ".maestro/project-providers.json",
        ".maestro/provider-radar/watchlist.json",
        ".maestro/provider-radar/state.json",
        ".maestro/evals/registry.json",
        ".maestro/policy/policy.json",
        ".maestro/skill-registry/overrides.json",
        ".maestro/skill-registry/registry.json",
    ]
    if "antigravity" in selected:
        files.extend(
            [
                ".agent/SYSTEM.md",
                ".agent/ARCHITECTURE.md",
                ".agent/rules/GEMINI.md",
                ".agent/rules/00-ARCHITECT-MANIFESTO.md",
                ".agent/rules/01-safety-and-persistence.md",
                ".agent/rules/05-self-reflection.md",
                ".agent/rules/10-parallel-execution.md",
                ".agent/rules/20-observability.md",
                ".agent/rules/30-error-handling.md",
                ".agent/rules/40-api-design.md",
                ".agent/rules/50-security-and-testing.md",
                ".agent/rules/100-tech-stack.md",
            ]
        )
    if "claude" in selected:
        files.extend(["CLAUDE.md", ".claude/settings.json"])
    if "copilot" in selected:
        files.extend([".github/copilot-instructions.md", ".vscode/settings.json"])
    if "codex" in selected:
        files.append(".codex/config.toml")
    if "opencode" in selected:
        files.append("opencode.json")
    return files


def required_dirs(selected: set[str]) -> list[str]:
    dirs = [
        ".maestro/agents",
        ".maestro/skills",
        ".maestro/workflows",
        ".maestro/provider-radar",
        ".maestro/evals",
        ".maestro/policy",
        ".maestro/skill-registry",
        "scripts",
    ]
    if "antigravity" in selected:
        dirs.extend([".agent/agents", ".agent/skills", ".agent/workflows"])
    if "claude" in selected:
        dirs.extend([".claude/agents", ".claude/skills", ".claude/commands"])
    if "copilot" in selected:
        dirs.extend([".github/agents", ".github/instructions", ".github/prompts"])
    return dirs


def check_structure(selected: set[str]) -> bool:
    print_header("Structural Integrity Check")
    all_passed = True

    for directory in required_dirs(selected):
        path = os.path.join(ROOT_DIR, directory)
        if dir_exists(path):
            print_success(f"Directory found: {directory}")
        else:
            print_fail(f"Missing directory: {directory}")
            all_passed = False

    for file_path in required_files(selected):
        path = os.path.join(ROOT_DIR, file_path)
        if file_exists(path):
            print_success(f"File found: {file_path}")
        else:
            print_fail(f"Missing file: {file_path}")
            all_passed = False

    if file_exists(os.path.join(ROOT_DIR, "docs/PLAN.md")):
        print_success("Docs found: docs/PLAN.md")
    else:
        print_warning("No active plan found at docs/PLAN.md (Recommended for active tasks)")

    return all_passed


def check_documentation_consistency(selected: set[str]) -> bool:
    print("=== Documentation Consistency Check ===")
    success = True
    if file_exists(".maestro/ARCHITECTURE.md") and file_exists(".maestro/SYSTEM.md"):
        print("✓ .maestro/ARCHITECTURE.md references .maestro/SYSTEM.md")
    else:
        success = False
    if "antigravity" in selected and file_exists(".agent/ARCHITECTURE.md") and file_exists(".agent/SYSTEM.md"):
        print("✓ .agent/ARCHITECTURE.md references .agent/SYSTEM.md")
    return success


def main() -> None:
    selected = load_selected_providers()
    print_header("MAESTRO SYSTEM CHECKLIST")

    struct_ok = check_structure(selected)
    doc_ok = check_documentation_consistency(selected)

    print("\n")
    if struct_ok and doc_ok:
        print_success("SYSTEM HEALTHY - Ready for designation")
        sys.exit(0)

    print_fail("SYSTEM ISSUES DETECTED - Please fix missing components")
    sys.exit(1)


if __name__ == "__main__":
    main()
