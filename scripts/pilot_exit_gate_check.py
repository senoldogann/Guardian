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
    min_weeks: int,
    min_total_decisions: int,
    min_ai_heavy_decisions: int,
) -> tuple[list[GateCheck], dict[str, int]]:
    trend_exit = trend.get("exit_gate", {}) if isinstance(trend.get("exit_gate"), dict) else {}
    series = trend.get("series", {}) if isinstance(trend.get("series"), dict) else {}
    weeks = series.get("weeks", [])
    weekly = series.get("weekly", {}) if isinstance(series.get("weekly"), dict) else {}
    weeks_available = len(weeks) if isinstance(weeks, list) else 0

    strict_stable = boolish(trend_exit.get("strict_gate_active_stable"))
    strict_repos = int(trend_exit.get("strict_gate_active_stable_repos", 0) or 0)

    override_met = boolish(trend_exit.get("override_reason_coverage_met"))
    override_cov = float(trend_exit.get("override_reason_coverage", 0.0) or 0.0)
    override_threshold = float(trend_exit.get("override_reason_threshold", 0.95) or 0.95)

    total_decisions = 0
    ai_heavy_decisions = 0
    if isinstance(weeks, list):
        for week in weeks:
            if not isinstance(week, str):
                continue
            row = weekly.get(week, {}) if isinstance(weekly.get(week), dict) else {}
            total_decisions += int(row.get("total_decisions", 0) or 0)
            ai_heavy_decisions += int(row.get("ai_heavy_pr_count", 0) or 0)

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
            name="trend_window",
            passed=weeks_available >= min_weeks,
            detail=f"weeks={weeks_available}/{min_weeks}",
        ),
        GateCheck(
            name="decision_volume",
            passed=total_decisions >= min_total_decisions,
            detail=f"total_decisions={total_decisions} required>={min_total_decisions}",
        ),
        GateCheck(
            name="ai_heavy_volume",
            passed=ai_heavy_decisions >= min_ai_heavy_decisions,
            detail=f"ai_heavy_decisions={ai_heavy_decisions} required>={min_ai_heavy_decisions}",
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
    ], {
        "weeks_available": weeks_available,
        "total_decisions": total_decisions,
        "ai_heavy_decisions": ai_heavy_decisions,
    }


def next_actions(gates: list[GateCheck]) -> list[str]:
    actions: list[str] = []
    for gate in gates:
        if gate.passed:
            continue
        if gate.name == "trend_window":
            actions.append(
                "Continue weekly real pilot cadence until minimum trend window is met."
            )
        elif gate.name == "decision_volume":
            actions.append(
                "Increase real pilot decision volume (more strict dry-run cycles across design-partner repos)."
            )
        elif gate.name == "ai_heavy_volume":
            actions.append(
                "Increase AI-heavy sampled decision count before sign-off."
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
    lines.append(f"- Launch Ready: {payload.get('pilot_complete', False)}")
    lines.append(f"- GA Ready: {payload.get('ga_complete', False)}")
    lines.append(f"- Active Profile: {payload.get('active_profile', 'launch')}")
    lines.append("")
    lines.append("## Active Profile Gate Checks")
    lines.append("")
    lines.append("| Gate | Passed | Detail |")
    lines.append("| --- | --- | --- |")
    for gate in payload.get("active_profile_gates", []):
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
        "--launch-min-weeks",
        type=int,
        default=2,
        help="Minimum trend weeks for launch profile.",
    )
    parser.add_argument(
        "--ga-min-weeks",
        type=int,
        default=4,
        help="Minimum trend weeks for GA profile.",
    )
    parser.add_argument(
        "--launch-min-total-decisions",
        type=int,
        default=40,
        help="Minimum total decisions across trend window for launch profile.",
    )
    parser.add_argument(
        "--launch-min-ai-heavy-decisions",
        type=int,
        default=20,
        help="Minimum AI-heavy decisions across trend window for launch profile.",
    )
    parser.add_argument(
        "--ga-min-total-decisions",
        type=int,
        default=40,
        help="Minimum total decisions across trend window for GA profile.",
    )
    parser.add_argument(
        "--ga-min-ai-heavy-decisions",
        type=int,
        default=20,
        help="Minimum AI-heavy decisions across trend window for GA profile.",
    )
    parser.add_argument(
        "--profile",
        choices=("launch", "ga"),
        default="launch",
        help="Profile used by --fail-on-incomplete gate.",
    )
    parser.add_argument(
        "--fail-on-incomplete",
        action="store_true",
        help="Return non-zero exit code when selected profile is not ready.",
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

    launch_gates, launch_metrics = build_gate_checks(
        trend=trend,
        readiness=readiness,
        leak_cases=leak_cases,
        min_prevented_release_cases=args.min_prevented_release_cases,
        min_weeks=args.launch_min_weeks,
        min_total_decisions=args.launch_min_total_decisions,
        min_ai_heavy_decisions=args.launch_min_ai_heavy_decisions,
    )
    ga_gates, ga_metrics = build_gate_checks(
        trend=trend,
        readiness=readiness,
        leak_cases=leak_cases,
        min_prevented_release_cases=args.min_prevented_release_cases,
        min_weeks=args.ga_min_weeks,
        min_total_decisions=args.ga_min_total_decisions,
        min_ai_heavy_decisions=args.ga_min_ai_heavy_decisions,
    )
    launch_ready = all(gate.passed for gate in launch_gates)
    ga_ready = all(gate.passed for gate in ga_gates)
    active_gates = launch_gates if args.profile == "launch" else ga_gates
    active_ready = launch_ready if args.profile == "launch" else ga_ready
    actions = next_actions(active_gates)

    payload = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "active_profile": args.profile,
        "sources": {
            "trend_json": str(trend_path),
            "readiness_json": str(readiness_path) if readiness_path else None,
            "leak_cases_json": str(leak_cases_path) if leak_cases_path else None,
        },
        "pilot_complete": launch_ready,
        "ga_complete": ga_ready,
        "profiles": {
            "launch": {
                "ready": launch_ready,
                "thresholds": {
                    "min_weeks": args.launch_min_weeks,
                    "min_total_decisions": args.launch_min_total_decisions,
                    "min_ai_heavy_decisions": args.launch_min_ai_heavy_decisions,
                    "min_prevented_release_cases": args.min_prevented_release_cases,
                },
                "metrics": launch_metrics,
                "gates": [
                    {"name": gate.name, "passed": gate.passed, "detail": gate.detail}
                    for gate in launch_gates
                ],
            },
            "ga": {
                "ready": ga_ready,
                "thresholds": {
                    "min_weeks": args.ga_min_weeks,
                    "min_total_decisions": args.ga_min_total_decisions,
                    "min_ai_heavy_decisions": args.ga_min_ai_heavy_decisions,
                    "min_prevented_release_cases": args.min_prevented_release_cases,
                },
                "metrics": ga_metrics,
                "gates": [
                    {"name": gate.name, "passed": gate.passed, "detail": gate.detail}
                    for gate in ga_gates
                ],
            },
        },
        "active_profile_gates": [
            {"name": gate.name, "passed": gate.passed, "detail": gate.detail}
            for gate in active_gates
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
    print(f"pilot_complete={launch_ready}")
    print(f"ga_complete={ga_ready}")
    print(f"{args.profile}_ready={active_ready}")

    if args.fail_on_incomplete and not active_ready:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
