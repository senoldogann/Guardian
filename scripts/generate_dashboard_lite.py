#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso8601(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return data if isinstance(data, dict) else {}


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict):
                rows.append(row)
    return rows


def classify_override_reason(reason: str | None) -> str:
    if reason is None or not reason.strip():
        return "missing"
    text = reason.strip().lower()
    if len(text) < 25:
        return "weak"
    strong_tokens = (
        "incident",
        "hotfix",
        "rollback",
        "mitigation",
        "validated",
        "risk",
        "customer",
        "production",
        "outage",
    )
    matches = sum(1 for token in strong_tokens if token in text)
    return "strong" if matches >= 2 else "weak"


@dataclass(frozen=True)
class PolicySignal:
    pack: str
    rule: str


def map_signal_to_policy(signal: str) -> PolicySignal:
    lower = signal.lower()
    if "critical" in lower:
        return PolicySignal("secrets_security_hygiene", "block_on_critical")
    if "warning" in lower:
        return PolicySignal("api_backend_guardrails", "warning_budget_guardrail")
    if "ai-heavy" in lower or "human approval" in lower:
        return PolicySignal(
            "ai_generated_code_strict_mode",
            "ai_heavy_requires_human_approval",
        )
    if "refactor" in lower or "architectural drift" in lower:
        return PolicySignal("clean_architecture", "architectural_drift_guardrail")
    if "override" in lower:
        return PolicySignal("release_controls", "override_requires_audit_reason")
    return PolicySignal("release_controls", "api_backend_guardrail")


def compute_dashboard(
    root: Path,
    window_days: int,
    team: str,
    repo: str,
) -> dict[str, Any]:
    now = utc_now()
    window_start = now - timedelta(days=window_days)

    guardian_dir = root / ".guardian"
    audit_path = guardian_dir / "release_decisions.jsonl"
    latest_report_path = guardian_dir / "release_gate_report.json"

    audit_rows = load_jsonl(audit_path)
    window_rows: list[dict[str, Any]] = []
    for row in audit_rows:
        ts = parse_iso8601(str(row.get("timestamp", "")))
        if ts is None:
            continue
        if ts >= window_start:
            window_rows.append(row)

    latest_report = load_json(latest_report_path) if latest_report_path.exists() else {}

    decision_counter: Counter[str] = Counter()
    ai_heavy_count = 0
    override_reason_quality: Counter[str] = Counter({"strong": 0, "weak": 0, "missing": 0})

    for row in window_rows:
        decision = str(row.get("decision", "UNKNOWN"))
        decision_counter[decision] += 1
        if bool(row.get("ai_heavy_change", False)):
            ai_heavy_count += 1
        if decision == "OVERRIDDEN":
            quality = classify_override_reason(row.get("override_reason"))
            override_reason_quality[quality] += 1

    if not window_rows and latest_report:
        decision = str(latest_report.get("release_decision", "UNKNOWN"))
        if decision:
            decision_counter[decision] += 1
            ai_heavy_count += 1 if bool(latest_report.get("ai_heavy_change", False)) else 0

    total_decisions = sum(decision_counter.values())
    blocked = decision_counter.get("BLOCK_UNTIL_APPROVED", 0)
    overridden = decision_counter.get("OVERRIDDEN", 0)

    block_rate = (blocked / total_decisions) if total_decisions else 0.0
    override_coverage = (overridden / blocked) if blocked else 0.0
    override_reason_coverage = (
        override_reason_quality["strong"] / overridden if overridden else 0.0
    )

    reason_counter: Counter[str] = Counter()
    policy_pack_counter: Counter[str] = Counter()
    policy_rule_counter: Counter[str] = Counter()
    for reason in latest_report.get("decision_reasons", []):
        if not isinstance(reason, str) or not reason.strip():
            continue
        reason_counter[reason] += 1
        mapped = map_signal_to_policy(reason)
        policy_pack_counter[mapped.pack] += 1
        policy_rule_counter[mapped.rule] += 1

    for decision, count in decision_counter.items():
        if decision == "OVERRIDDEN":
            mapped = map_signal_to_policy("override")
            policy_pack_counter[mapped.pack] += count
            policy_rule_counter[mapped.rule] += count
        elif decision == "BLOCK_UNTIL_APPROVED":
            mapped = map_signal_to_policy("warning")
            policy_pack_counter[mapped.pack] += count
            policy_rule_counter[mapped.rule] += count

    most_frequent_policy_signal = ""
    if reason_counter:
        most_frequent_policy_signal = reason_counter.most_common(1)[0][0]
    elif latest_report:
        most_frequent_policy_signal = str(
            next(iter(latest_report.get("decision_reasons", [])), "")
        )

    top_policy_rule = (
        policy_rule_counter.most_common(1)[0][0]
        if policy_rule_counter
        else "api_backend_guardrail"
    )

    return {
        "schema_version": 2,
        "generated_at": now.isoformat(),
        "root": str(root),
        "pilot": {"team": team, "repo": repo},
        "reporting_window": {
            "days": window_days,
            "start": window_start.isoformat(),
            "end": now.isoformat(),
        },
        "metrics": {
            "total_decisions": total_decisions,
            "ai_heavy_pr_count": ai_heavy_count,
            "blocked_decisions": blocked,
            "overridden_decisions": overridden,
            "block_rate": round(block_rate, 4),
            "override_coverage": round(override_coverage, 4),
            "override_reason_coverage": round(override_reason_coverage, 4),
            "most_frequent_policy_signal": most_frequent_policy_signal,
            "top_policy_rule": top_policy_rule,
        },
        "decision_breakdown": dict(decision_counter),
        "policy_pack_breakdown": dict(policy_pack_counter),
        "policy_rule_breakdown": dict(policy_rule_counter),
        "override_reason_quality": {
            "missing": override_reason_quality["missing"],
            "strong": override_reason_quality["strong"],
            "weak": override_reason_quality["weak"],
        },
        "source_files": {
            "audit": str(audit_path),
            "latest_gate_report": str(latest_report_path),
        },
    }


