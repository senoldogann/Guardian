use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceFinding {
    pub finding_id: String,
    pub rule_id: String,
    pub file_path_rel: String,
    pub location_fingerprint: String,
    pub severity: String,
    pub explanation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    pub evidence_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceReport {
    pub schema_version: u32,
    pub generated_at: String,
    pub root: String,
    pub rules_hash: String,
    pub scan_profile: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manifest_hash: Option<String>,
    pub findings: Vec<EvidenceFinding>,
}

impl EvidenceReport {
    pub fn new(
        root: String,
        rules_hash: String,
        scan_profile: String,
        manifest_hash: Option<String>,
        findings: Vec<EvidenceFinding>,
    ) -> Self {
        Self {
            schema_version: 1,
            generated_at: Utc::now().to_rfc3339(),
            root,
            rules_hash,
            scan_profile,
            manifest_hash,
            findings,
        }
    }
}
