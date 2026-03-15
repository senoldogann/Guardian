#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate unified governance summary from .guardian/critiques.json")
    parser.add_argument("--root", default=".", help="Workspace root path")
    return parser.parse_args()


def normalize_severity(raw: Any) -> str:
    value = str(raw or "").strip().lower()
    if value == "critical":
        return "Critical"
    if value == "warning":
        return "Warning"
    if value == "info":
        return "Info"
    return "Info"


def release_recommendation(critical: int, warning: int) -> str:
    if critical > 0:
        return "BLOCK_UNTIL_APPROVED"
    if warning > 0:
        return "PASS_WITH_WARNING"
    return "PASS"


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    guardian_dir = root / ".guardian"
    critiques_path = guardian_dir / "critiques.json"
    out_json = guardian_dir / "governance_summary.json"
    out_md = guardian_dir / "governance_summary.md"

    guardian_dir.mkdir(parents=True, exist_ok=True)

    critiques: list[dict[str, Any]] = []
    if critiques_path.exists():
        try:
            payload = json.loads(critiques_path.read_text(encoding="utf-8"))
            loaded = payload.get("critiques", [])
            if isinstance(loaded, list):
                critiques = [item for item in loaded if isinstance(item, dict)]
        except Exception:
            critiques = []

    critical = sum(1 for item in critiques if normalize_severity(item.get("severity")) == "Critical")
    warning = sum(1 for item in critiques if normalize_severity(item.get("severity")) == "Warning")
    info = sum(1 for item in critiques if normalize_severity(item.get("severity")) == "Info")
    total = critical + warning + info
    recommendation = release_recommendation(critical, warning)
    generated_at = datetime.now(timezone.utc).isoformat()

    summary_payload = {
        "schema_version": 1,
        "generated_at": generated_at,
        "root": str(root),
        "summary": {
            "total_findings": total,
            "critical": critical,
            "warning": warning,
            "info": info,
            "release_recommendation": recommendation,
        },
        "consumer_guides": {
            "ide": "Prioritize Critical issues and resolve before merge.",
            "cli": "Use guardian-cli scan --release-gate strict in CI.",
            "llm_agents": "Read critiques + release gate report before suggesting release decision.",
        },
        "findings": critiques,
    }

    out_json.write_text(json.dumps(summary_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        "# Guardian Governance Summary",
        f"Updated: {generated_at}",
        "",
        f"- Root: `{root}`",
        f"- Recommendation: `{recommendation}`",
        f"- Counts: critical=`{critical}` warning=`{warning}` info=`{info}` total=`{total}`",
        "",
        "## Findings",
    ]
    if not critiques:
        lines.append("- No active findings.")
    else:
        for item in critiques[:50]:
            lines.append(
                f"- [{normalize_severity(item.get('severity'))}] `{item.get('file_path', 'unknown')}`: {item.get('message', '')}"
            )
        if len(critiques) > 50:
            lines.append(f"- ... {len(critiques) - 50} more findings in `governance_summary.json`")

    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Governance summary generated: {out_json}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
