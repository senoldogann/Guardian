#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from maestro_telemetry import traced_script
from skill_profile_support import ACTIVE_SKILLS_DIR, ROOT, list_skill_dirs

REGISTRY_DIR = ROOT / ".maestro" / "skill-registry"
OVERRIDES_PATH = REGISTRY_DIR / "overrides.json"
REGISTRY_PATH = REGISTRY_DIR / "registry.json"
SUPPORTED_PROVIDERS = ["antigravity", "claude", "codex", "copilot", "opencode"]


TAG_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("azure", ("azure", "cloud")),
    ("react-native", ("react-native", "mobile")),
    ("expo", ("react-native", "mobile", "frontend")),
    ("react", ("react", "frontend")),
    ("typescript", ("typescript", "frontend")),
    ("tailwind", ("frontend", "design")),
    ("frontend", ("frontend", "design")),
    ("python", ("python", "backend")),
    ("rust", ("rust", "backend")),
    ("golang", ("go", "backend")),
    ("go-", ("go", "backend")),
    ("nodejs", ("nodejs", "backend")),
    ("fastapi", ("python", "backend", "api")),
    ("security", ("security",)),
    ("vulnerability", ("security",)),
    ("audit", ("security", "review")),
    ("testing", ("testing",)),
    ("test", ("testing",)),
    ("playwright", ("testing", "frontend")),
    ("deployment", ("ci-cd", "deployment")),
    ("gitops", ("ci-cd", "deployment")),
    ("github", ("ci-cd", "automation")),
    ("terraform", ("ci-cd", "infrastructure")),
    ("kubernetes", ("ci-cd", "infrastructure")),
    ("k8s", ("ci-cd", "infrastructure")),
    ("architecture", ("architecture",)),
    ("architect", ("architecture",)),
    ("design", ("design", "architecture")),
    ("observability", ("observability", "operations")),
    ("slo", ("observability", "operations")),
    ("prometheus", ("observability", "operations")),
    ("trace", ("observability", "operations")),
    ("workflow", ("automation",)),
    ("router", ("automation",)),
]

PHASE_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("plan", ("plan",)),
    ("brainstorm", ("plan",)),
    ("architect", ("plan", "design")),
    ("design", ("design",)),
    ("build", ("implement",)),
    ("developer", ("implement",)),
    ("development", ("implement",)),
    ("builder", ("implement",)),
    ("scaffold", ("implement",)),
    ("test", ("verify",)),
    ("review", ("verify",)),
    ("audit", ("verify",)),
    ("validator", ("verify",)),
    ("debug", ("verify",)),
    ("fix", ("verify",)),
    ("deploy", ("operate",)),
    ("observability", ("operate",)),
    ("incident", ("operate",)),
    ("slo", ("operate",)),
]

STACK_TAGS = {
    "azure",
    "react",
    "typescript",
    "react-native",
    "python",
    "rust",
    "go",
    "frontend",
    "backend",
    "mobile",
    "security",
    "testing",
    "architecture",
    "ci-cd",
    "observability",
    "deployment",
}


def load_overrides() -> dict:
    if not OVERRIDES_PATH.exists():
        return {"skills": {}}
    return json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))


def extract_description(skill_dir: Path) -> str:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return ""
    text = skill_md.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return ""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return ""
    for line in parts[1].splitlines():
        if line.strip().startswith("description:"):
            return line.split(":", 1)[1].strip().strip('"')
    return ""


def dir_size_bytes(path: Path) -> int:
    total = 0
    for child in path.rglob("*"):
        if child.is_file():
            total += child.stat().st_size
    return total


def infer_tags(name: str, description: str) -> list[str]:
    haystack = f"{name} {description}".lower()
    tags: set[str] = set()
    for needle, mapped_tags in TAG_RULES:
        if needle in haystack:
            tags.update(mapped_tags)
    return sorted(tags)


def infer_phase(name: str, description: str) -> list[str]:
    haystack = f"{name} {description}".lower()
    phases: set[str] = set()
    for needle, mapped_phases in PHASE_RULES:
        if needle in haystack:
            phases.update(mapped_phases)
    if not phases:
        phases.add("implement")
    return sorted(phases)


def infer_risk(tags: list[str], name: str) -> str:
    name_l = name.lower()
    if "security" in tags or any(
        token in name_l for token in ("deployment", "policy", "secret", "vulnerability")
    ):
        return "high"
    if any(tag in tags for tag in ("architecture", "ci-cd", "cloud", "observability")):
        return "medium"
    return "low"


def infer_stack(tags: list[str]) -> list[str]:
    return sorted(tag for tag in tags if tag in STACK_TAGS)


def infer_load_cost(approx_bytes: int) -> str:
    if approx_bytes < 50_000:
        return "low"
    if approx_bytes < 160_000:
        return "medium"
    return "high"


def merge_override(entry: dict, override: dict) -> dict:
    merged = dict(entry)
    for key, value in override.items():
        merged[key] = value
    return merged


def main() -> int:
    with traced_script("build_skill_registry") as trace:
        overrides = load_overrides().get("skills", {})
        entries: list[dict] = []

        for skill_dir in list_skill_dirs(ACTIVE_SKILLS_DIR):
            name = skill_dir.name
            description = extract_description(skill_dir)
            tags = infer_tags(name, description)
            approx_bytes = dir_size_bytes(skill_dir)
            entry = {
                "name": name,
                "path": str(skill_dir.relative_to(ROOT)),
                "description": description,
                "tags": tags,
                "phase": infer_phase(name, description),
                "risk": infer_risk(tags, name),
                "stack": infer_stack(tags),
                "aliases": [],
                "requires": [],
                "conflicts_with": [],
                "load_cost": infer_load_cost(approx_bytes),
                "routing_boost": 0,
                "provider_support": SUPPORTED_PROVIDERS,
                "approx_bytes": approx_bytes,
            }
            entry = merge_override(entry, overrides.get(name, {}))
            entries.append(entry)

        entries.sort(key=lambda item: item["name"])
        REGISTRY_DIR.mkdir(parents=True, exist_ok=True)
        REGISTRY_PATH.write_text(
            json.dumps(
                {
                    "version": 1,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                    "skills": entries,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        trace.event("registry-built", {"skill_count": len(entries)})
        print(f"Built skill registry with {len(entries)} active skills.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
