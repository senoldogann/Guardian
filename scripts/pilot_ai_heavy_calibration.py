#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

DEFAULT_THRESHOLDS = {
    "changed_files": 15,
    "estimated_changed_lines": 1200,
    "mixed_changed_files": 8,
    "mixed_changed_lines": 700,
}

SUPPORTED_DECISIONS = {
    "PASS",
    "PASS_WITH_WARNING",
    "BLOCK_UNTIL_APPROVED",
    "OVERRIDDEN",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def parse_iso8601(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def round_to(value: float, step: int) -> int:
    if step <= 1:
        return int(round(value))
    return int(round(value / step) * step)


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return data


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


def load_manifest(path: Path) -> list[dict[str, Any]]:
    data = load_json(path)
    if data.get("schema_version") != 1:
        raise ValueError("Manifest schema_version must be 1.")
    repos = data.get("repos")
    if not isinstance(repos, list):
        raise ValueError("Manifest must include repos[].")
    return [repo for repo in repos if isinstance(repo, dict)]


def resolve_repo_path(raw_path: str, manifest_path: Path) -> Path:
    path = Path(raw_path).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (manifest_path.parent / path).resolve()


def read_pass_max_warnings(repo_root: Path) -> int:
    policy_path = repo_root / "guardian.policy.yaml"
    if not policy_path.exists():
        return 5
    for raw in policy_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line.startswith("pass_max_warnings:"):
            _, _, value = line.partition(":")
            try:
                parsed = int(value.strip())
                return max(0, parsed)
            except ValueError:
                return 5
    return 5


@dataclass
class RepoMetrics:
    repo: str
    team: str
    path: str
    window_decisions: int
    ai_heavy_decisions: int
    ai_heavy_blocks: int
    ai_heavy_overrides: int
    ai_heavy_with_signal_fields: int
    ai_heavy_low_signal: int
    rows_scanned: int


def collect_repo_metrics(
    repo: dict[str, Any],
    manifest_path: Path,
    window_start: datetime,
) -> RepoMetrics | None:
    name = str(repo.get("name", "unknown"))
    team = str(repo.get("team", "unknown"))
    raw_path = str(repo.get("path", "")).strip()
    if not raw_path:
        return None
    root = resolve_repo_path(raw_path, manifest_path)
    if not root.exists():
        return None

    pass_max_warnings = read_pass_max_warnings(root)
    rows = load_jsonl(root / ".guardian" / "release_decisions.jsonl")

    decision_count = 0
    ai_heavy_count = 0
    ai_heavy_blocks = 0
    ai_heavy_overrides = 0
    ai_heavy_with_signal_fields = 0
    ai_heavy_low_signal = 0

    for row in rows:
        ts = parse_iso8601(str(row.get("timestamp", "")))
        if ts is None or ts < window_start:
            continue
        decision = str(row.get("decision", "")).strip()
        if decision not in SUPPORTED_DECISIONS:
            continue
        decision_count += 1
        ai_heavy = bool(row.get("ai_heavy_change", False))
        if not ai_heavy:
            continue

        ai_heavy_count += 1
        if decision == "BLOCK_UNTIL_APPROVED":
            ai_heavy_blocks += 1
        if decision == "OVERRIDDEN":
            ai_heavy_overrides += 1

        critical = row.get("critical_findings")
        warning = row.get("warning_findings")
        if isinstance(critical, int) and isinstance(warning, int):
            ai_heavy_with_signal_fields += 1
            if critical == 0 and warning <= pass_max_warnings:
                ai_heavy_low_signal += 1

    return RepoMetrics(
        repo=name,
        team=team,
        path=str(root),
        window_decisions=decision_count,
        ai_heavy_decisions=ai_heavy_count,
        ai_heavy_blocks=ai_heavy_blocks,
        ai_heavy_overrides=ai_heavy_overrides,
        ai_heavy_with_signal_fields=ai_heavy_with_signal_fields,
        ai_heavy_low_signal=ai_heavy_low_signal,
        rows_scanned=len(rows),
    )


def confidence_label(sample_size: int) -> str:
    if sample_size >= 50:
        return "high"
    if sample_size >= 20:
        return "medium"
    return "low"


def derive_recommendation(
    total_decisions: int,
    ai_heavy_rate: float,
    low_signal_rate: float,
    target_min: float,
    target_max: float,
) -> dict[str, Any]:
    action = "keep"
    factor = 1.0
    rationale: list[str] = []

    if total_decisions < 12:
        rationale.append(
            "Sample size is small; keep current thresholds and collect more weekly data."
        )
    else:
        if ai_heavy_rate > target_max and low_signal_rate >= 0.30:
            action = "increase"
            factor = 1.20
            rationale.append(
                "AI-heavy rate is above target and many AI-heavy decisions look low-signal."
            )
        elif ai_heavy_rate > target_max:
            action = "increase"
            factor = 1.10
            rationale.append("AI-heavy rate is above target; reduce review noise.")
        elif ai_heavy_rate < target_min:
            action = "decrease"
            factor = 0.90
            rationale.append("AI-heavy rate is below target; increase recall for risky intake.")
        else:
            rationale.append("AI-heavy rate is within target band; keep current thresholds.")

    if action == "increase":
        factor = clamp(factor, 1.05, 1.40)
    elif action == "decrease":
        factor = clamp(factor, 0.70, 0.95)
    else:
        factor = 1.0

    suggested = dict(DEFAULT_THRESHOLDS)
    if action != "keep":
        suggested["changed_files"] = max(
            4,
            round_to(DEFAULT_THRESHOLDS["changed_files"] * factor, 1),
        )
        suggested["estimated_changed_lines"] = max(
            300,
            round_to(DEFAULT_THRESHOLDS["estimated_changed_lines"] * factor, 50),
        )
        suggested["mixed_changed_files"] = max(
            3,
            round_to(DEFAULT_THRESHOLDS["mixed_changed_files"] * factor, 1),
        )
        suggested["mixed_changed_lines"] = max(
            200,
            round_to(DEFAULT_THRESHOLDS["mixed_changed_lines"] * factor, 50),
        )

    if suggested["mixed_changed_files"] >= suggested["changed_files"]:
        suggested["mixed_changed_files"] = max(3, suggested["changed_files"] - 2)
    if suggested["mixed_changed_lines"] >= suggested["estimated_changed_lines"]:
        suggested["mixed_changed_lines"] = max(200, suggested["estimated_changed_lines"] - 300)

    return {
        "action": action,
        "confidence": confidence_label(total_decisions),
        "factor": round(factor, 3),
        "current_thresholds": DEFAULT_THRESHOLDS,
        "suggested_thresholds": suggested,
        "rationale": rationale,
        "target_band": {
            "ai_heavy_rate_min": target_min,
            "ai_heavy_rate_max": target_max,
        },
        "implementation_hint": (
            "If accepted, update AI-heavy classifier constants in "
            "guardian-scan-policy/src/lib.rs and run cargo test + python3 scripts/verify_all.py."
        ),
    }


def markdown_report(payload: dict[str, Any]) -> str:
    summary = payload.get("summary", {})
    recommendation = payload.get("recommendation", {})
    lines: list[str] = []
    lines.append("# AI-heavy Threshold Calibration")
    lines.append("")
    lines.append(f"- Generated At: {payload.get('generated_at', '')}")
    lines.append(f"- Manifest: {payload.get('manifest_path', '')}")
    lines.append(f"- Window Days: {payload.get('window_days', 0)}")
    lines.append("")
    lines.append("## Aggregate Metrics")
    lines.append("")
    lines.append(f"- Total decisions: {summary.get('total_decisions', 0)}")
    lines.append(f"- AI-heavy decisions: {summary.get('ai_heavy_decisions', 0)}")
    lines.append(f"- AI-heavy rate: {summary.get('ai_heavy_rate', 0.0)}")
    lines.append(f"- AI-heavy block rate: {summary.get('ai_heavy_block_rate', 0.0)}")
    lines.append(f"- AI-heavy override rate: {summary.get('ai_heavy_override_rate', 0.0)}")
    lines.append(f"- AI-heavy low-signal rate: {summary.get('ai_heavy_low_signal_rate', 0.0)}")
    lines.append("")
    lines.append("## Recommendation")
    lines.append("")
    lines.append(f"- Action: {recommendation.get('action', 'keep')}")
    lines.append(f"- Confidence: {recommendation.get('confidence', 'low')}")
    lines.append(f"- Factor: {recommendation.get('factor', 1.0)}")
    lines.append(f"- Current thresholds: {recommendation.get('current_thresholds', {})}")
    lines.append(f"- Suggested thresholds: {recommendation.get('suggested_thresholds', {})}")
    for item in recommendation.get("rationale", []):
        lines.append(f"- Rationale: {item}")
    lines.append("")
    lines.append("## Repo Breakdown")
    lines.append("")
    lines.append("| Repo | Team | Decisions | AI-heavy | AI-heavy Blocks | AI-heavy Overrides | Low-signal AI-heavy |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: |")
    for repo in payload.get("repos", []):
        lines.append(
            "| {repo} | {team} | {decisions} | {ai_heavy} | {blocks} | {overrides} | {low_signal} |".format(
                repo=repo.get("repo", ""),
                team=repo.get("team", ""),
                decisions=repo.get("window_decisions", 0),
                ai_heavy=repo.get("ai_heavy_decisions", 0),
                blocks=repo.get("ai_heavy_blocks", 0),
                overrides=repo.get("ai_heavy_overrides", 0),
                low_signal=repo.get("ai_heavy_low_signal", 0),
            )
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate AI-heavy threshold calibration report from pilot data.")
    parser.add_argument("--manifest", required=True, help="Pilot manifest path.")
    parser.add_argument(
        "--window-days",
        type=int,
        default=30,
        help="Lookback window in days (default: 30).",
    )
    parser.add_argument(
        "--target-min",
        type=float,
        default=0.25,
        help="Lower bound for desired AI-heavy decision rate.",
    )
    parser.add_argument(
        "--target-max",
        type=float,
        default=0.55,
        help="Upper bound for desired AI-heavy decision rate.",
    )
    parser.add_argument(
        "--output-dir",
        default=".guardian/pilot-calibration",
        help="Output directory for calibration artifacts.",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest).expanduser().resolve()
    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")

    target_min = clamp(float(args.target_min), 0.0, 1.0)
    target_max = clamp(float(args.target_max), 0.0, 1.0)
    if target_min > target_max:
        raise SystemExit("target-min must be <= target-max.")

    window_start = datetime.now(timezone.utc) - timedelta(days=max(1, args.window_days))
    repos = load_manifest(manifest_path)

    repo_metrics: list[dict[str, Any]] = []
    total_decisions = 0
    ai_heavy_decisions = 0
    ai_heavy_blocks = 0
    ai_heavy_overrides = 0
    ai_heavy_with_signal_fields = 0
    ai_heavy_low_signal = 0

    for repo in repos:
        metrics = collect_repo_metrics(repo, manifest_path, window_start)
        if metrics is None:
            continue
        payload = {
            "repo": metrics.repo,
            "team": metrics.team,
            "path": metrics.path,
            "rows_scanned": metrics.rows_scanned,
            "window_decisions": metrics.window_decisions,
            "ai_heavy_decisions": metrics.ai_heavy_decisions,
            "ai_heavy_blocks": metrics.ai_heavy_blocks,
            "ai_heavy_overrides": metrics.ai_heavy_overrides,
            "ai_heavy_with_signal_fields": metrics.ai_heavy_with_signal_fields,
            "ai_heavy_low_signal": metrics.ai_heavy_low_signal,
        }
        repo_metrics.append(payload)
        total_decisions += metrics.window_decisions
        ai_heavy_decisions += metrics.ai_heavy_decisions
        ai_heavy_blocks += metrics.ai_heavy_blocks
        ai_heavy_overrides += metrics.ai_heavy_overrides
        ai_heavy_with_signal_fields += metrics.ai_heavy_with_signal_fields
        ai_heavy_low_signal += metrics.ai_heavy_low_signal

    ai_heavy_rate = (ai_heavy_decisions / total_decisions) if total_decisions else 0.0
    ai_heavy_block_rate = (
        ai_heavy_blocks / ai_heavy_decisions if ai_heavy_decisions else 0.0
    )
    ai_heavy_override_rate = (
        ai_heavy_overrides / ai_heavy_blocks if ai_heavy_blocks else 0.0
    )
    ai_heavy_low_signal_rate = (
        ai_heavy_low_signal / ai_heavy_with_signal_fields
        if ai_heavy_with_signal_fields
        else 0.0
    )

    recommendation = derive_recommendation(
        total_decisions=total_decisions,
        ai_heavy_rate=ai_heavy_rate,
        low_signal_rate=ai_heavy_low_signal_rate,
        target_min=target_min,
        target_max=target_max,
    )

    payload = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "manifest_path": str(manifest_path),
        "window_days": int(args.window_days),
        "summary": {
            "total_repos": len(repo_metrics),
            "total_decisions": total_decisions,
            "ai_heavy_decisions": ai_heavy_decisions,
            "ai_heavy_rate": round(ai_heavy_rate, 4),
            "ai_heavy_block_rate": round(ai_heavy_block_rate, 4),
            "ai_heavy_override_rate": round(ai_heavy_override_rate, 4),
            "ai_heavy_low_signal_rate": round(ai_heavy_low_signal_rate, 4),
            "ai_heavy_with_signal_fields": ai_heavy_with_signal_fields,
        },
        "recommendation": recommendation,
        "repos": repo_metrics,
    }

    out_dir = Path(args.output_dir).expanduser().resolve() / utc_date()
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "ai_heavy_calibration.json"
    md_path = out_dir / "ai_heavy_calibration.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(payload) + "\n", encoding="utf-8")

    print(f"AI-heavy calibration JSON: {json_path}")
    print(f"AI-heavy calibration MD:   {md_path}")
    print(
        "Recommendation: action={action} confidence={confidence} ai_heavy_rate={rate}".format(
            action=recommendation.get("action", "keep"),
            confidence=recommendation.get("confidence", "low"),
            rate=round(ai_heavy_rate, 4),
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
