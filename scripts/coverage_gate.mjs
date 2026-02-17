#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const coverageSummaryPath = path.join(rootDir, "coverage", "coverage-summary.json");
const baselinePath = path.join(rootDir, "coverage", "baseline.json");

const thresholds = {
  lines: 35,
  functions: 35,
  branches: 25,
  statements: 35,
};

if (!fs.existsSync(coverageSummaryPath)) {
  console.error(`[coverage-gate] Missing coverage summary: ${coverageSummaryPath}`);
  console.error("[coverage-gate] Run `npm run test:coverage` first.");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));
const total = summary?.total;
if (!total) {
  console.error("[coverage-gate] Invalid coverage summary format.");
  process.exit(1);
}

const current = {
  lines: Number(total.lines?.pct ?? 0),
  functions: Number(total.functions?.pct ?? 0),
  branches: Number(total.branches?.pct ?? 0),
  statements: Number(total.statements?.pct ?? 0),
};

const failures = [];
for (const metric of Object.keys(thresholds)) {
  const expected = thresholds[metric];
  const actual = current[metric];
  if (actual < expected) {
    failures.push(`${metric}: ${actual.toFixed(2)}% < ${expected}%`);
  }
}

if (fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  for (const metric of Object.keys(current)) {
    const baselineValue = Number(baseline?.[metric]);
    if (Number.isFinite(baselineValue) && current[metric] + 0.001 < baselineValue) {
      failures.push(
        `${metric}: ${current[metric].toFixed(2)}% < baseline ${baselineValue.toFixed(2)}%`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("[coverage-gate] Coverage gate failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[coverage-gate] OK", current);
