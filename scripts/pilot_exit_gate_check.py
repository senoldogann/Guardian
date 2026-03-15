#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return data


def latest_dated_json(base_dir: Path, filename: str) -> Path | None:
    if not base_dir.exists():
        return None
    dated_dirs = sorted(
        [entry for entry in base_dir.iterdir() if entry.is_dir() and entry.name.count("-") == 2],
        key=lambda entry: entry.name,
    )
    for entry in reversed(dated_dirs):
        candidate = entry / filename
        if candidate.exists():
            return candidate
    return None


@dataclass
class GateCheck:
    name: str
    passed: bool
    detail: str


def boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def build_gate_checks(
    trend: dict[str, Any],
    readiness: dict[str, Any] | None,
    leak_cases: dict[str, Any] | None,
    min_prevented_release_cases: int,
) -> list[GateCheck]:
    trend_exit = trend.get("exit_gate", {}) if isinstance(trend.get("exit_gate"), dict) else {}

    strict_stable = boolish(trend_exit.get("strict_gate_active_stable"))
    strict_repos = int(trend_exit.get("strict_gate_active_stable_repos", 0) or 0)

    override_met = boolish(trend_exit.get("override_reason_coverage_met"))
    override_cov = float(trend_exit.get("override_reason_coverage", 0.0) or 0.0)
    override_threshold = float(trend_exit.get("override_reason_threshold", 0.95) or 0.95)

    trend_reported = boolish(trend_exit.get("block_rate_trend_reported"))
    weeks_available = int(trend_exit.get("weeks_available", 0) or 0)
    weeks_required = int(trend_exit.get("minimum_weeks_required", 4) or 4)

    readiness_status = "UNKNOWN"
    readiness_ok = False
    if isinstance(readiness, dict):
        readiness_status = str(readiness.get("status", "UNKNOWN"))
        readiness_ok = readiness_status.upper() == "READY"

    prevented_release = 0
    if isinstance(leak_cases, dict):
        totals = leak_cases.get("totals", {})
        if isinstance(totals, dict):
            prevented_release = int(totals.get("prevented_release", 0) or 0)
    leak_gate_ok = prevented_release >= min_prevented_release_cases

    return [
        GateCheck(
            name="strict_gate_active_stable",
            passed=strict_stable,
            detail=f"repos={strict_repos}",
        ),
        GateCheck(
            name="override_reason_coverage",
            passed=override_met,
            detail=f"coverage={override_cov:.4f} threshold={override_threshold:.4f}",
        ),
        GateCheck(
            name="block_rate_trend_reported",
            passed=trend_reported,
            detail=f"weeks={weeks_available}/{weeks_required}",
        ),
        GateCheck(
            name="pilot_readiness_status",
            passed=readiness_ok,
            detail=f"status={readiness_status}",
        ),
        GateCheck(
            name="critical_leak_prevention_evidence",
            passed=leak_gate_ok,
            detail=f"prevented_release={prevented_release} required>={min_prevented_release_cases}",
        ),
    ]


def next_actions(gates: list[GateCheck]) -> list[str]:
    actions: list[str] = []
    for gate in gates:
        if gate.passed:
            continue
        if gate.name == "block_rate_trend_reported":
            actions.append(
                "Continue weekly real pilot cadence until minimum trend window is met."
            )
        elif gate.name == "override_reason_coverage":
            actions.append(
                "Increase override reason quality coverage to threshold (strong reasons only)."
            )
        elif gate.name == "strict_gate_active_stable":
            actions.append(
                "Keep strict gate active in at least 2 design-partner repos with stable dry-run."
            )
        elif gate.name == "critical_leak_prevention_evidence":
            actions.append(
                "Capture at least one prevented_release case from strict gate outputs."
            )
        elif gate.name == "pilot_readiness_status":
            actions.append("Resolve readiness blockers before pilot-complete sign-off.")
        else:
            actions.append(f"Resolve gate: {gate.name}")
    return actions


