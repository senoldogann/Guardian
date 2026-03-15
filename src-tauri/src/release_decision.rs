use crate::ai_client::Critique;
use crate::watcher;
use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use guardian_scan_policy::{
    classify_ai_heavy_change, evaluate_release_decision, load_policy_for_root, DecisionInputs,
    IntakeMetrics, ReleaseDecision,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, Write};
use std::path::{Path, PathBuf};

const RELEASE_DECISION_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseDecisionView {
    pub schema_version: u32,
    pub root: String,
    pub policy_path: String,
    pub decision: ReleaseDecision,
    pub requires_human_approval: bool,
    pub ai_heavy_change: bool,
    pub critical_findings: usize,
    pub warning_findings: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub override_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decided_at: Option<String>,
    pub audit_path: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub decision_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ReleaseDecisionAuditRecord {
    timestamp: String,
    action: String,
    decision: ReleaseDecision,
    approver: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    override_reason: Option<String>,
    critical_findings: usize,
    warning_findings: usize,
    ai_heavy_change: bool,
    policy_path: String,
}

#[derive(Debug, Clone, Default)]
struct ManualDecisionState {
    approver: Option<String>,
    reason: Option<String>,
    override_reason: Option<String>,
    decided_at: Option<String>,
    human_approved: bool,
}

fn release_decisions_path(root: &Path) -> PathBuf {
    root.join(".guardian").join("release_decisions.jsonl")
}

fn load_latest_audit_record(path: &Path) -> Option<ReleaseDecisionAuditRecord> {
    let file = fs::File::open(path).ok()?;
    let reader = std::io::BufReader::new(file);
    let mut last_record: Option<ReleaseDecisionAuditRecord> = None;
    for line in reader.lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(record) = serde_json::from_str::<ReleaseDecisionAuditRecord>(trimmed) {
            last_record = Some(record);
        }
    }
    last_record
}

fn append_audit_record(path: &Path, record: &ReleaseDecisionAuditRecord) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create audit directory: {}", parent.display()))?;
    }
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .with_context(|| format!("Failed to open audit file: {}", path.display()))?;
    let encoded = serde_json::to_string(record).context("Failed to encode audit record")?;
    writeln!(file, "{}", encoded).context("Failed to append audit record")?;
    Ok(())
}

fn collect_critiques(root: &str) -> Vec<Critique> {
    let active = watcher::active_critiques_for_root(root);
    if !active.is_empty() {
        return active;
    }
    watcher::critiques_from_snapshot_for_root(root)
}

fn derive_intake_from_critiques(critiques: &[Critique]) -> IntakeMetrics {
    let mut unique_files: HashSet<String> = HashSet::new();
    let mut refactor_signal = false;

    for critique in critiques {
        unique_files.insert(critique.file_path.clone());
        let combined = format!(
            "{} {}",
            critique.file_path.to_lowercase(),
            critique.message.to_lowercase()
        );
        if combined.contains("refactor")
            || combined.contains("migrat")
            || combined.contains("rewrite")
            || combined.contains("architectural drift")
        {
            refactor_signal = true;
        }
    }

    let changed_files = unique_files.len();
    let estimated_changed_lines = changed_files.saturating_mul(120);

    IntakeMetrics {
        changed_files,
        estimated_changed_lines,
        refactor_signal,
    }
}

fn manual_state_from_record(record: Option<&ReleaseDecisionAuditRecord>) -> ManualDecisionState {
    let Some(record) = record else {
        return ManualDecisionState::default();
    };
    let decision = record.decision;
    ManualDecisionState {
        approver: Some(record.approver.clone()),
        reason: record.reason.clone(),
        override_reason: record.override_reason.clone(),
        decided_at: Some(record.timestamp.clone()),
        human_approved: matches!(
            decision,
            ReleaseDecision::Pass | ReleaseDecision::PassWithWarning
        ),
    }
}

