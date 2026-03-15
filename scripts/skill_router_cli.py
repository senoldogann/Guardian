#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from maestro_telemetry import traced_script

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / ".maestro" / "skill-registry" / "registry.json"

QUERY_SYNONYMS = {
    "frontend": {"frontend", "react", "typescript", "design", "ui"},
    "backend": {"backend", "api", "python", "go", "rust", "nodejs"},
    "mobile": {"mobile", "react-native", "expo"},
    "azure": {"azure", "cloud", "deployment", "infrastructure", "security", "observability"},
    "security": {"security", "audit", "vulnerability"},
    "testing": {"testing", "qa", "playwright", "e2e"},
    "cicd": {"ci-cd", "deployment", "github", "terraform", "kubernetes", "gitops"},
    "platform": {"azure", "cloud", "infrastructure", "architecture", "security", "observability"},
    "architecture": {"architecture", "design"},
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Route tasks to the best active skills.")
    parser.add_argument("--query", required=True, help="Natural-language task description.")
    parser.add_argument("--limit", type=int, default=10, help="Max results to return.")
    parser.add_argument("--provider", help="Filter by provider support.")
    parser.add_argument("--phase", help="Prefer a specific phase such as plan, implement, verify, operate.")
    parser.add_argument("--require", help="Comma-separated skills that must appear in the top results.")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text.")
    return parser.parse_args()


def tokenize(text: str) -> list[str]:
    normalized = text.lower().replace("ci/cd", "cicd")
    return [token for token in re.split(r"[^a-z0-9.+-]+", normalized) if token]


def tokenize_many(items: list[str]) -> set[str]:
    tokens: set[str] = set()
    for item in items:
        tokens.update(tokenize(item))
    return tokens


def load_registry() -> list[dict]:
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return payload.get("skills", [])


def score_entry(entry: dict, tokens: list[str], provider: str | None, phase: str | None) -> int:
    name = entry.get("name", "").lower()
    description = entry.get("description", "").lower()
    name_tokens = set(tokenize(name))
    description_tokens = set(tokenize(description))
    tags = {tag.lower() for tag in entry.get("tags", [])}
    stack = {tag.lower() for tag in entry.get("stack", [])}
    aliases = tokenize_many(entry.get("aliases", []))
    phases = {item.lower() for item in entry.get("phase", [])}
    providers = {item.lower() for item in entry.get("provider_support", [])}
    signals = tags | stack | aliases

    score = 0
    matched: set[str] = set()
    for token in tokens:
        if token == name:
            score += 150
            matched.add(token)
        if token in name_tokens:
            score += 55
            matched.add(token)
        elif token in name:
            score += 35
            matched.add(token)
        if token in tags:
            score += 48
            matched.add(token)
        if token in aliases:
            score += 44
            matched.add(token)
        if token in stack:
            score += 28
            matched.add(token)
        if token in description_tokens:
            score += 12
            matched.add(token)
        for synonym, mapped in QUERY_SYNONYMS.items():
            if token == synonym:
                overlap = len(signals.intersection(mapped))
                if overlap:
                    score += overlap * 18
                    matched.add(token)

    score += len(matched) * 18
    if tokens and len(matched) == len(set(tokens)):
        score += 22

    if provider:
        if provider.lower() in providers:
            score += 20
        else:
            score -= 100

    if phase:
        if phase.lower() in phases:
            score += 30
        else:
            score -= 10

    score += int(entry.get("routing_boost", 0))

    if entry.get("load_cost") == "high":
        score -= 3

    if entry.get("risk") == "medium":
        score += 4
    if entry.get("risk") == "high":
        score += 2
    return score


def main() -> int:
    args = parse_args()
    tokens = tokenize(args.query)
    required = {
        item.strip() for item in (args.require or "").split(",") if item.strip()
    }

    with traced_script(
        "skill_router_cli",
        {"query": args.query, "provider": args.provider or "", "phase": args.phase or ""},
    ) as trace:
        entries = load_registry()
        scored = []
        for entry in entries:
            score = score_entry(entry, tokens, args.provider, args.phase)
            if score > 0:
                scored.append((score, entry))
        scored.sort(key=lambda item: (-item[0], item[1]["name"]))
        top = [entry | {"score": score} for score, entry in scored[: args.limit]]
        trace.event("router-results", {"result_count": len(top)})

        if args.json:
            print(json.dumps({"results": top}, indent=2))
        else:
            for index, entry in enumerate(top, start=1):
                tags = ", ".join(entry.get("tags", []))
                phases = ", ".join(entry.get("phase", []))
                print(
                    f"{index}. {entry['name']}  score={entry['score']}  "
                    f"phase={phases}  risk={entry['risk']}  tags={tags}"
                )

        if required:
            top_names = {entry["name"] for entry in top}
            missing = sorted(required - top_names)
            if missing:
                print("Required skills missing from top router results:", ", ".join(missing))
                return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
