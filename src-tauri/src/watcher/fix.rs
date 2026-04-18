use chrono::Utc;
use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use super::normalize_rel_file_path;

pub(crate) const FIX_PROPOSALS_DIR: &str = ".guardian-proposals";
pub(crate) const FIX_PROPOSALS_FILE: &str = "fix_proposals.jsonl";

#[derive(Debug, Clone, Serialize)]
pub struct FixProposal {
    pub proposal_id: String,
    pub timestamp: String,
    pub status: String,
    pub file_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finding_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proposed_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_content_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proposed_content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FixProposalsSnapshot {
    pub timestamp: String,
    pub root: String,
    pub source_path: String,
    pub proposals: Vec<FixProposal>,
}

pub(super) static LAST_FIX_PROPOSALS: Lazy<Arc<RwLock<Option<FixProposalsSnapshot>>>> =
    Lazy::new(|| Arc::new(RwLock::new(None)));

pub(super) fn fix_proposals_preferred_path(root: &Path) -> PathBuf {
    root.join(FIX_PROPOSALS_DIR).join(FIX_PROPOSALS_FILE)
}

pub(super) fn fix_proposals_legacy_path(root: &Path) -> PathBuf {
    root.join(".guardian").join(FIX_PROPOSALS_FILE)
}

pub(super) fn migrate_fix_proposals_if_needed(root: &Path) -> PathBuf {
    let preferred = fix_proposals_preferred_path(root);
    if preferred.exists() {
        return preferred;
    }

    let legacy = fix_proposals_legacy_path(root);
    if !legacy.exists() {
        return preferred;
    }

    if let Some(parent) = preferred.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if fs::rename(&legacy, &preferred).is_ok() {
        return preferred;
    }

    if let Ok(raw) = fs::read(&legacy) {
        if fs::write(&preferred, raw).is_ok() {
            let _ = fs::remove_file(&legacy);
        }
    }

    preferred
}

pub(crate) fn fix_proposals_path_for_root(root: &str) -> PathBuf {
    migrate_fix_proposals_if_needed(Path::new(root))
}

pub(crate) fn refresh_fix_proposals_for_root(root: &str) -> FixProposalsSnapshot {
    let snapshot = load_fix_proposals_snapshot(root);
    if let Ok(mut lock) = LAST_FIX_PROPOSALS.write() {
        *lock = Some(snapshot.clone());
    }
    snapshot
}

pub(super) fn load_fix_proposals_snapshot(root: &str) -> FixProposalsSnapshot {
    let root_path = Path::new(root);
    let proposals_path = migrate_fix_proposals_if_needed(root_path);
    let mut map: HashMap<String, FixProposal> = HashMap::new();

    let timestamp_now = Utc::now().to_rfc3339();
    let source_path = proposals_path.to_string_lossy().to_string();

    let file = match fs::File::open(&proposals_path) {
        Ok(file) => file,
        Err(_) => {
            return FixProposalsSnapshot {
                timestamp: timestamp_now,
                root: root.to_string(),
                source_path,
                proposals: Vec::new(),
            }
        }
    };

    let reader = std::io::BufReader::new(file);
    for line in reader.lines().flatten() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let value: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let proposal_id = value
            .get("proposal_id")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string());
        let Some(proposal_id) = proposal_id.filter(|s| !s.is_empty()) else {
            continue;
        };

        let kind = value
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_lowercase();
        let has_content = value
            .get("proposed_content")
            .and_then(|v| v.as_str())
            .is_some();

        let status = value
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or(if has_content { "pending" } else { "" })
            .trim()
            .to_lowercase();

        let ts = value
            .get("timestamp")
            .and_then(|v| v.as_str())
            .unwrap_or(&timestamp_now)
            .to_string();

        let file_path = value
            .get("file_path")
            .and_then(|v| v.as_str())
            .map(|s| normalize_rel_file_path(root_path, s))
            .unwrap_or_default();

        if kind == "proposal" || has_content {
            let proposed_content = value
                .get("proposed_content")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let current = FixProposal {
                proposal_id: proposal_id.clone(),
                timestamp: ts,
                status: if status.is_empty() {
                    "pending".to_string()
                } else {
                    status
                },
                file_path,
                finding_id: value
                    .get("finding_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                proposed_by: value
                    .get("proposed_by")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                original_content_hash: value
                    .get("original_content_hash")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                suggestion: value
                    .get("suggestion")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                proposed_content,
                confidence: value
                    .get("confidence")
                    .and_then(|v| v.as_f64())
                    .map(|n| n as f32),
                reasoning: value
                    .get("reasoning")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            };

            map.insert(proposal_id, current);
            continue;
        }

        if kind == "status" || !status.is_empty() {
            let entry = map.entry(proposal_id.clone()).or_insert(FixProposal {
                proposal_id,
                timestamp: ts.clone(),
                status: "pending".to_string(),
                file_path,
                finding_id: None,
                proposed_by: None,
                original_content_hash: None,
                suggestion: None,
                proposed_content: None,
                confidence: None,
                reasoning: None,
            });

            entry.timestamp = ts;
            if !status.is_empty() {
                entry.status = status;
            }
        }
    }

    let mut proposals: Vec<FixProposal> = map.into_values().collect();
    proposals.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    FixProposalsSnapshot {
        timestamp: timestamp_now,
        root: root.to_string(),
        source_path,
        proposals,
    }
}
