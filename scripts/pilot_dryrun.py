#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_date() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("Manifest must be a JSON object.")
    if data.get("schema_version") != 1:
        raise ValueError("Manifest schema_version must be 1.")
    repos = data.get("repos")
    if not isinstance(repos, list):
        raise ValueError("Manifest must include repos[].")
    return data


def resolve_repo_path(raw_path: str, manifest_path: Path, repo_base_dir: Path | None) -> Path:
    candidate = Path(raw_path).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    if repo_base_dir is not None:
        return (repo_base_dir / candidate).resolve()
    return (manifest_path.parent / candidate).resolve()


def map_status(decision: str) -> str:
    if decision in ("PASS", "PASS_WITH_WARNING"):
        return "ALLOWED"
    if decision == "BLOCK_UNTIL_APPROVED":
        return "BLOCKED"
    if decision == "OVERRIDDEN":
        return "OVERRIDDEN"
    return "UNKNOWN"


def next_action_for(decision: str) -> str:
    if decision in ("PASS", "PASS_WITH_WARNING"):
        return "Track warning root causes and add policy/rule backlog item."
    if decision == "BLOCK_UNTIL_APPROVED":
        return "Collect approver + reason, then rerun with approval/override inputs."
    if decision == "OVERRIDDEN":
        return "Review override justification quality and create follow-up action item."
    return "Inspect CLI stderr and report payload."


def append_repo_audit(repo_path: Path, report: dict[str, Any], approver: str, override_reason: str) -> None:
    guardian_dir = repo_path / ".guardian"
    guardian_dir.mkdir(parents=True, exist_ok=True)
    audit_path = guardian_dir / "release_decisions.jsonl"
    findings = report.get("findings", [])
    critical = 0
    warning = 0
    if isinstance(findings, list):
        for finding in findings:
            if not isinstance(finding, dict):
                continue
            sev = str(finding.get("severity", "")).lower()
            if sev == "critical":
                critical += 1
            if sev == "warning":
                warning += 1

    record = {
        "timestamp": now_iso(),
        "action": "pilot_dryrun",
        "decision": report.get("release_decision", "UNKNOWN"),
        "approver": approver,
        "reason": None,
        "override_reason": override_reason or None,
        "critical_findings": critical,
        "warning_findings": warning,
        "ai_heavy_change": bool(report.get("ai_heavy_change", False)),
        "policy_path": report.get("policy_path", ""),
    }
    with audit_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")


def run_for_repo(
    repo: dict[str, Any],
    manifest_path: Path,
    cli_bin: Path,
    report_path: Path,
    repo_base_dir: Path | None,
) -> dict[str, Any]:
    name = str(repo.get("name", "unknown"))
    team = str(repo.get("team", "unknown"))
    raw_path = str(repo.get("path", "")).strip()
    approver = str(repo.get("approver", "")).strip()
    override_reason = str(repo.get("override_reason", "")).strip()

    if not raw_path:
        return {
            "name": name,
            "path": "",
            "team": team,
            "decision": "UNKNOWN",
            "status": "UNKNOWN",
            "exit_code": 2,
            "report_path": str(report_path),
            "approver_used": approver,
            "override_reason_used": bool(override_reason),
            "next_action": "Fix manifest path value.",
            "error": "Manifest repo.path is empty.",
        }

    repo_path = resolve_repo_path(raw_path, manifest_path, repo_base_dir)
    if not repo_path.exists():
        return {
            "name": name,
            "path": str(repo_path),
            "team": team,
            "decision": "UNKNOWN",
            "status": "UNKNOWN",
            "exit_code": 2,
            "report_path": str(report_path),
            "approver_used": approver,
            "override_reason_used": bool(override_reason),
            "next_action": "Fix repo path in manifest.",
            "error": f"Repo path not found: {repo_path}",
        }

    cmd = [
        str(cli_bin),
        "scan",
        "--root",
        str(repo_path),
        "--offline",
        "--no-baseline",
        "--format",
        "json",
        "--out",
        str(report_path),
        "--release-gate",
        "strict",
        "--pr-gate",
        "off",
    ]

    policy_path = repo_path / "guardian.policy.yaml"
    if policy_path.exists():
        cmd.extend(["--policy", str(policy_path)])

    if approver:
        cmd.extend(["--approver", approver])
    if override_reason:
        cmd.extend(["--override-reason", override_reason])

    completed = subprocess.run(cmd, capture_output=True, text=True)
    report: dict[str, Any] = {}
    if report_path.exists():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            report = {}

    decision = str(report.get("release_decision", "UNKNOWN"))
    status = map_status(decision)
    error = None
    if completed.returncode not in (0, 1):
        error = (completed.stderr or completed.stdout).strip() or "guardian-cli execution failed."

    if report:
        guardian_report = repo_path / ".guardian" / "release_gate_report.json"
        guardian_report.parent.mkdir(parents=True, exist_ok=True)
        guardian_report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        append_repo_audit(repo_path, report, approver=approver, override_reason=override_reason)

    return {
        "name": name,
        "path": str(repo_path),
        "team": team,
        "decision": decision,
        "status": status,
        "exit_code": completed.returncode,
        "report_path": str(report_path),
        "approver_used": approver,
        "override_reason_used": bool(override_reason),
        "next_action": next_action_for(decision),
        "error": error,
    }


