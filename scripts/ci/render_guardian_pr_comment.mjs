#!/usr/bin/env node
import fs from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/ci/render_guardian_pr_comment.mjs <report.json>");
  process.exit(2);
}

const raw = fs.readFileSync(inputPath, "utf8");
const report = JSON.parse(raw);

const summary = report?.summary ?? {};
const scanProfile = report?.scan_profile ?? "source";
const rulesHash = report?.rules_hash ?? "";
const manifestHash = report?.manifest_hash ?? "";

const findings = Array.isArray(report?.findings) ? report.findings : [];
const newFindings = findings.filter((f) => f?.is_new);

const short = (value, n = 12) => {
  if (!value || typeof value !== "string") return "n/a";
  return value.length > n ? value.slice(0, n) : value;
};

let md = "";
md += "## Guardian Scan\n\n";
md += `- Profile: \`${scanProfile}\`\n`;
md += `- Rules hash: \`${short(rulesHash)}\`\n`;
if (manifestHash) md += `- Manifest hash: \`${short(manifestHash)}\`\n`;
md += "\n";

md += "### Summary\n\n";
md += "| Metric | Count |\n";
md += "|---|---:|\n";
md += `| Files scanned | ${summary?.files_scanned ?? 0} |\n`;
md += `| Findings | ${summary?.findings ?? findings.length} |\n`;
md += `| New findings | ${summary?.new_findings ?? newFindings.length} |\n`;
md += `| New critical | ${summary?.new_critical ?? 0} |\n`;
md += "\n";

if (newFindings.length === 0) {
  md += "_No new findings._\n";
  process.stdout.write(md);
  process.exit(0);
}

md += "### New Findings (Top 10)\n\n";
for (const f of newFindings.slice(0, 10)) {
  const sev = f?.severity ?? "Info";
  const path = f?.file_path ?? "unknown";
  const msg = (f?.message ?? "").toString().replace(/\s+/g, " ").trim();
  md += `- **${sev}** \`${path}\`: ${msg}\n`;
}

if (newFindings.length > 10) {
  md += `\n_+${newFindings.length - 10} more new findings._\n`;
}

process.stdout.write(md);
