#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ALLOWED_SEVERITIES = {"critical", "warning", "info", "none"}
BLOCK_DECISIONS = {"BLOCK_UNTIL_APPROVED"}


@dataclass
class CaseRecord:
    case_id: str
    expected_severity: str
    predicted_severity: str
    expected_block: bool | None
    predicted_decision: str | None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_cases(path: Path) -> list[CaseRecord]:
    cases: list[CaseRecord] = []
    for line_no, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON at line {line_no}: {exc}") from exc

        case_id = str(payload.get("case_id", "")).strip()
        expected = str(payload.get("expected_severity", "")).strip().lower()
        predicted = str(payload.get("predicted_severity", "")).strip().lower()
        expected_block = payload.get("expected_block")
        predicted_decision = payload.get("predicted_decision")

        if not case_id:
            raise ValueError(f"Missing case_id at line {line_no}")
        if expected not in ALLOWED_SEVERITIES:
            raise ValueError(f"Invalid expected_severity at line {line_no}: {expected}")
        if predicted not in ALLOWED_SEVERITIES:
            raise ValueError(f"Invalid predicted_severity at line {line_no}: {predicted}")
        if expected_block is not None and not isinstance(expected_block, bool):
            raise ValueError(f"expected_block must be bool at line {line_no}")
        if predicted_decision is not None and not isinstance(predicted_decision, str):
            raise ValueError(f"predicted_decision must be string at line {line_no}")

        cases.append(
            CaseRecord(
                case_id=case_id,
                expected_severity=expected,
                predicted_severity=predicted,
                expected_block=expected_block,
                predicted_decision=predicted_decision,
            )
        )
    return cases


def precision(cases: list[CaseRecord], label: str) -> float | None:
    predicted = [c for c in cases if c.predicted_severity == label]
    if not predicted:
        return None
    true_positive = [c for c in predicted if c.expected_severity == label]
    return len(true_positive) / len(predicted)


def recall(cases: list[CaseRecord], label: str) -> float | None:
    expected = [c for c in cases if c.expected_severity == label]
    if not expected:
        return None
    true_positive = [c for c in expected if c.predicted_severity == label]
    return len(true_positive) / len(expected)


def false_positive_rate(cases: list[CaseRecord]) -> float:
    false_positives = [c for c in cases if c.expected_severity == "none" and c.predicted_severity != "none"]
    if not cases:
        return 0.0
    return len(false_positives) / len(cases)


def block_metrics(cases: list[CaseRecord]) -> tuple[float | None, float | None]:
    block_labeled = [c for c in cases if c.expected_block is not None]
    if not block_labeled:
        return None, None

    predicted_block = [c for c in block_labeled if (c.predicted_decision or "") in BLOCK_DECISIONS]
    expected_block = [c for c in block_labeled if c.expected_block]
    true_positive = [
        c
        for c in block_labeled
        if c.expected_block and (c.predicted_decision or "") in BLOCK_DECISIONS
    ]

    precision_value = None if not predicted_block else len(true_positive) / len(predicted_block)
    recall_value = None if not expected_block else len(true_positive) / len(expected_block)
    return precision_value, recall_value


def fmt_ratio(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.3f}"


def build_markdown(report: dict[str, Any]) -> str:
    metrics = report["metrics"]
    lines = [
        "# Review Precision Benchmark",
        "",
        f"- Generated At: {report['generated_at']}",
        f"- Input: {report['input']}",
        f"- Cases: {report['totals']['cases']}",
        "",
        "## Core Metrics",
        "",
        f"- Overall accuracy: {fmt_ratio(metrics['overall_accuracy'])}",
        f"- Critical precision: {fmt_ratio(metrics['critical_precision'])}",
        f"- Critical recall: {fmt_ratio(metrics['critical_recall'])}",
        f"- Warning precision: {fmt_ratio(metrics['warning_precision'])}",
        f"- Warning recall: {fmt_ratio(metrics['warning_recall'])}",
        f"- False positive rate: {fmt_ratio(metrics['false_positive_rate'])}",
        f"- Block precision: {fmt_ratio(metrics['block_precision'])}",
        f"- Block recall: {fmt_ratio(metrics['block_recall'])}",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Compute Guardian review precision metrics.")
    parser.add_argument("--input", required=True, help="JSONL benchmark input file.")
    parser.add_argument(
        "--output-dir",
        default=".guardian/benchmarks/review-precision",
        help="Directory where benchmark reports are written.",
    )
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    cases = load_cases(input_path)
    if not cases:
        raise SystemExit("No benchmark cases found.")

    correct = [c for c in cases if c.expected_severity == c.predicted_severity]
    overall_accuracy = len(correct) / len(cases)
    critical_precision = precision(cases, "critical")
    critical_recall = recall(cases, "critical")
    warning_precision = precision(cases, "warning")
    warning_recall = recall(cases, "warning")
    fp_rate = false_positive_rate(cases)
    block_precision, block_recall = block_metrics(cases)

    report = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "input": str(input_path),
        "totals": {"cases": len(cases)},
        "metrics": {
            "overall_accuracy": overall_accuracy,
            "critical_precision": critical_precision,
            "critical_recall": critical_recall,
            "warning_precision": warning_precision,
            "warning_recall": warning_recall,
            "false_positive_rate": fp_rate,
            "block_precision": block_precision,
            "block_recall": block_recall,
        },
    }

    output_base = Path(args.output_dir).expanduser().resolve()
    out_dir = output_base / utc_date()
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "report.json"
    md_path = out_dir / "report.md"
    json_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(build_markdown(report) + "\n", encoding="utf-8")

    print(f"Benchmark report written: {json_path}")
    print(f"Benchmark markdown written: {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
