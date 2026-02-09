use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Write};
use std::path::Path;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ReportFormat {
    Json,
    Sarif,
    Markdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub finding_id: String,
    pub file_path: String,
    pub severity: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggested_diff: Option<String>,
    pub is_new: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub files_scanned: usize,
    pub findings: usize,
    pub new_findings: usize,
    pub new_critical: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanReport {
    pub schema_version: u32,
    pub scanned_at: String,
    pub root: String,
    pub rules_hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub baseline_path: Option<String>,
    pub summary: ScanSummary,
    pub findings: Vec<Finding>,
}

impl ScanReport {
    pub fn new(root: String, rules_hash: String, baseline_path: Option<String>) -> Self {
        Self {
            schema_version: 1,
            scanned_at: Utc::now().to_rfc3339(),
            root,
            rules_hash,
            baseline_path,
            summary: ScanSummary {
                files_scanned: 0,
                findings: 0,
                new_findings: 0,
                new_critical: 0,
            },
            findings: Vec::new(),
        }
    }
}

pub fn render_report(report: &ScanReport, format: ReportFormat) -> Result<String> {
    match format {
        ReportFormat::Json => Ok(serde_json::to_string_pretty(report).context("JSON encode failed")?),
        ReportFormat::Markdown => Ok(render_markdown(report)),
        ReportFormat::Sarif => Ok(render_sarif(report)?),
    }
}

pub fn write_report(payload: &str, out: Option<&Path>) -> Result<()> {
    match out {
        Some(path) => {
            if let Some(parent) = path.parent() {
                if !parent.as_os_str().is_empty() {
                    fs::create_dir_all(parent).with_context(|| {
                        format!("Failed to create output directory: {}", parent.display())
                    })?;
                }
            }
            fs::write(path, payload)
                .with_context(|| format!("Failed to write output file: {}", path.display()))?;
            Ok(())
        }
        None => {
            let mut stdout = io::stdout().lock();
            stdout.write_all(payload.as_bytes())?;
            stdout.write_all(b"\n")?;
            Ok(())
        }
    }
}

fn render_markdown(report: &ScanReport) -> String {
    let mut out = String::new();
    out.push_str("# Guardian CLI Report\n\n");
    out.push_str(&format!("- Scanned at: {}\n", report.scanned_at));
    out.push_str(&format!("- Root: `{}`\n", report.root));
    out.push_str(&format!("- Rules hash: `{}`\n", report.rules_hash));
    if let Some(path) = &report.baseline_path {
        out.push_str(&format!("- Baseline: `{}`\n", path));
    }
    out.push('\n');

    out.push_str("## Summary\n\n");
    out.push_str(&format!(
        "- Files scanned: {}\n- Findings: {}\n- New findings: {}\n- New critical: {}\n\n",
        report.summary.files_scanned,
        report.summary.findings,
        report.summary.new_findings,
        report.summary.new_critical
    ));

    out.push_str("## Findings\n\n");
    if report.findings.is_empty() {
        out.push_str("_No findings._\n");
        return out;
    }

    for finding in &report.findings {
        let status = if finding.is_new { "NEW" } else { "BASELINE" };
        out.push_str(&format!(
            "- **{}** [{}] `{}`: {}\n",
            finding.severity, status, finding.file_path, finding.message
        ));
    }

    out
}

fn sarif_level(severity: &str) -> &'static str {
    match severity.to_lowercase().as_str() {
        "critical" => "error",
        "warning" => "warning",
        _ => "note",
    }
}

fn render_sarif(report: &ScanReport) -> Result<String> {
    let mut results = Vec::new();
    for finding in &report.findings {
        let rule_id = format!("guardian::{}", finding.finding_id);
        results.push(serde_json::json!({
            "ruleId": rule_id,
            "level": sarif_level(&finding.severity),
            "message": { "text": finding.message },
            "locations": [{
                "physicalLocation": {
                    "artifactLocation": { "uri": finding.file_path },
                    "region": { "startLine": 1 }
                }
            }],
            "properties": {
                "finding_id": finding.finding_id,
                "is_new": finding.is_new
            }
        }));
    }

    let sarif = serde_json::json!({
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": { "driver": { "name": "Guardian", "version": env!("CARGO_PKG_VERSION") } },
            "results": results
        }]
    });

    Ok(serde_json::to_string_pretty(&sarif)?)
}

