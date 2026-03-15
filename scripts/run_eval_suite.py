#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from maestro_telemetry import traced_script

ROOT = Path(__file__).resolve().parent.parent
REGISTRY_PATH = ROOT / ".maestro" / "evals" / "registry.json"
RESULTS_DIR = ROOT / ".maestro" / "evals" / "results"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Maestro infrastructure evals.")
    parser.add_argument("--category", help="Optional task category filter.")
    parser.add_argument("--tasks", help="Comma-separated task ids.")
    parser.add_argument("--no-save", action="store_true", help="Do not write result files.")
    return parser.parse_args()


def load_registry() -> list[dict]:
    payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return payload.get("tasks", [])


def matches_filters(task: dict, category: str | None, task_ids: set[str]) -> bool:
    if category and task.get("category") != category:
        return False
    if task_ids and task.get("id") not in task_ids:
        return False
    return True


def run_task(task: dict) -> dict:
    started = time.time()
    result = subprocess.run(
        task["command"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    output = result.stdout
    if result.stderr:
        output = output + ("\n" if output else "") + result.stderr

    required_output = task.get("required_output_contains", [])
    missing_output = [item for item in required_output if item not in output]
    passed = result.returncode == task["expected_exit_code"] and not missing_output
    return {
        "id": task["id"],
        "description": task["description"],
        "category": task["category"],
        "status": "passed" if passed else "failed",
        "exit_code": result.returncode,
        "duration_seconds": round(time.time() - started, 3),
        "missing_output": missing_output,
        "command": task["command"],
        "output": output,
    }


def main() -> int:
    args = parse_args()
    requested_ids = {
        item.strip() for item in (args.tasks or "").split(",") if item.strip()
    }
    tasks = [
        task
        for task in load_registry()
        if matches_filters(task, args.category, requested_ids)
    ]

    with traced_script(
        "run_eval_suite",
        {"task_count": len(tasks), "category": args.category or ""},
    ) as trace:
        results = [run_task(task) for task in tasks]
        failed = [result for result in results if result["status"] != "passed"]
        summary = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "task_count": len(results),
            "passed": len(results) - len(failed),
            "failed": len(failed),
            "results": results,
        }
        if not args.no_save:
            RESULTS_DIR.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            (RESULTS_DIR / "latest.json").write_text(
                json.dumps(summary, indent=2) + "\n",
                encoding="utf-8",
            )
            (RESULTS_DIR / f"eval-{timestamp}.json").write_text(
                json.dumps(summary, indent=2) + "\n",
                encoding="utf-8",
            )
        trace.event("eval-suite-complete", {"failed": len(failed), "passed": len(results) - len(failed)})

    print(f"Eval suite completed. Passed={summary['passed']} Failed={summary['failed']}")
    if failed:
        print("Failed tasks:")
        for result in failed:
            print(f"- {result['id']}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

