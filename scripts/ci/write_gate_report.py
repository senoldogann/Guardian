#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report-type", required=True)
    parser.add_argument("--status", required=True, choices=["pass", "warning", "fail"])
    parser.add_argument("--policy", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--note", action="append", default=[])
    parser.add_argument("--metadata", action="append", default=[])
    parser.add_argument(
        "--command",
        action="append",
        nargs=3,
        metavar=("LABEL", "STATUS", "ARTIFACT_PATH"),
        default=[],
    )
    return parser.parse_args()


def normalize_metadata(entries: list[str]) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for entry in entries:
        if "=" not in entry:
            raise ValueError(f"Invalid metadata entry: {entry}")
        key, value = entry.split("=", 1)
        metadata[key] = value
    return metadata


def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "schema_version": 1,
        "report_type": args.report_type,
        "status": args.status,
        "policy": args.policy,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "git": {
            "sha": os.getenv("GITHUB_SHA"),
            "ref": os.getenv("GITHUB_REF"),
            "run_id": os.getenv("GITHUB_RUN_ID"),
            "run_attempt": os.getenv("GITHUB_RUN_ATTEMPT"),
        },
        "metadata": normalize_metadata(args.metadata),
        "commands": [
            {
                "label": label,
                "status": status,
                "artifact_path": artifact_path,
            }
            for label, status, artifact_path in args.command
        ],
        "notes": args.note,
    }

    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


if __name__ == "__main__":
    main()