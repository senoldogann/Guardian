#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parent.parent
TELEMETRY_DIR = ROOT / ".maestro" / "telemetry"
EVENTS_PATH = TELEMETRY_DIR / "events.jsonl"
RUNS_PATH = TELEMETRY_DIR / "runs.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_dir() -> None:
    TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)


def _append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    _ensure_dir()
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def _update_runs(payload: dict[str, Any]) -> None:
    _ensure_dir()
    runs: list[dict[str, Any]] = []
    if RUNS_PATH.exists():
        try:
            runs = json.loads(RUNS_PATH.read_text(encoding="utf-8")).get("runs", [])
        except json.JSONDecodeError:
            runs = []
    runs.append(payload)
    RUNS_PATH.write_text(
        json.dumps({"runs": runs[-200:]}, indent=2) + "\n",
        encoding="utf-8",
    )


class ScriptTrace:
    def __init__(self, name: str, attributes: dict[str, Any] | None = None) -> None:
        self.name = name
        self.attributes = attributes or {}
        self.trace_id = uuid.uuid4().hex
        self.span_id = uuid.uuid4().hex[:16]
        self.started_at = _now_iso()

    def event(
        self,
        event_name: str,
        attributes: dict[str, Any] | None = None,
        *,
        status: str = "ok",
    ) -> None:
        _append_jsonl(
            EVENTS_PATH,
            {
                "timestamp": _now_iso(),
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "script": self.name,
                "event": event_name,
                "status": status,
                "attributes": attributes or {},
            },
        )

    def finalize(
        self,
        *,
        status: str,
        error: str | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        ended_at = _now_iso()
        payload = {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "script": self.name,
            "status": status,
            "started_at": self.started_at,
            "ended_at": ended_at,
            "attributes": {**self.attributes, **(attributes or {})},
        }
        if error:
            payload["error"] = error
        _append_jsonl(
            EVENTS_PATH,
            {
                "timestamp": ended_at,
                "trace_id": self.trace_id,
                "span_id": self.span_id,
                "script": self.name,
                "event": "script-end",
                "status": status,
                "attributes": payload,
            },
        )
        _update_runs(payload)


@contextmanager
def traced_script(
    name: str,
    attributes: dict[str, Any] | None = None,
) -> Iterator[ScriptTrace]:
    trace = ScriptTrace(name, attributes)
    trace.event("script-start", trace.attributes)
    try:
        yield trace
    except Exception as exc:
        trace.finalize(status="error", error=str(exc))
        raise
    else:
        trace.finalize(status="ok")

