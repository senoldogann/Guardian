#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def newest_summary_file(summary_dir: Path) -> Path:
    candidates = sorted(summary_dir.glob("*/summary.json"))
    if not candidates:
        raise FileNotFoundError(f"No summary.json found under {summary_dir}")
    return candidates[-1]


def markdown_report(payload: dict[str, Any]) -> str:
    lines: list[str] = [
        "# Release Leak-Prevented Cases",
        "",
        f"- Generated At: {payload.get('generated_at', '')}",
        f"- Source Summary: {payload.get('source_summary', '')}",
        f"- Total Cases: {payload.get('totals', {}).get('cases', 0)}",
        f"- Prevented Release: {payload.get('totals', {}).get('prevented_release', 0)}",
        f"- Controlled Override: {payload.get('totals', {}).get('controlled_override', 0)}",
        "",
        "## Cases",
        "",
    ]
    for case in payload.get("cases", []):
        lines.append(
            f"- [{case.get('type', 'case')}] {case.get('repo', '')} -> {case.get('decision', '')} ({case.get('status', '')})"
        )
        lines.append(f"  - next_action: {case.get('next_action', '')}")
        lines.append(f"  - report_path: {case.get('report_path', '')}")
    if not payload.get("cases"):
        lines.append("- no cases in this window")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect leak-prevented pilot cases.")
    parser.add_argument("--summary-dir", required=True, help="Directory containing pilot dry-run summaries.")
    parser.add_argument(
        "--output-dir",
        default=".guardian/pilot-leak-cases",
        help="Output directory for leak case reports.",
    )
    args = parser.parse_args()

    summary_dir = Path(args.summary_dir).expanduser().resolve()
    output_base = Path(args.output_dir).expanduser().resolve()
    source_summary = newest_summary_file(summary_dir)

    with source_summary.open("r", encoding="utf-8") as handle:
        summary = json.load(handle)

    cases: list[dict[str, Any]] = []
    prevented_release = 0
    controlled_override = 0

    for repo in summary.get("repos", []):
        if not isinstance(repo, dict):
            continue
        decision = str(repo.get("decision", "UNKNOWN"))
        status = str(repo.get("status", "UNKNOWN"))
        if status == "BLOCKED":
            prevented_release += 1
            cases.append(
                {
                    "type": "prevented_release",
                    "repo": repo.get("name", ""),
                    "decision": decision,
                    "status": status,
                    "next_action": repo.get("next_action", ""),
                    "report_path": repo.get("report_path", ""),
                }
            )
        elif status == "OVERRIDDEN" and bool(repo.get("override_reason_used")):
            controlled_override += 1
            cases.append(
                {
                    "type": "controlled_override",
                    "repo": repo.get("name", ""),
                    "decision": decision,
                    "status": status,
                    "next_action": repo.get("next_action", ""),
                    "report_path": repo.get("report_path", ""),
                }
            )

    payload = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "source_summary": str(source_summary),
        "totals": {
            "cases": len(cases),
            "prevented_release": prevented_release,
            "controlled_override": controlled_override,
        },
        "cases": cases,
    }

    out_dir = output_base / utc_date()
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "leak_cases.json"
    md_path = out_dir / "leak_cases.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(payload) + "\n", encoding="utf-8")

    print(f"Leak case report written: {json_path}")
    print(f"Leak case markdown written: {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
