#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from maestro_telemetry import traced_script

ROOT = Path(__file__).resolve().parent.parent
RADAR_DIR = ROOT / ".maestro" / "provider-radar"
WATCHLIST_PATH = RADAR_DIR / "watchlist.json"
STATE_PATH = RADAR_DIR / "state.json"
USER_AGENT = "Maestro-Provider-Radar/1.0 (+https://developers.openai.com/codex/config-basic)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Track drift in official provider documentation.")
    subparsers = parser.add_subparsers(dest="command", required=False)

    subparsers.add_parser("refresh", help="Fetch current snapshots for the official watchlist.")

    status_parser = subparsers.add_parser("status", help="Check cached radar freshness.")
    status_parser.add_argument("--max-age-days", type=int, default=45)

    live_parser = subparsers.add_parser("live-check", help="Fetch watchlist docs and compare against cached snapshots.")
    live_parser.add_argument("--max-age-days", type=int, default=45)

    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_watchlist() -> list[dict[str, Any]]:
    payload = load_json(WATCHLIST_PATH)
    docs: list[dict[str, Any]] = []
    for provider in payload.get("providers", []):
        for doc in provider.get("docs", []):
            entry = dict(doc)
            entry["provider"] = provider["id"]
            docs.append(entry)
    return docs


def fetch_doc(entry: dict[str, Any]) -> dict[str, Any]:
    parsed = urlparse(entry["url"])
    if not parsed.netloc.endswith(entry["official_domain"]):
        raise ValueError(
            f"URL {entry['url']} does not match official domain {entry['official_domain']}"
        )

    request = Request(entry["url"], headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        body = response.read()
        headers = response.info()
        return {
            "provider": entry["provider"],
            "name": entry["name"],
            "url": entry["url"],
            "official_domain": entry["official_domain"],
            "status_code": getattr(response, "status", 200),
            "final_url": response.geturl(),
            "etag": headers.get("ETag"),
            "last_modified": headers.get("Last-Modified"),
            "content_length": len(body),
            "content_sha256": hashlib.sha256(body).hexdigest(),
            "fetched_at": now_iso(),
        }


def write_state(entries: list[dict[str, Any]]) -> None:
    RADAR_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(
        json.dumps({"version": 1, "entries": entries}, indent=2) + "\n",
        encoding="utf-8",
    )


def load_state_entries() -> dict[str, dict[str, Any]]:
    if not STATE_PATH.exists():
        return {}
    payload = load_json(STATE_PATH)
    return {entry["url"]: entry for entry in payload.get("entries", [])}


def age_days(timestamp: str) -> float:
    fetched = datetime.fromisoformat(timestamp)
    return (datetime.now(timezone.utc) - fetched).total_seconds() / 86400


def refresh() -> int:
    watchlist = load_watchlist()
    fetched: list[dict[str, Any]] = []
    with traced_script("provider_doc_radar.refresh", {"doc_count": len(watchlist)}) as trace:
        for entry in watchlist:
            snapshot = fetch_doc(entry)
            fetched.append(snapshot)
        write_state(fetched)
        trace.event("watchlist-refreshed", {"fetched": len(fetched)})
    print(f"Provider radar refreshed for {len(fetched)} official docs.")
    return 0


def status(max_age_days: int) -> int:
    watchlist = load_watchlist()
    state = load_state_entries()
    stale: list[str] = []
    missing: list[str] = []

    for entry in watchlist:
        snapshot = state.get(entry["url"])
        if not snapshot:
            missing.append(entry["url"])
            continue
        doc_age = age_days(snapshot["fetched_at"])
        print(f"{entry['provider']}: {entry['name']} age={doc_age:.1f}d")
        if doc_age > max_age_days:
            stale.append(entry["url"])

    if missing:
        print("Missing cached radar entries:")
        for item in missing:
            print(f"- {item}")
    if stale:
        print("Stale cached radar entries:")
        for item in stale:
            print(f"- {item}")

    return 1 if missing or stale else 0


def live_check(max_age_days: int) -> int:
    watchlist = load_watchlist()
    state = load_state_entries()
    changed: list[str] = []
    missing: list[str] = []

    with traced_script("provider_doc_radar.live_check", {"doc_count": len(watchlist)}) as trace:
        for entry in watchlist:
            snapshot = state.get(entry["url"])
            if not snapshot:
                missing.append(entry["url"])
                continue
            current = fetch_doc(entry)
            current_age = age_days(snapshot["fetched_at"])
            changed_flag = current["content_sha256"] != snapshot["content_sha256"]
            if changed_flag:
                changed.append(entry["url"])
            print(
                f"{entry['provider']}: {entry['name']} "
                f"changed={'yes' if changed_flag else 'no'} "
                f"cached_age={current_age:.1f}d"
            )
        trace.event("live-check-complete", {"changed": len(changed), "missing": len(missing)})

    if missing:
        print("Missing cached radar entries:")
        for item in missing:
            print(f"- {item}")
    if changed:
        print("Official docs changed since the last refresh:")
        for item in changed:
            print(f"- {item}")

    if status(max_age_days) != 0:
        return 1
    return 1 if missing or changed else 0


def main() -> int:
    args = parse_args()
    command = args.command or "status"
    if command == "refresh":
        return refresh()
    if command == "live-check":
        return live_check(args.max_age_days)
    return status(args.max_age_days)


if __name__ == "__main__":
    raise SystemExit(main())

