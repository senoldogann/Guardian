import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GuardianParseError,
  parseCritiquesToolResult,
  parseScanToolResult,
} from "./resultParsers";

const wrapPayload = (payload: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(payload) }],
});

test("parseScanToolResult maps real critique payload to extension model", () => {
  const result = parseScanToolResult(
    wrapPayload({
      status: "ok",
      kind: "scan_result",
      message: "Loaded 1 active critique.",
      critique_count: 1,
      critiques: [
        {
          finding_id: "finding-1",
          file_path: "/tmp/src/main.ts",
          severity: "Warning",
          message: "Avoid unsafe pattern",
          line_start: 4,
          line_end: 6,
          suggestion: "Refactor the branch",
          category: "Security",
        },
      ],
      file: {
        path: "/tmp/src/main.ts",
        relative_path: "src/main.ts",
        is_candidate: true,
      },
    })
  );

  assert.equal(result.status, "ok");
  assert.equal(result.critiqueCount, 1);
  assert.equal(result.critiques[0].id, "finding-1");
  assert.equal(result.critiques[0].severity, "medium");
  assert.equal(result.critiques[0].line, 4);
  assert.equal(result.file?.relativePath, "src/main.ts");
});

test("parseCritiquesToolResult preserves successful empty state", () => {
  const result = parseCritiquesToolResult(
    wrapPayload({
      status: "ok",
      kind: "critiques_result",
      message: "No critiques matched the current filter.",
      critique_count: 0,
      severity_filter: "high",
      critiques: [],
    })
  );

  assert.equal(result.status, "ok");
  assert.equal(result.critiqueCount, 0);
  assert.equal(result.severityFilter, "high");
  assert.deepEqual(result.critiques, []);
});

test("parseCritiquesToolResult throws GuardianParseError for invalid JSON content", () => {
  assert.throws(
    () =>
      parseCritiquesToolResult({
        content: [{ type: "text", text: "not-json" }],
      }),
    GuardianParseError
  );
});