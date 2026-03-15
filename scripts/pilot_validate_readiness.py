#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
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
        raise ValueError(f"Invalid JSON object: {path}")
    return data


def approver_index(roster: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for row in roster.get("approvers", []):
        if isinstance(row, dict):
            key = str(row.get("id", "")).strip()
            if key:
                index[key] = row
    return index


def teams_allow(approver_row: dict[str, Any], team: str) -> bool:
    teams = approver_row.get("teams", [])
    if not isinstance(teams, list):
        return False
    normalized = {str(item).strip() for item in teams}
    return "*" in normalized or team in normalized


def markdown_report(payload: dict[str, Any]) -> str:
    lines: list[str] = [
        "# Pilot Readiness Validation",
        "",
        f"- Generated At: {payload.get('generated_at', '')}",
        f"- Status: {payload.get('status', '')}",
        f"- Manifest: {payload.get('manifest_path', '')}",
        f"- Roster: {payload.get('approver_roster_path', '')}",
        "",
        "## Totals",
        "",
    ]
    totals = payload.get("totals", {})
    lines.append(f"- repos: {totals.get('repos', 0)}")
    lines.append(f"- blockers: {totals.get('blockers', 0)}")
    lines.append(f"- warnings: {totals.get('warnings', 0)}")
    lines.append("")
    lines.append("## Repo Checks")
    lines.append("")
    for repo in payload.get("repos", []):
        lines.append(
            f"- {repo.get('name', '')} ({repo.get('team', '')}) -> {repo.get('path', '')}"
        )
        issues = repo.get("issues", [])
        if not issues:
            lines.append("  - ok")
            continue
        for issue in issues:
            lines.append(f"  - {issue}")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate real pilot readiness.")
    parser.add_argument("--manifest", required=True, help="Pilot manifest path.")
    parser.add_argument("--approver-roster", required=True, help="Approver roster path.")
    parser.add_argument(
        "--output-dir",
        default=".guardian/pilot-real-readiness",
        help="Output directory for readiness report.",
    )
    args = parser.parse_args()

    manifest_path = Path(args.manifest).expanduser().resolve()
    roster_path = Path(args.approver_roster).expanduser().resolve()
    output_base = Path(args.output_dir).expanduser().resolve()

    manifest = load_json(manifest_path)
    roster = load_json(roster_path)

    if manifest.get("schema_version") != 1:
        raise SystemExit("manifest schema_version must be 1")
    if roster.get("schema_version") != 1:
        raise SystemExit("approver roster schema_version must be 1")

    approvers = approver_index(roster)
    blockers: list[str] = []
    warnings: list[str] = []
    repos_out: list[dict[str, Any]] = []

    for repo in manifest.get("repos", []):
        if not isinstance(repo, dict):
            continue
        name = str(repo.get("name", "unknown"))
        team = str(repo.get("team", "unknown"))
        path = Path(str(repo.get("path", "")).strip()).expanduser()
        approver = str(repo.get("approver", "")).strip()
        issues: list[str] = []

        if not path:
            issues.append("missing repo.path")
            blockers.append(f"{name}: missing repo.path")
        elif not path.exists():
            issues.append(f"path not found: {path}")
            blockers.append(f"{name}: path not found")

        policy_path = path / "guardian.policy.yaml" if path else None
        if policy_path is None or not policy_path.exists():
            issues.append("guardian.policy.yaml missing")
            blockers.append(f"{name}: guardian.policy.yaml missing")

        if not approver:
            issues.append("approver is empty")
            blockers.append(f"{name}: approver missing")
        elif approver not in approvers:
            issues.append(f"approver '{approver}' not in roster")
            blockers.append(f"{name}: approver not in roster")
        else:
            row = approvers[approver]
            if not teams_allow(row, team):
                issues.append(f"approver '{approver}' not allowed for team '{team}'")
                blockers.append(f"{name}: approver-team mismatch")
            if repo.get("override_reason") and not bool(row.get("can_override", False)):
                issues.append(f"approver '{approver}' cannot override")
                blockers.append(f"{name}: approver cannot override")

        if path.exists() and (path / ".guardian").exists() is False:
            warnings.append(f"{name}: .guardian directory missing (will be created on first run)")
            issues.append(".guardian directory missing (non-blocking)")

        repos_out.append(
            {
                "name": name,
                "team": team,
                "path": str(path),
                "approver": approver,
                "issues": issues,
            }
        )

    status = "READY" if not blockers else "BLOCKED"
    date_key = utc_date()
    out_dir = output_base / date_key
    out_dir.mkdir(parents=True, exist_ok=True)

    payload = {
        "schema_version": 1,
        "generated_at": now_iso(),
        "status": status,
        "manifest_path": str(manifest_path),
        "approver_roster_path": str(roster_path),
        "totals": {
            "repos": len(repos_out),
            "blockers": len(blockers),
            "warnings": len(warnings),
        },
        "blockers": blockers,
        "warnings": warnings,
        "repos": repos_out,
    }

    json_path = out_dir / "readiness.json"
    md_path = out_dir / "readiness.md"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(markdown_report(payload) + "\n", encoding="utf-8")

    print(f"Readiness report written: {json_path}")
    print(f"Readiness markdown written: {md_path}")
    return 0 if status == "READY" else 1


if __name__ == "__main__":
    raise SystemExit(main())