def markdown_report(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Pilot Exit Gate Status")
    lines.append("")
    lines.append(f"- Generated At: {payload.get('generated_at', '')}")
    lines.append(f"- Pilot Complete: {payload.get('pilot_complete', False)}")
    lines.append("")
    lines.append("## Gate Checks")
    lines.append("")
    lines.append("| Gate | Passed | Detail |")
    lines.append("| --- | --- | --- |")
    for gate in payload.get("gates", []):
        lines.append(
            "| {name} | {passed} | {detail} |".format(
                name=gate.get("name", ""),
                passed="yes" if gate.get("passed", False) else "no",
                detail=gate.get("detail", ""),
            )
        )
    lines.append("")
    lines.append("## Next Actions")
    lines.append("")
    actions = payload.get("next_actions", [])
    if not actions:
        lines.append("- Pilot complete. Proceed to GA packaging.")
    else:
        for action in actions:
            lines.append(f"- {action}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate Phase 5 pilot exit-gate readiness.")
    parser.add_argument(
        "--trend-json",
        help="Path to rollout_trend.json. If omitted, latest file under .guardian/pilot-rollout-trend is used.",
    )
    parser.add_argument(
        "--readiness-json",
        help="Path to readiness.json. If omitted, latest file under .guardian/pilot-real-readiness is used.",
    )
    parser.add_argument(
        "--leak-cases-json",
        help="Path to leak_cases.json. If omitted, latest file under .guardian/pilot-leak-cases-real then .guardian/pilot-leak-cases is used.",
    )
    parser.add_argument(
        "--output-dir",
        default=".guardian/pilot-exit-gate",
        help="Output directory for exit gate status artifacts.",
    )
    parser.add_argument(
        "--min-prevented-release-cases",
        type=int,
        default=1,
        help="Minimum prevented_release evidence required for completion gate.",
    )
    parser.add_argument(
        "--fail-on-incomplete",
        action="store_true",
        help="Return non-zero exit code when pilot_complete=false.",
    )
    args = parser.parse_args()

    trend_path = (
        Path(args.trend_json).expanduser().resolve()
        if args.trend_json
        else latest_dated_json(Path(".guardian/pilot-rollout-trend"), "rollout_trend.json")
    )
    if trend_path is None or not trend_path.exists():
        raise SystemExit(
            "rollout_trend.json not found. Run scripts/pilot_generate_rollout_trend.sh first."
        )

    readiness_path = (
        Path(args.readiness_json).expanduser().resolve()
        if args.readiness_json
        else latest_dated_json(Path(".guardian/pilot-real-readiness"), "readiness.json")
    )

    leak_cases_path = (
        Path(args.leak_cases_json).expanduser().resolve()
        if args.leak_cases_json
        else latest_dated_json(Path(".guardian/pilot-leak-cases-real"), "leak_cases.json")
        or latest_dated_json(Path(".guardian/pilot-leak-cases"), "leak_cases.json")
    )

    trend = load_json(trend_path)
    readiness = load_json(readiness_path) if readiness_path and readiness_path.exists() else None
    leak_cases = load_json(leak_cases_path) if leak_cases_path and leak_cases_path.exists() else None

    gates = build_gate_checks(
        trend=trend,
        readiness=readiness,
        leak_cases=leak_cases,
        min_prevented_release_cases=args.min_prevented_release_cases,
    )
    pilot_complete = all(gate.passed for gate in gates)
    actions = next_actions(gates)

    payload = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "sources": {
            "trend_json": str(trend_path),
            "readiness_json": str(readiness_path) if readiness_path else None,
            "leak_cases_json": str(leak_cases_path) if leak_cases_path else None,
        },
        "pilot_complete": pilot_complete,
        "gates": [
            {"name": gate.name, "passed": gate.passed, "detail": gate.detail}
            for gate in gates
        ],
        "next_actions": actions,
    }

    out_dir = Path(args.output_dir).expanduser().resolve() / utc_date()
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "exit_gate_status.json"
    md_path = out_dir / "exit_gate_status.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(payload) + "\n", encoding="utf-8")

    print(f"Pilot exit-gate JSON: {json_path}")
    print(f"Pilot exit-gate MD:   {md_path}")
    print(f"pilot_complete={pilot_complete}")

    if args.fail_on_incomplete and not pilot_complete:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
