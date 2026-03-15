#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build override debt ledger from .guardian/release_decisions.jsonl"
    )
    parser.add_argument(
        "--audit-path",
        default=".guardian/release_decisions.jsonl",
        help="Path to release_decisions.jsonl",
    )
    parser.add_argument(
        "--output-dir",
        default=".guardian",
        help="Directory to write override debt ledger artifacts",
    )
    parser.add_argument(
        "--sla-days",
        type=int,
        default=7,
        help="SLA days for follow-up closure on overrides",
    )
    return parser.parse_args()


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


def classify_reason_quality(reason: str) -> str:
    text = reason.strip().lower()
    if not text:
        return "missing"
    strong_keywords = [
        "incident",
        "rollback",
        "mitigation",
        "validated",
        "approved",
        "hotfix",
        "root cause",
        "outage",
        "olay",
        "geri alma",
        "azaltım",
        "onay",
        "kök neden",
    ]
    has_keywords = any(keyword in text for keyword in strong_keywords)
    if len(text) >= 40 and has_keywords:
        return "strong"
    return "weak"


def row_id(entry: dict[str, Any]) -> str:
    key = "|".join(
        [
            str(entry.get("decided_at") or entry.get("timestamp") or ""),
            str(entry.get("approver") or ""),
            str(entry.get("override_reason") or ""),
            str(entry.get("root") or ""),
        ]
    )
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def collect_rows(path: Path, sla_days: int) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue

        is_override = str(entry.get("action", "")).strip() == "override_release_block"
        has_override_reason = bool(str(entry.get("override_reason", "")).strip())
        if not is_override and not has_override_reason:
            continue

        created_at = parse_timestamp(entry.get("decided_at")) or parse_timestamp(
            entry.get("timestamp")
        ) or datetime.now(timezone.utc)
        due_at = created_at + timedelta(days=max(sla_days, 1))
        reason = str(entry.get("override_reason", "")).strip()
        quality = classify_reason_quality(reason)

        rows.append(
            {
                "id": row_id(entry),
                "created_at": created_at.isoformat(),
                "due_at": due_at.isoformat(),
                "status": "OPEN",
                "root": entry.get("root"),
                "decision": entry.get("decision"),
                "approver": entry.get("approver"),
                "reason": reason,
                "reason_quality": quality,
                "action": entry.get("action"),
                "policy_path": entry.get("policy_path"),
            }
        )
    rows.sort(key=lambda row: row["created_at"])
    return rows


def write_outputs(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    quality_counts = {"strong": 0, "weak": 0, "missing": 0}
    for row in rows:
        quality_counts[row["reason_quality"]] = quality_counts.get(row["reason_quality"], 0) + 1

    payload = {
        "schema_version": 1,
        "generated_at": now.isoformat(),
        "summary": {
            "total_overrides": len(rows),
            "open_items": len(rows),
            "reason_quality": quality_counts,
        },
        "rows": rows,
    }
    (output_dir / "override_debt_ledger.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = [
        "# Override Debt Ledger",
        f"Generated: {now.isoformat()}",
        "",
        "## Summary",
        f"- total_overrides: {len(rows)}",
        f"- open_items: {len(rows)}",
        f"- reason_quality.strong: {quality_counts.get('strong', 0)}",
        f"- reason_quality.weak: {quality_counts.get('weak', 0)}",
        f"- reason_quality.missing: {quality_counts.get('missing', 0)}",
        "",
        "## Open Items",
    ]
    if not rows:
        lines.append("- No overrides found.")
    else:
        for row in rows:
            lines.append(
                "- {id} | due={due} | approver={approver} | quality={quality} | decision={decision}".format(
                    id=row["id"],
                    due=row["due_at"],
                    approver=row.get("approver") or "unknown",
                    quality=row["reason_quality"],
                    decision=row.get("decision") or "unknown",
                )
            )
            if row.get("reason"):
                lines.append(f"  reason: {row['reason']}")
    lines.extend(
        [
            "",
            "## Policy",
            "- Every override must have a follow-up item before due date.",
            "- Missing/weak reasons should be escalated in weekly governance review.",
        ]
    )
    (output_dir / "override_debt_ledger.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    rows = collect_rows(Path(args.audit_path), args.sla_days)
    write_outputs(Path(args.output_dir), rows)
    print(
        f"Override debt ledger generated: total_overrides={len(rows)} output_dir={Path(args.output_dir)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
