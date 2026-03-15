#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


@dataclass
class GatePolicy:
    pass_max_warnings: int = 5
    block_on_critical: bool = True
    require_human_approval_on_ai_heavy: bool = True
    require_override_reason: bool = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay historical release decisions with current policy.")
    parser.add_argument(
        "--reports-root",
        default=".guardian/pilot-dryrun-real",
        help="Directory containing historical *-release-gate-report.json files.",
    )
    parser.add_argument(
        "--policy",
        default="guardian.policy.yaml",
        help="Policy file to replay against.",
    )
    parser.add_argument(
        "--output-dir",
        default=".guardian/governance-replay",
        help="Directory where replay summary artifacts are written.",
    )
    parser.add_argument(
        "--window-days",
        type=int,
        default=30,
        help="Only include reports newer than this window.",
    )
    return parser.parse_args()


def parse_bool(raw: str, default: bool) -> bool:
    value = raw.strip().lower()
    if value in {"true", "1", "yes", "on"}:
        return True
    if value in {"false", "0", "no", "off"}:
        return False
    return default


def load_policy(path: Path) -> GatePolicy:
    if not path.exists():
        return GatePolicy()

    gate: dict[str, str] = {}
    in_gate = False
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if line.strip() == "gate:":
            in_gate = True
            continue
        if in_gate:
            if not line.startswith("  "):
                in_gate = False
                continue
            if ":" not in line:
                continue
            key, value = line.strip().split(":", 1)
            gate[key.strip()] = value.strip()

    return GatePolicy(
        pass_max_warnings=int(gate.get("pass_max_warnings", 5)),
        block_on_critical=parse_bool(gate.get("block_on_critical", "true"), True),
        require_human_approval_on_ai_heavy=parse_bool(
            gate.get("require_human_approval_on_ai_heavy", "true"), True
        ),
        require_override_reason=parse_bool(gate.get("require_override_reason", "true"), True),
    )


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iter_report_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    files = sorted(root.rglob("*-release-gate-report.json"))
    latest = root.parent / "release_gate_report.json"
    if latest.exists():
        files.append(latest)
    return files


def count_findings(report: dict[str, Any]) -> tuple[int, int]:
    findings = report.get("findings", [])
    critical = 0
    warning = 0
    if isinstance(findings, list):
        for item in findings:
            if not isinstance(item, dict):
                continue
            severity = str(item.get("severity", "")).lower()
            if severity == "critical":
                critical += 1
            elif severity == "warning":
                warning += 1
    return critical, warning


def replay_decision(report: dict[str, Any], policy: GatePolicy) -> str:
    critical, warning = count_findings(report)
    ai_heavy = bool(report.get("ai_heavy_change", False))
    override = report.get("override", {})
    override_applied = isinstance(override, dict) and bool(override.get("applied", False))
    override_reason = (
        str(override.get("reason", "")).strip() if isinstance(override, dict) else ""
    )
    approver = str(override.get("approver", "")).strip() if isinstance(override, dict) else ""

    if override_applied:
        if policy.require_override_reason and not override_reason:
            return "BLOCK_UNTIL_APPROVED"
        return "OVERRIDDEN"

    if policy.block_on_critical and critical > 0:
        return "BLOCK_UNTIL_APPROVED"

    if policy.require_human_approval_on_ai_heavy and ai_heavy and not approver:
        return "BLOCK_UNTIL_APPROVED"

    if warning > policy.pass_max_warnings:
        return "PASS_WITH_WARNING"

    if warning > 0 or ai_heavy:
        return "PASS_WITH_WARNING"

    return "PASS"


def write_outputs(
    output_dir: Path,
    policy: GatePolicy,
    rows: list[dict[str, Any]],
    generated_at: datetime,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    date_dir = output_dir / generated_at.strftime("%Y-%m-%d")
    date_dir.mkdir(parents=True, exist_ok=True)

    drift_count = sum(1 for row in rows if row["original_decision"] != row["replayed_decision"])
    payload = {
        "schema_version": 1,
        "generated_at": generated_at.isoformat(),
        "policy": {
            "pass_max_warnings": policy.pass_max_warnings,
            "block_on_critical": policy.block_on_critical,
            "require_human_approval_on_ai_heavy": policy.require_human_approval_on_ai_heavy,
            "require_override_reason": policy.require_override_reason,
        },
        "summary": {
            "reports_analyzed": len(rows),
            "drift_count": drift_count,
            "drift_rate": round((drift_count / len(rows)), 4) if rows else 0.0,
        },
        "rows": rows,
    }
    (date_dir / "replay_summary.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = [
        "# Governance Replay Summary",
        f"Generated: {generated_at.isoformat()}",
        "",
        "## Policy",
        f"- pass_max_warnings: {policy.pass_max_warnings}",
        f"- block_on_critical: {policy.block_on_critical}",
        f"- require_human_approval_on_ai_heavy: {policy.require_human_approval_on_ai_heavy}",
        f"- require_override_reason: {policy.require_override_reason}",
        "",
        "## Summary",
        f"- reports_analyzed: {len(rows)}",
        f"- drift_count: {drift_count}",
        f"- drift_rate: {round((drift_count / len(rows)), 4) if rows else 0.0}",
        "",
        "## Drift Rows",
    ]
    drifts = [row for row in rows if row["original_decision"] != row["replayed_decision"]]
    if not drifts:
        lines.append("- No decision drift detected.")
    else:
        for row in drifts:
            lines.append(
                "- {name}: original={orig} replayed={new} critical={critical} warning={warning} ai_heavy={ai_heavy}".format(
                    name=row["name"],
                    orig=row["original_decision"],
                    new=row["replayed_decision"],
                    critical=row["critical_findings"],
                    warning=row["warning_findings"],
                    ai_heavy=row["ai_heavy_change"],
                )
            )
    lines.extend(
        [
            "",
            "## Action",
            "- Investigate drift rows and update policy thresholds or rule mappings before pilot rollout.",
        ]
    )
    (date_dir / "replay_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=max(args.window_days, 1))

    policy = load_policy(Path(args.policy))
    rows: list[dict[str, Any]] = []
    for report_path in iter_report_files(Path(args.reports_root)):
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except Exception:
            continue

        scanned_at = parse_timestamp(report.get("scanned_at")) or parse_timestamp(
            report.get("generated_at")
        )
        if scanned_at and scanned_at < window_start:
            continue

        critical, warning = count_findings(report)
        original = str(report.get("release_decision", "UNKNOWN"))
        replayed = replay_decision(report, policy)
        rows.append(
            {
                "name": report_path.stem,
                "path": str(report_path),
                "scanned_at": scanned_at.isoformat() if scanned_at else None,
                "original_decision": original,
                "replayed_decision": replayed,
                "critical_findings": critical,
                "warning_findings": warning,
                "ai_heavy_change": bool(report.get("ai_heavy_change", False)),
            }
        )

    rows.sort(key=lambda item: item.get("scanned_at") or "")
    write_outputs(Path(args.output_dir), policy, rows, now)
    print(
        f"Governance replay completed: reports={len(rows)} output={Path(args.output_dir) / now.strftime('%Y-%m-%d')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
