#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATE_KEY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


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


def load_manifest(path: Path) -> list[dict[str, Any]]:
    data = load_json(path)
    if data.get("schema_version") != 1:
        raise ValueError("Manifest schema_version must be 1.")
    repos = data.get("repos")
    if not isinstance(repos, list):
        raise ValueError("Manifest must include repos[].")
    return [item for item in repos if isinstance(item, dict)]


def resolve_repo_path(raw_path: str, manifest_path: Path) -> Path:
    path = Path(raw_path).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (manifest_path.parent / path).resolve()


def parse_date_key(key: str) -> datetime | None:
    if not DATE_KEY_RE.match(key):
        return None
    try:
        return datetime.strptime(key, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


@dataclass
class WeeklyAggregate:
    repos_covered: int = 0
    total_decisions: int = 0
    blocked_decisions: int = 0
    overridden_decisions: int = 0
    ai_heavy_pr_count: int = 0
    strong_override_reasons: int = 0
    weak_override_reasons: int = 0
    missing_override_reasons: int = 0
    top_rule_counter: Counter[str] = None  # type: ignore[assignment]
    top_signal_counter: Counter[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.top_rule_counter is None:
            self.top_rule_counter = Counter()
        if self.top_signal_counter is None:
            self.top_signal_counter = Counter()


def collect_reports(
    manifest_path: Path,
    repos: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    by_week: dict[str, WeeklyAggregate] = defaultdict(WeeklyAggregate)
    latest_by_repo: dict[str, dict[str, Any]] = {}

    for repo in repos:
        name = str(repo.get("name", "unknown"))
        team = str(repo.get("team", "unknown"))
        raw_path = str(repo.get("path", "")).strip()
        if not raw_path:
            continue
        root = resolve_repo_path(raw_path, manifest_path)
        reports_root = root / ".guardian" / "pilot-reports"
        if not reports_root.exists():
            continue

        latest_key = ""
        latest_payload: dict[str, Any] | None = None
        for entry in reports_root.iterdir():
            if not entry.is_dir():
                continue
            week_key = entry.name
            if parse_date_key(week_key) is None:
                continue
            report_path = entry / "dashboard_lite.json"
            if not report_path.exists():
                continue
            payload = load_json(report_path)
            metrics = payload.get("metrics", {})
            override_quality = payload.get("override_reason_quality", {})
            if not isinstance(metrics, dict) or not isinstance(override_quality, dict):
                continue

            agg = by_week[week_key]
            agg.repos_covered += 1
            agg.total_decisions += int(metrics.get("total_decisions", 0) or 0)
            agg.blocked_decisions += int(metrics.get("blocked_decisions", 0) or 0)
            agg.overridden_decisions += int(metrics.get("overridden_decisions", 0) or 0)
            agg.ai_heavy_pr_count += int(metrics.get("ai_heavy_pr_count", 0) or 0)
            agg.strong_override_reasons += int(override_quality.get("strong", 0) or 0)
            agg.weak_override_reasons += int(override_quality.get("weak", 0) or 0)
            agg.missing_override_reasons += int(override_quality.get("missing", 0) or 0)
            top_rule = str(metrics.get("top_policy_rule", "")).strip()
            top_signal = str(metrics.get("most_frequent_policy_signal", "")).strip()
            if top_rule:
                agg.top_rule_counter[top_rule] += 1
            if top_signal:
                agg.top_signal_counter[top_signal] += 1

            if week_key > latest_key:
                latest_key = week_key
                latest_payload = {
                    "repo": name,
                    "team": team,
                    "path": str(root),
                    "week": week_key,
                    "metrics": metrics,
                    "override_reason_quality": override_quality,
                }

        if latest_payload:
            latest_by_repo[name] = latest_payload

    weekly: dict[str, dict[str, Any]] = {}
    for week_key, agg in by_week.items():
        block_rate = (
            agg.blocked_decisions / agg.total_decisions if agg.total_decisions else 0.0
        )
        override_coverage = (
            agg.overridden_decisions / agg.blocked_decisions if agg.blocked_decisions else 0.0
        )
        override_reason_coverage = (
            agg.strong_override_reasons / agg.overridden_decisions
            if agg.overridden_decisions
            else 0.0
        )
        weekly[week_key] = {
            "repos_covered": agg.repos_covered,
            "total_decisions": agg.total_decisions,
            "blocked_decisions": agg.blocked_decisions,
            "overridden_decisions": agg.overridden_decisions,
            "ai_heavy_pr_count": agg.ai_heavy_pr_count,
            "block_rate": round(block_rate, 4),
            "override_coverage": round(override_coverage, 4),
            "override_reason_coverage": round(override_reason_coverage, 4),
            "override_reason_quality": {
                "strong": agg.strong_override_reasons,
                "weak": agg.weak_override_reasons,
                "missing": agg.missing_override_reasons,
            },
            "top_policy_rule": (
                agg.top_rule_counter.most_common(1)[0][0]
                if agg.top_rule_counter
                else ""
            ),
            "top_policy_signal": (
                agg.top_signal_counter.most_common(1)[0][0]
                if agg.top_signal_counter
                else ""
            ),
        }

    return weekly, latest_by_repo


def trend_direction(first: float, last: float, epsilon: float = 0.01) -> str:
    delta = last - first
    if delta > epsilon:
        return "increasing"
    if delta < -epsilon:
        return "decreasing"
    return "flat"


def build_payload(
    manifest_path: Path,
    weekly: dict[str, dict[str, Any]],
    latest_by_repo: dict[str, dict[str, Any]],
    min_repos: int,
    min_weeks: int,
    override_reason_threshold: float,
) -> dict[str, Any]:
    ordered_weeks = sorted(weekly.keys())
    latest_week = ordered_weeks[-1] if ordered_weeks else ""
    latest = weekly.get(latest_week, {})

    block_rate_series = [float(weekly[w].get("block_rate", 0.0)) for w in ordered_weeks]
    ai_heavy_series = [int(weekly[w].get("ai_heavy_pr_count", 0)) for w in ordered_weeks]
    block_rate_trend = (
        trend_direction(block_rate_series[0], block_rate_series[-1])
        if len(block_rate_series) >= 2
        else "insufficient_data"
    )
    ai_heavy_trend = (
        trend_direction(float(ai_heavy_series[0]), float(ai_heavy_series[-1]), epsilon=0.5)
        if len(ai_heavy_series) >= 2
        else "insufficient_data"
    )

    strict_stable_repos = sum(
        1
        for repo in latest_by_repo.values()
        if repo.get("week") == latest_week
        and int(repo.get("metrics", {}).get("total_decisions", 0) or 0) > 0
    )

    override_reason_coverage = float(latest.get("override_reason_coverage", 0.0) or 0.0)
    exit_gate = {
        "strict_gate_active_stable": strict_stable_repos >= min_repos,
        "strict_gate_active_stable_repos": strict_stable_repos,
        "override_reason_coverage_met": override_reason_coverage >= override_reason_threshold,
        "override_reason_coverage": round(override_reason_coverage, 4),
        "override_reason_threshold": override_reason_threshold,
        "block_rate_trend_reported": len(ordered_weeks) >= min_weeks,
        "minimum_weeks_required": min_weeks,
        "weeks_available": len(ordered_weeks),
    }

    return {
        "schema_version": 1,
        "generated_at": now_iso(),
        "manifest_path": str(manifest_path),
        "series": {
            "weeks": ordered_weeks,
            "weekly": weekly,
        },
        "latest_week": latest_week,
        "latest_repo_snapshot": latest_by_repo,
        "trends": {
            "block_rate_direction": block_rate_trend,
            "ai_heavy_direction": ai_heavy_trend,
            "block_rate_series": block_rate_series,
            "ai_heavy_series": ai_heavy_series,
        },
        "exit_gate": exit_gate,
    }


def markdown_report(payload: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# Pilot Rollout Trend Report")
    lines.append("")
    lines.append(f"- Generated At: {payload.get('generated_at', '')}")
    lines.append(f"- Manifest: {payload.get('manifest_path', '')}")
    lines.append(f"- Latest Week: {payload.get('latest_week', '')}")
    lines.append("")
    lines.append("## Weekly Trend")
    lines.append("")
    lines.append("| Week | Repos | Total | Blocked | Overridden | AI-heavy | Block Rate | Override Reason Coverage |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    weekly = payload.get("series", {}).get("weekly", {})
    for week in payload.get("series", {}).get("weeks", []):
        row = weekly.get(week, {})
        lines.append(
            "| {week} | {repos} | {total} | {blocked} | {overridden} | {ai_heavy} | {block_rate} | {reason_cov} |".format(
                week=week,
                repos=row.get("repos_covered", 0),
                total=row.get("total_decisions", 0),
                blocked=row.get("blocked_decisions", 0),
                overridden=row.get("overridden_decisions", 0),
                ai_heavy=row.get("ai_heavy_pr_count", 0),
                block_rate=row.get("block_rate", 0.0),
                reason_cov=row.get("override_reason_coverage", 0.0),
            )
        )
    lines.append("")
    trends = payload.get("trends", {})
    lines.append("## Trend Direction")
    lines.append("")
    lines.append(f"- Block Rate Direction: {trends.get('block_rate_direction', 'unknown')}")
    lines.append(f"- AI-heavy Direction: {trends.get('ai_heavy_direction', 'unknown')}")
    lines.append("")
    exit_gate = payload.get("exit_gate", {})
    lines.append("## Exit Gate Snapshot")
    lines.append("")
    lines.append(
        f"- strict_gate_active_stable: {exit_gate.get('strict_gate_active_stable', False)} "
        f"(repos={exit_gate.get('strict_gate_active_stable_repos', 0)})"
    )
    lines.append(
        f"- override_reason_coverage_met: {exit_gate.get('override_reason_coverage_met', False)} "
        f"(coverage={exit_gate.get('override_reason_coverage', 0.0)} "
        f"threshold={exit_gate.get('override_reason_threshold', 0.95)})"
    )
    lines.append(
        f"- block_rate_trend_reported: {exit_gate.get('block_rate_trend_reported', False)} "
        f"(weeks={exit_gate.get('weeks_available', 0)}/{exit_gate.get('minimum_weeks_required', 4)})"
    )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Aggregate pilot weekly rollout trend metrics.")
    parser.add_argument("--manifest", required=True, help="Pilot manifest path.")
    parser.add_argument(
        "--output-dir",
        default=".guardian/pilot-rollout-trend",
        help="Output directory for trend report artifacts.",
    )
    parser.add_argument(
        "--min-repos",
        type=int,
        default=2,
        help="Minimum repos for strict gate active/stable condition.",
    )
    parser.add_argument(
        "--min-weeks",
        type=int,
        default=4,
        help="Minimum weekly snapshots required for trend-reported gate.",
    )
    parser.add_argument(
        "--override-reason-threshold",
        type=float,
        default=0.95,
        help="Threshold for override reason coverage gate.",
    )
    parser.add_argument(
        "--fail-on-exit-gate",
        action="store_true",
        help="Return non-zero when any exit-gate flag is false.",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest).expanduser().resolve()
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    repos = load_manifest(manifest_path)
    weekly, latest_by_repo = collect_reports(manifest_path, repos)
    payload = build_payload(
        manifest_path=manifest_path,
        weekly=weekly,
        latest_by_repo=latest_by_repo,
        min_repos=args.min_repos,
        min_weeks=args.min_weeks,
        override_reason_threshold=args.override_reason_threshold,
    )

    out_dir = Path(args.output_dir).expanduser().resolve() / utc_date()
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "rollout_trend.json"
    md_path = out_dir / "rollout_trend.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(payload) + "\n", encoding="utf-8")

    print(f"Pilot rollout trend JSON: {json_path}")
    print(f"Pilot rollout trend MD:   {md_path}")

    if args.fail_on_exit_gate:
        exit_gate = payload.get("exit_gate", {})
        if not all(
            bool(exit_gate.get(key, False))
            for key in (
                "strict_gate_active_stable",
                "override_reason_coverage_met",
                "block_rate_trend_reported",
            )
        ):
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