fn build_view(root: &Path, manual_state: ManualDecisionState) -> Result<ReleaseDecisionView> {
    let root_display = root.to_string_lossy().to_string();
    let critiques = collect_critiques(&root_display);
    let critical_findings = critiques
        .iter()
        .filter(|c| c.severity.eq_ignore_ascii_case("Critical"))
        .count();
    let warning_findings = critiques
        .iter()
        .filter(|c| c.severity.eq_ignore_ascii_case("Warning"))
        .count();

    let (policy, policy_path) = load_policy_for_root(root, None).map_err(anyhow::Error::msg)?;
    let intake = classify_ai_heavy_change(derive_intake_from_critiques(&critiques));
    let decision = evaluate_release_decision(
        &policy,
        DecisionInputs {
            critical_findings,
            warning_findings,
            ai_heavy_change: intake.ai_heavy_change,
            human_approved: manual_state.human_approved,
            override_reason: manual_state.override_reason.clone(),
        },
    );

    let mut decision_reasons = decision.reasons.clone();
    decision_reasons.push(intake.reason);
    let audit_path = release_decisions_path(root);

    Ok(ReleaseDecisionView {
        schema_version: RELEASE_DECISION_SCHEMA_VERSION,
        root: root_display,
        policy_path: policy_path.to_string_lossy().to_string(),
        decision: decision.decision,
        requires_human_approval: decision.requires_human_approval,
        ai_heavy_change: intake.ai_heavy_change,
        critical_findings,
        warning_findings,
        approver: manual_state.approver,
        reason: manual_state.reason,
        override_reason: decision.override_reason.or(manual_state.override_reason),
        decided_at: manual_state.decided_at,
        audit_path: audit_path.to_string_lossy().to_string(),
        decision_reasons,
    })
}

