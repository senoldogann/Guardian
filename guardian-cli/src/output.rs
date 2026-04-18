use crate::guardian_lock::GuardianLockSummary;
use anyhow::{Context, Result};
use chrono::Utc;
use guardian_scan_policy::ReleaseDecision;
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_start: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_end: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_snippet: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub files_scanned: usize,
    pub findings: usize,
    pub new_findings: usize,
    pub new_critical: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseOverride {
    pub applied: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanReport {
    pub schema_version: u32,
    pub scanned_at: String,
    pub root: String,
    pub rules_hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scan_profile: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manifest_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manifest_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub baseline_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guardian_lock: Option<GuardianLockSummary>,
    pub release_decision: ReleaseDecision,
    pub requires_human_approval: bool,
    pub ai_heavy_change: bool,
    #[serde(rename = "override", default, skip_serializing_if = "Option::is_none")]
    pub override_info: Option<ReleaseOverride>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub decision_reasons: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_path: Option<String>,
    pub summary: ScanSummary,
    pub findings: Vec<Finding>,
}

impl ScanReport {
    pub fn new(root: String, rules_hash: String, baseline_path: Option<String>) -> Self {
        Self {
            schema_version: 2,
            scanned_at: Utc::now().to_rfc3339(),
            root,
            rules_hash,
            scan_profile: None,
            manifest_hash: None,
            manifest_path: None,
            evidence_path: None,
            baseline_path,
            guardian_lock: None,
            release_decision: ReleaseDecision::Pass,
            requires_human_approval: false,
            ai_heavy_change: false,
            override_info: None,
            decision_reasons: Vec::new(),
            policy_path: None,
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
        ReportFormat::Json => {
            Ok(serde_json::to_string_pretty(report).context("JSON encode failed")?)
        }
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
    if let Some(profile) = &report.scan_profile {
        out.push_str(&format!("- Scan profile: `{}`\n", profile));
    }
    if let Some(hash) = &report.manifest_hash {
        out.push_str(&format!("- Run manifest hash: `{}`\n", hash));
    }
    if let Some(path) = &report.manifest_path {
        out.push_str(&format!("- Run manifest: `{}`\n", path));
    }
    if let Some(path) = &report.evidence_path {
        out.push_str(&format!("- Evidence: `{}`\n", path));
    }
    if let Some(path) = &report.baseline_path {
        out.push_str(&format!("- Baseline: `{}`\n", path));
    }
    if let Some(lock) = &report.guardian_lock {
        out.push_str(&format!(
            "- guardian.lock: `{}` ({}, mode={})\n",
            lock.path, lock.status, lock.mode
        ));
    }
    if let Some(policy_path) = &report.policy_path {
        out.push_str(&format!("- Policy: `{}`\n", policy_path));
    }
    out.push_str(&format!(
        "- Release decision: `{}`\n",
        report.release_decision.as_str()
    ));
    out.push_str(&format!(
        "- Requires human approval: `{}`\n",
        report.requires_human_approval
    ));
    out.push_str(&format!(
        "- AI-heavy change: `{}`\n",
        report.ai_heavy_change
    ));
    if let Some(override_info) = &report.override_info {
        let approver = override_info.approver.as_deref().unwrap_or("not provided");
        let reason = override_info.reason.as_deref().unwrap_or("not provided");
        out.push_str(&format!(
            "- Override: applied={}, approver=`{}`, reason=`{}`\n",
            override_info.applied, approver, reason
        ));
    }
    if !report.decision_reasons.is_empty() {
        out.push_str("- Decision reasons:\n");
        for reason in &report.decision_reasons {
            out.push_str(&format!("  - {}\n", reason));
        }
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
                    "artifactLocation": { "uri": finding.file_path }
                }
            }],
            "properties": {
                "finding_id": finding.finding_id,
                "is_new": finding.is_new
            }
        }));
    }

    let sarif = serde_json::json!({
        "$schema": "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": { "driver": { "name": "Guardian", "version": env!("CARGO_PKG_VERSION") } },
            "properties": {
                "guardian_manifest_hash": report.manifest_hash.clone(),
                "scan_profile": report.scan_profile.clone(),
                "rules_hash": report.rules_hash.clone(),
                "release_decision": report.release_decision.as_str(),
                "requires_human_approval": report.requires_human_approval,
                "ai_heavy_change": report.ai_heavy_change
            },
            "results": results
        }]
    });

    Ok(serde_json::to_string_pretty(&sarif)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sarif_includes_run_level_properties() {
        let mut report = ScanReport::new("root".to_string(), "ruleshash".to_string(), None);
        report.scan_profile = Some("source".to_string());
        report.manifest_hash = Some("manifesthash".to_string());

        let payload = render_report(&report, ReportFormat::Sarif).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap();
        let props = &parsed["runs"][0]["properties"];

        assert_eq!(props["guardian_manifest_hash"], "manifesthash");
        assert_eq!(props["scan_profile"], "source");
        assert_eq!(props["rules_hash"], "ruleshash");
        assert_eq!(props["release_decision"], "PASS");
        assert_eq!(props["requires_human_approval"], false);
        assert_eq!(props["ai_heavy_change"], false);
    }
}