def markdown_summary(summary: dict[str, Any]) -> str:
    totals = summary.get("totals", {})
    lines: list[str] = [
        "# Pilot Dry-Run Summary",
        "",
        f"- Generated At: {summary.get('generated_at', '')}",
        f"- Manifest: {summary.get('manifest_path', '')}",
        f"- Total Repos: {totals.get('repos', 0)}",
        f"- Allowed: {totals.get('allowed', 0)}",
        f"- Blocked: {totals.get('blocked', 0)}",
        f"- Overridden: {totals.get('overridden', 0)}",
        f"- Errors: {totals.get('errors', 0)}",
        "",
        "## Repo Results",
        "",
        "| Repo | Team | Decision | Status | Exit | Next Action |",
        "| --- | --- | --- | --- | ---: | --- |",
    ]
    for repo in summary.get("repos", []):
        lines.append(
            "| {name} | {team} | {decision} | {status} | {exit_code} | {next_action} |".format(
                name=repo.get("name", ""),
                team=repo.get("team", ""),
                decision=repo.get("decision", ""),
                status=repo.get("status", ""),
                exit_code=repo.get("exit_code", ""),
                next_action=repo.get("next_action", ""),
            )
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run strict release-gate dry-run over pilot repos.")
    parser.add_argument("--manifest", required=True, help="Pilot repo manifest path.")
    parser.add_argument(
        "--cli-bin",
        default="guardian-cli/target/release/guardian-cli",
        help="guardian-cli executable path.",
    )
    parser.add_argument(
        "--summary-dir",
        default=".guardian/pilot-dryrun",
        help="Output directory for summary artifacts.",
    )
    parser.add_argument(
        "--repo-base-dir",
        default="",
        help="Optional base directory used to resolve relative manifest repo paths.",
    )
    parser.add_argument(
        "--fail-on-block",
        action="store_true",
        help="Return exit code 1 when any repo is blocked.",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest).expanduser().resolve()
    cli_bin = Path(args.cli_bin).expanduser().resolve()
    summary_base = Path(args.summary_dir).expanduser().resolve()
    repo_base_dir = (
        Path(args.repo_base_dir).expanduser().resolve() if args.repo_base_dir else None
    )

    if not manifest_path.exists():
        raise SystemExit(f"Manifest not found: {manifest_path}")
    if not cli_bin.exists():
        raise SystemExit(f"guardian-cli binary not found: {cli_bin}")

    manifest = load_manifest(manifest_path)
    run_date = utc_date()
    summary_dir = summary_base / run_date
    summary_dir.mkdir(parents=True, exist_ok=True)

    repos_out: list[dict[str, Any]] = []
    for repo in manifest.get("repos", []):
        if not isinstance(repo, dict):
            continue
        name = str(repo.get("name", f"repo-{len(repos_out)+1}"))
        report_path = summary_dir / f"{name}-release-gate-report.json"
        repos_out.append(
            run_for_repo(
                repo=repo,
                manifest_path=manifest_path,
                cli_bin=cli_bin,
                report_path=report_path,
                repo_base_dir=repo_base_dir,
            )
        )

    status_counter: Counter[str] = Counter()
    error_count = 0
    for item in repos_out:
        status_counter[item.get("status", "UNKNOWN")] += 1
        if item.get("error"):
            error_count += 1

    summary = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "manifest_path": str(manifest_path),
        "repo_base_dir": str(repo_base_dir) if repo_base_dir else None,
        "totals": {
            "repos": len(repos_out),
            "allowed": status_counter.get("ALLOWED", 0),
            "blocked": status_counter.get("BLOCKED", 0),
            "overridden": status_counter.get("OVERRIDDEN", 0),
            "errors": error_count,
            "unknown": status_counter.get("UNKNOWN", 0),
        },
        "repos": repos_out,
    }

    summary_json = summary_dir / "summary.json"
    summary_md = summary_dir / "summary.md"
    summary_json.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    summary_md.write_text(markdown_summary(summary) + "\n", encoding="utf-8")

    print(f"Dry-run summary written: {summary_json}")
    print(f"Dry-run markdown written: {summary_md}")

    if error_count > 0:
        return 2
    if args.fail_on_block and status_counter.get("BLOCKED", 0) > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
