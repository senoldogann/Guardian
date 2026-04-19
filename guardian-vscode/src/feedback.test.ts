import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCritiquesNotification,
  buildScanNotification,
  describeClientError,
} from "./feedback";
import { GuardianParseError, GuardianTransportError } from "./resultParsers";

test("buildScanNotification reports empty successful scan separately", () => {
  const plan = buildScanNotification("src/main.ts", {
    status: "ok",
    kind: "scan_result",
    message: "No active critiques found.",
    critiqueCount: 0,
    critiques: [],
  });

  assert.equal(plan.level, "info");
  assert.match(plan.message, /no active critiques/i);
});

test("buildCritiquesNotification surfaces warning payloads", () => {
  const plan = buildCritiquesNotification({
    status: "warning",
    kind: "snapshot_missing",
    message: "Snapshot is missing.",
    critiqueCount: 0,
    critiques: [],
  });

  assert.equal(plan.level, "warning");
  assert.match(plan.message, /snapshot is missing/i);
});

test("describeClientError distinguishes transport and parse failures", () => {
  const transportPlan = describeClientError(
    new GuardianTransportError("request timed out")
  );
  const parsePlan = describeClientError(
    new GuardianParseError("invalid JSON payload")
  );

  assert.equal(transportPlan.level, "error");
  assert.match(transportPlan.message, /could not communicate/i);
  assert.equal(parsePlan.level, "error");
  assert.match(parsePlan.message, /invalid response/i);
});