pub fn get_release_decision(root: &str) -> Result<ReleaseDecisionView> {
    let root_path = Path::new(root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(anyhow!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    let audit_path = release_decisions_path(root_path);
    let latest = load_latest_audit_record(&audit_path);
    let manual_state = manual_state_from_record(latest.as_ref());
    build_view(root_path, manual_state)
}

pub fn set_release_decision(
    root: &str,
    decision: ReleaseDecision,
    approver: String,
    reason: Option<String>,
) -> Result<ReleaseDecisionView> {
    let root_path = Path::new(root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(anyhow!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    let approver = approver.trim().to_string();
    if approver.is_empty() {
        return Err(anyhow!("Approver is required."));
    }
    if decision == ReleaseDecision::Overridden {
        return Err(anyhow!(
            "Use override_release_block for OVERRIDDEN decisions with a mandatory reason."
        ));
    }

    let base_view = get_release_decision(root)?;
    let record = ReleaseDecisionAuditRecord {
        timestamp: Utc::now().to_rfc3339(),
        action: "set_release_decision".to_string(),
        decision,
        approver,
        reason,
        override_reason: None,
        critical_findings: base_view.critical_findings,
        warning_findings: base_view.warning_findings,
        ai_heavy_change: base_view.ai_heavy_change,
        policy_path: base_view.policy_path,
    };

    let audit_path = release_decisions_path(root_path);
    append_audit_record(&audit_path, &record)?;
    get_release_decision(root)
}

pub fn override_release_block(
    root: &str,
    approver: String,
    reason: String,
) -> Result<ReleaseDecisionView> {
    let root_path = Path::new(root);
    if !root_path.exists() || !root_path.is_dir() {
        return Err(anyhow!(
            "Workspace root not accessible: {}. Select the correct folder in Scope.",
            root
        ));
    }
    let approver = approver.trim().to_string();
    if approver.is_empty() {
        return Err(anyhow!("Approver is required."));
    }
    let reason = reason.trim().to_string();
    if reason.is_empty() {
        return Err(anyhow!("Override reason is required."));
    }

    let base_view = get_release_decision(root)?;
    let record = ReleaseDecisionAuditRecord {
        timestamp: Utc::now().to_rfc3339(),
        action: "override_release_block".to_string(),
        decision: ReleaseDecision::Overridden,
        approver,
        reason: None,
        override_reason: Some(reason),
        critical_findings: base_view.critical_findings,
        warning_findings: base_view.warning_findings,
        ai_heavy_change: base_view.ai_heavy_change,
        policy_path: base_view.policy_path,
    };

    let audit_path = release_decisions_path(root_path);
    append_audit_record(&audit_path, &record)?;
    get_release_decision(root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::process::Command;
    use tempfile::TempDir;

    #[derive(Debug, Deserialize)]
    struct CliDecisionReport {
        release_decision: ReleaseDecision,
        requires_human_approval: bool,
        ai_heavy_change: bool,
    }

    #[derive(Debug)]
    struct CliDecisionResult {
        exit_code: i32,
        release_decision: ReleaseDecision,
        requires_human_approval: bool,
        ai_heavy_change: bool,
    }

    fn write_policy(root: &Path) {
        let raw = r#"
schema_version: 1
packs:
  - ai_generated_code_strict_mode
gate:
  pass_max_warnings: 5
  block_on_critical: true
  require_human_approval_on_ai_heavy: true
  require_override_reason: true
"#;
        fs::write(root.join("guardian.policy.yaml"), raw.trim_start()).expect("write policy");
    }

    fn write_source_files(root: &Path, count: usize, content: &str) {
        let src_dir = root.join("src");
        fs::create_dir_all(&src_dir).expect("create src dir");
        for idx in 0..count {
            fs::write(src_dir.join(format!("file_{idx}.ts")), content).expect("write source file");
        }
    }

    fn write_critiques_snapshot(root: &Path, severities: &[&str], message: &str) {
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("create guardian dir");

        let critiques: Vec<serde_json::Value> = severities
            .iter()
            .enumerate()
            .map(|(idx, severity)| {
                json!({
                    "finding_id": format!("f-{idx}"),
                    "file_path": format!("src/file_{idx}.ts"),
                    "severity": severity,
                    "message": message,
                    "suggestion": null,
                    "chat_message": null,
                    "suggested_diff": null
                })
            })
            .collect();

        let payload = json!({
            "protocol_version": 1,
            "timestamp": "2026-03-14T00:00:00Z",
            "workspace_id": "parity-workspace",
            "rules_hash": "test-rules-hash",
            "critiques": critiques
        });

        fs::write(
            guardian_dir.join("critiques.json"),
            serde_json::to_string_pretty(&payload).expect("serialize snapshot"),
        )
        .expect("write critiques snapshot");
    }

    fn write_critiques_snapshot_with_fix_suggestions(
        root: &Path,
        severities: &[&str],
        message: &str,
    ) {
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("create guardian dir");

        let critiques: Vec<serde_json::Value> = severities
            .iter()
            .enumerate()
            .map(|(idx, severity)| {
                json!({
                    "finding_id": format!("fx-{idx}"),
                    "file_path": format!("src/file_{idx}.ts"),
                    "severity": severity,
                    "message": message,
                    "suggestion": "Use service boundary + stricter input validation.",
                    "chat_message": "Guardian suggested an automatic fix draft.",
                    "suggested_diff": format!("diff --git a/src/file_{idx}.ts b/src/file_{idx}.ts\n@@\n-legacy\n+fixed\n")
                })
            })
            .collect();

        let payload = json!({
            "protocol_version": 1,
            "timestamp": "2026-03-14T00:00:00Z",
            "workspace_id": "fix-suggestion-workspace",
            "rules_hash": "test-rules-hash",
            "critiques": critiques
        });

        fs::write(
            guardian_dir.join("critiques.json"),
            serde_json::to_string_pretty(&payload).expect("serialize snapshot"),
        )
        .expect("write critiques snapshot");
    }

    fn guardian_cli_manifest_path() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("workspace root")
            .join("guardian-cli")
            .join("Cargo.toml")
    }

    fn run_cli_decision(
        root: &Path,
        approver: Option<&str>,
        override_reason: Option<&str>,
    ) -> CliDecisionResult {
        let guardian_dir = root.join(".guardian");
        fs::create_dir_all(&guardian_dir).expect("create guardian dir");
        let out_path = guardian_dir.join("cli_decision_report.json");

        let mut cmd = Command::new("cargo");
        cmd.arg("run")
            .arg("--quiet")
            .arg("--manifest-path")
            .arg(guardian_cli_manifest_path())
            .arg("--")
            .arg("scan")
            .arg("--root")
            .arg(root)
            .arg("--offline")
            .arg("--no-baseline")
            .arg("--format")
            .arg("json")
            .arg("--out")
            .arg(&out_path)
            .arg("--pr-gate")
            .arg("off")
            .arg("--release-gate")
            .arg("strict")
            .arg("--policy")
            .arg(root.join("guardian.policy.yaml"));

        if let Some(value) = approver {
            cmd.arg("--approver").arg(value);
        }
        if let Some(value) = override_reason {
            cmd.arg("--override-reason").arg(value);
        }

        let output = cmd.output().expect("run guardian-cli");
        let exit_code = output.status.code().unwrap_or(-1);
        assert!(
            exit_code == 0 || exit_code == 1,
            "guardian-cli unexpected exit code {exit_code}: {}",
            String::from_utf8_lossy(&output.stdout)
        );

        let report: CliDecisionReport =
            serde_json::from_str(&fs::read_to_string(&out_path).expect("read cli report"))
                .expect("parse cli report");

        CliDecisionResult {
            exit_code,
            release_decision: report.release_decision,
            requires_human_approval: report.requires_human_approval,
            ai_heavy_change: report.ai_heavy_change,
        }
    }

    #[test]
    fn desktop_and_cli_decisions_match_for_ai_heavy_and_override_flows() {
        // Scenario A: AI-heavy intake without approval should block.
        let ai_heavy_dir = TempDir::new().expect("tempdir");
        let ai_heavy_root = ai_heavy_dir.path();
        write_policy(ai_heavy_root);
        write_source_files(ai_heavy_root, 16, "export const value = 1;\n");
        let severities = vec!["Info"; 16];
        write_critiques_snapshot(
            ai_heavy_root,
            &severities,
            "Synthetic critique to model an AI-heavy intake.",
        );

        let desktop_block =
            get_release_decision(ai_heavy_root.to_string_lossy().as_ref()).expect("desktop block");
        let cli_block = run_cli_decision(ai_heavy_root, None, None);
        assert_eq!(desktop_block.decision, cli_block.release_decision);
        assert_eq!(
            desktop_block.requires_human_approval,
            cli_block.requires_human_approval
        );
        assert_eq!(desktop_block.ai_heavy_change, cli_block.ai_heavy_change);
        assert_eq!(desktop_block.decision, ReleaseDecision::BlockUntilApproved);
        assert_eq!(cli_block.exit_code, 1);

        // Scenario B: Same intake with manual approval should pass with warning.
        let desktop_approved = set_release_decision(
            ai_heavy_root.to_string_lossy().as_ref(),
            ReleaseDecision::Pass,
            "release-manager".to_string(),
            Some("Approved after manual architectural review.".to_string()),
        )
        .expect("desktop approve");
        let cli_approved = run_cli_decision(ai_heavy_root, Some("release-manager"), None);
        assert_eq!(desktop_approved.decision, cli_approved.release_decision);
        assert_eq!(
            desktop_approved.requires_human_approval,
            cli_approved.requires_human_approval
        );
        assert_eq!(
            desktop_approved.ai_heavy_change,
            cli_approved.ai_heavy_change
        );
        assert_eq!(desktop_approved.decision, ReleaseDecision::PassWithWarning);
        assert_eq!(cli_approved.exit_code, 0);

        // Scenario C: Critical finding with override reason should be OVERRIDDEN on both.
        let critical_dir = TempDir::new().expect("tempdir");
        let critical_root = critical_dir.path();
        write_policy(critical_root);
        write_source_files(critical_root, 1, "const x = eval('1+1');\n");
        write_critiques_snapshot(
            critical_root,
            &["Critical"],
            "Critical policy violation for override parity.",
        );

        let desktop_overridden = override_release_block(
            critical_root.to_string_lossy().as_ref(),
            "release-manager".to_string(),
            "Emergency production hotfix.".to_string(),
        )
        .expect("desktop override");
        let cli_overridden = run_cli_decision(
            critical_root,
            Some("release-manager"),
            Some("Emergency production hotfix."),
        );
        assert_eq!(desktop_overridden.decision, cli_overridden.release_decision);
        assert_eq!(
            desktop_overridden.requires_human_approval,
            cli_overridden.requires_human_approval
        );
        assert_eq!(
            desktop_overridden.ai_heavy_change,
            cli_overridden.ai_heavy_change
        );
        assert_eq!(desktop_overridden.decision, ReleaseDecision::Overridden);
        assert_eq!(cli_overridden.exit_code, 0);
    }

    #[test]
    fn approval_workflow_records_audit_and_unblocks_ai_heavy_release() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        write_policy(root);
        write_source_files(root, 16, "export const value = 1;\n");
        let severities = vec!["Info"; 16];
        write_critiques_snapshot(root, &severities, "AI-heavy intake for approval workflow.");

        let initial =
            get_release_decision(root.to_string_lossy().as_ref()).expect("initial decision");
        assert_eq!(initial.decision, ReleaseDecision::BlockUntilApproved);

        let approved = set_release_decision(
            root.to_string_lossy().as_ref(),
            ReleaseDecision::Pass,
            "release-manager".to_string(),
            Some("Approved after review.".to_string()),
        )
        .expect("set release decision");
        assert_eq!(approved.decision, ReleaseDecision::PassWithWarning);
        assert_eq!(approved.approver.as_deref(), Some("release-manager"));
        assert_eq!(approved.reason.as_deref(), Some("Approved after review."));

        let audit_path = root.join(".guardian").join("release_decisions.jsonl");
        let raw = fs::read_to_string(&audit_path).expect("read audit file");
        let lines: Vec<&str> = raw.lines().filter(|line| !line.trim().is_empty()).collect();
        assert_eq!(lines.len(), 1);
        let record: serde_json::Value = serde_json::from_str(lines[0]).expect("parse audit record");
        assert_eq!(
            record.get("action").and_then(|v| v.as_str()),
            Some("set_release_decision")
        );
        assert_eq!(
            record.get("approver").and_then(|v| v.as_str()),
            Some("release-manager")
        );
        assert_eq!(
            record.get("reason").and_then(|v| v.as_str()),
            Some("Approved after review.")
        );
    }

    #[test]
    fn e2e_block_then_approve_then_release_gate_passes_with_audit_trail() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        write_policy(root);
        write_source_files(root, 16, "export const value = 1;\n");
        let severities = vec!["Info"; 16];
        write_critiques_snapshot(root, &severities, "AI-heavy intake for E2E release gate.");

        let initial =
            get_release_decision(root.to_string_lossy().as_ref()).expect("initial decision");
        assert_eq!(initial.decision, ReleaseDecision::BlockUntilApproved);

        let initial_cli = run_cli_decision(root, None, None);
        assert_eq!(
            initial_cli.release_decision,
            ReleaseDecision::BlockUntilApproved
        );
        assert_eq!(initial_cli.exit_code, 1);

        let approved = set_release_decision(
            root.to_string_lossy().as_ref(),
            ReleaseDecision::Pass,
            "release-manager".to_string(),
            Some("Approved after architecture review.".to_string()),
        )
        .expect("set release decision");
        assert_eq!(approved.decision, ReleaseDecision::PassWithWarning);

        let audit_path = root.join(".guardian").join("release_decisions.jsonl");
        let raw = fs::read_to_string(&audit_path).expect("read audit file");
        let lines: Vec<&str> = raw.lines().filter(|line| !line.trim().is_empty()).collect();
        assert_eq!(lines.len(), 1);
        let record: serde_json::Value = serde_json::from_str(lines[0]).expect("parse audit record");
        assert_eq!(
            record.get("action").and_then(|v| v.as_str()),
            Some("set_release_decision")
        );
        assert_eq!(
            record.get("approver").and_then(|v| v.as_str()),
            Some("release-manager")
        );

        let approved_cli = run_cli_decision(root, Some("release-manager"), None);
        assert_eq!(
            approved_cli.release_decision,
            ReleaseDecision::PassWithWarning
        );
        assert_eq!(approved_cli.exit_code, 0);
    }

    #[test]
    fn fix_suggestions_do_not_auto_approve_release_without_human_decision() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        write_policy(root);
        write_source_files(root, 16, "export const value = 1;\n");
        let severities = vec!["Warning"; 16];
        write_critiques_snapshot_with_fix_suggestions(
            root,
            &severities,
            "Large refactor suggestion from AI assistant.",
        );

        let desktop =
            get_release_decision(root.to_string_lossy().as_ref()).expect("desktop decision");
        assert_eq!(desktop.ai_heavy_change, true);
        assert_eq!(desktop.requires_human_approval, true);
        assert_eq!(desktop.decision, ReleaseDecision::BlockUntilApproved);

        let cli = run_cli_decision(root, None, None);
        assert_eq!(cli.ai_heavy_change, true);
        assert_eq!(cli.requires_human_approval, true);
        assert_eq!(cli.release_decision, ReleaseDecision::BlockUntilApproved);
        assert_eq!(cli.exit_code, 1);
    }

    #[test]
    fn override_workflow_requires_reason_and_records_audit_entry() {
        let tmp = TempDir::new().expect("tempdir");
        let root = tmp.path();
        write_policy(root);
        write_source_files(root, 16, "export const value = 1;\n");
        let severities = vec!["Info"; 16];
        write_critiques_snapshot(root, &severities, "AI-heavy intake for override workflow.");

        let initial =
            get_release_decision(root.to_string_lossy().as_ref()).expect("initial decision");
        assert_eq!(initial.decision, ReleaseDecision::BlockUntilApproved);

        let overridden = override_release_block(
            root.to_string_lossy().as_ref(),
            "release-manager".to_string(),
            "Emergency hotfix for production incident.".to_string(),
        )
        .expect("override release block");
        assert_eq!(overridden.decision, ReleaseDecision::Overridden);
        assert_eq!(overridden.approver.as_deref(), Some("release-manager"));
        assert_eq!(
            overridden.override_reason.as_deref(),
            Some("Emergency hotfix for production incident.")
        );

        let audit_path = root.join(".guardian").join("release_decisions.jsonl");
        let raw = fs::read_to_string(&audit_path).expect("read audit file");
        let lines: Vec<&str> = raw.lines().filter(|line| !line.trim().is_empty()).collect();
        assert_eq!(lines.len(), 1);
        let record: serde_json::Value = serde_json::from_str(lines[0]).expect("parse audit record");
        assert_eq!(
            record.get("action").and_then(|v| v.as_str()),
            Some("override_release_block")
        );
        assert_eq!(
            record.get("approver").and_then(|v| v.as_str()),
            Some("release-manager")
        );
        assert_eq!(
            record.get("override_reason").and_then(|v| v.as_str()),
            Some("Emergency hotfix for production incident.")
        );
    }
}
