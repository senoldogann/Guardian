#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass
class Check:
    name: str
    passed: bool
    detail: str


def has_job(content: str, job_name: str) -> bool:
    return re.search(rf"(?m)^\s*{re.escape(job_name)}:\s*$", content) is not None


def markdown_report(payload: dict) -> str:
    lines = [
        "# CI Gate Flow Validation",
        "",
        f"- Generated At: {payload.get('generated_at', '')}",
        f"- Status: {payload.get('status', '')}",
        f"- Checks: {payload.get('totals', {}).get('passed', 0)}/{payload.get('totals', {}).get('checks', 0)}",
        "",
        "## Checks",
        "",
    ]
    for check in payload.get("checks", []):
        icon = "PASS" if check.get("passed") else "FAIL"
        lines.append(f"- [{icon}] {check.get('name')}: {check.get('detail')}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate CI/release gate flow wiring.")
    parser.add_argument("--ci-workflow", required=True, help="Path to ci-cd workflow file.")
    parser.add_argument("--release-workflow", required=True, help="Path to release workflow file.")
    parser.add_argument(
        "--output-dir",
        default=".guardian/pilot-ci-gate-validation",
        help="Output directory for validation report.",
    )
    args = parser.parse_args()

    ci_path = Path(args.ci_workflow).expanduser().resolve()
    release_path = Path(args.release_workflow).expanduser().resolve()
    output_base = Path(args.output_dir).expanduser().resolve()

    ci = ci_path.read_text(encoding="utf-8")
    release = release_path.read_text(encoding="utf-8")

    checks = [
        Check(
            name="ci_has_release_gate_ci_smoke_job",
            passed=has_job(ci, "release-gate-ci-smoke"),
            detail="ci-cd workflow should define release-gate-ci-smoke job.",
        ),
        Check(
            name="ci_runs_release_gate_smoke_script",
            passed="scripts/ci/release_gate_ci_smoke.sh" in ci,
            detail="ci-cd workflow should run release_gate_ci_smoke.sh.",
        ),
        Check(
            name="release_has_release_gate_job",
            passed=has_job(release, "release-gate"),
            detail="release workflow should define release-gate job.",
        ),
        Check(
            name="release_gate_is_strict",
            passed="--release-gate strict" in release,
            detail="release-gate scan command should run with strict mode.",
        ),
        Check(
            name="release_gate_can_block_pipeline",
            passed=(
                "Stop release when gate blocks" in release
                and re.search(r"(?m)^\s*exit 1\s*$", release) is not None
            ),
            detail="release workflow should stop when gate exits non-zero.",
        ),
        Check(
            name="build_windows_needs_release_gate",
            passed=(
                has_job(release, "build-windows")
                and (
                    "needs: release-gate" in release
                    or "needs: [release-gate" in release
                    or "needs:\n      - release-gate" in release
                    or "needs:\n        - release-gate" in release
                )
            ),
            detail="build-windows job should depend on release-gate.",
        ),
        Check(
            name="publish_distribution_needs_gate_and_build",
            passed=(
                "publish-distribution:" in release
                and (
                    "needs: [release-gate, build-windows]" in release
                    or "needs: [build-windows, release-gate]" in release
                )
            ),
            detail="publish-distribution should require release-gate and build-windows.",
        ),
    ]

    passed = sum(1 for check in checks if check.passed)
    payload = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "status": "READY" if passed == len(checks) else "BLOCKED",
        "totals": {
            "checks": len(checks),
            "passed": passed,
            "failed": len(checks) - passed,
        },
        "checks": [asdict(check) for check in checks],
    }

    out_dir = output_base / utc_date()
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "ci_gate_validation.json"
    md_path = out_dir / "ci_gate_validation.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(payload) + "\n", encoding="utf-8")

    print(f"CI gate validation report written: {json_path}")
    print(f"CI gate validation markdown written: {md_path}")
    return 0 if payload["status"] == "READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