def markdown_report(report: dict[str, Any]) -> str:
    metrics = report.get("metrics", {})
    decision_breakdown = report.get("decision_breakdown", {})
    override_quality = report.get("override_reason_quality", {})
    policy_packs = report.get("policy_pack_breakdown", {})
    policy_rules = report.get("policy_rule_breakdown", {})
    pilot = report.get("pilot", {})
    window = report.get("reporting_window", {})

    lines: list[str] = []
    lines.append("# Guardian Dashboard-Lite Weekly Report")
    lines.append("")
    lines.append(f"- Generated At: {report.get('generated_at', '')}")
    lines.append(f"- Root: {report.get('root', '')}")
    lines.append(
        f"- Pilot Scope: team={pilot.get('team', '')} repo={pilot.get('repo', '')}"
    )
    lines.append(
        f"- Window: {window.get('start', '')} -> {window.get('end', '')} ({window.get('days', 7)} days)"
    )
    lines.append("")
    lines.append("## KPI Snapshot")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("| --- | ---: |")
    lines.append(f"| Total Decisions | {metrics.get('total_decisions', 0)} |")
    lines.append(f"| AI-heavy Count | {metrics.get('ai_heavy_pr_count', 0)} |")
    lines.append(f"| Blocked Decisions | {metrics.get('blocked_decisions', 0)} |")
    lines.append(f"| Overridden Decisions | {metrics.get('overridden_decisions', 0)} |")
    lines.append(f"| Block Rate | {metrics.get('block_rate', 0.0)} |")
    lines.append(f"| Override Coverage | {metrics.get('override_coverage', 0.0)} |")
    lines.append(
        f"| Override Reason Coverage | {metrics.get('override_reason_coverage', 0.0)} |"
    )
    lines.append(f"| Top Policy Rule | {metrics.get('top_policy_rule', '')} |")
    lines.append("")
    lines.append("## Decision Breakdown")
    lines.append("")
    for decision, count in sorted(decision_breakdown.items()):
        lines.append(f"- {decision}: {count}")
    if not decision_breakdown:
        lines.append("- no decision data")
    lines.append("")
    lines.append("## Override Reason Quality")
    lines.append("")
    lines.append(f"- strong: {override_quality.get('strong', 0)}")
    lines.append(f"- weak: {override_quality.get('weak', 0)}")
    lines.append(f"- missing: {override_quality.get('missing', 0)}")
    lines.append("")
    lines.append("## Top Policy Packs")
    lines.append("")
    if policy_packs:
        for pack, count in sorted(policy_packs.items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"- {pack}: {count}")
    else:
        lines.append("- no policy pack signal")
    lines.append("")
    lines.append("## Top Policy Rules")
    lines.append("")
    if policy_rules:
        for rule, count in sorted(policy_rules.items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"- {rule}: {count}")
    else:
        lines.append("- no policy rule signal")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate dashboard-lite pilot report.")
    parser.add_argument("--root", default=".", help="Target repository root.")
    parser.add_argument("--window-days", type=int, default=7, help="Rolling window in days.")
    parser.add_argument(
        "--format",
        choices=("json", "markdown", "both"),
        default="json",
        help="Output format.",
    )
    parser.add_argument("--out", default="", help="JSON output file path.")
    parser.add_argument("--md-out", default="", help="Markdown output file path.")
    parser.add_argument("--team", default="unknown", help="Pilot team label.")
    parser.add_argument("--repo", default="unknown", help="Pilot repo label.")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    report = compute_dashboard(root=root, window_days=args.window_days, team=args.team, repo=args.repo)

    if args.format in ("json", "both"):
        if args.out:
            out_path = Path(args.out)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        else:
            print(json.dumps(report, indent=2))

    if args.format in ("markdown", "both"):
        md = markdown_report(report)
        if args.md_out:
            md_path = Path(args.md_out)
            md_path.parent.mkdir(parents=True, exist_ok=True)
            md_path.write_text(md + "\n", encoding="utf-8")
        elif args.format == "markdown":
            print(md)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
