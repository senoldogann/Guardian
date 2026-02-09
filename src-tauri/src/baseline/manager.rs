use crate::ai_client::Critique;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineFinding {
    pub finding_id: String,
    pub file_path: String,
    pub severity: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Baseline {
    pub schema_version: u32,
    pub created_at: String,
    pub workspace_id: String,
    pub rules_hash: String,
    pub finding_ids: Vec<String>,
    /// Optional metadata to enable a meaningful "Resolved" view without rereading history logs.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub findings: Vec<BaselineFinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BaselineStatusView {
    pub valid: bool,
    pub baseline_age_days: u32,
    pub active: usize,
    pub new_since_baseline: usize,
    pub resolved_since_baseline: usize,
    pub rules_hash_current: String,
    pub rules_hash_baseline: String,
    pub created_at: String,
}

pub struct BaselineManager {
    workspace_root: PathBuf,
}

impl BaselineManager {
    pub fn new(workspace_root: PathBuf) -> Self {
        Self { workspace_root }
    }

    pub fn baseline_path(&self) -> PathBuf {
        self.workspace_root.join(".guardian").join("baseline.json")
    }

    pub fn load(&self) -> Result<Option<Baseline>> {
        let path = self.baseline_path();
        if !path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("Failed to read baseline file: {}", path.display()))?;
        let baseline = serde_json::from_str::<Baseline>(&raw)
            .with_context(|| format!("Failed to parse baseline JSON: {}", path.display()))?;
        Ok(Some(baseline))
    }

    pub fn save(&self, baseline: &Baseline) -> Result<()> {
        let path = self.baseline_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create baseline dir: {}", parent.display()))?;
        }
        let payload = serde_json::to_string_pretty(baseline).context("Failed to encode baseline")?;
        fs::write(&path, payload)
            .with_context(|| format!("Failed to write baseline file: {}", path.display()))?;
        Ok(())
    }

    pub fn delete(&self) -> Result<()> {
        let path = self.baseline_path();
        if path.exists() {
            fs::remove_file(&path)
                .with_context(|| format!("Failed to delete baseline file: {}", path.display()))?;
        }
        Ok(())
    }

    pub fn create_baseline(&self, critiques: &[Critique]) -> Result<Baseline> {
        let now = Utc::now();
        let root_str = self.workspace_root.to_string_lossy().to_string();
        let rules_hash = crate::skills::hasher::get_rules_fingerprint(&root_str);
        let workspace_id = compute_workspace_id(&self.workspace_root)?;

        let mut findings: Vec<BaselineFinding> = Vec::new();
        for critique in critiques {
            let normalized_path = normalize_rel_file_path(&self.workspace_root, &critique.file_path);
            let finding_id = finding_id_for_critique(&self.workspace_root, critique, &rules_hash);
            findings.push(BaselineFinding {
                finding_id: finding_id.clone(),
                file_path: normalized_path,
                severity: critique.severity.clone(),
                message: Some(truncate_for_baseline(&critique.message)),
            });
        }

        // Keep stable ordering + de-dupe.
        findings.sort_by(|a, b| a.finding_id.cmp(&b.finding_id));
        findings.dedup_by(|a, b| a.finding_id == b.finding_id);

        let finding_ids: Vec<String> = findings.iter().map(|f| f.finding_id.clone()).collect();

        let baseline = Baseline {
            schema_version: 2,
            created_at: now.to_rfc3339(),
            workspace_id,
            rules_hash,
            finding_ids,
            findings,
        };

        self.save(&baseline)?;
        Ok(baseline)
    }

    pub fn status(&self, baseline: &Baseline, current: &[Critique]) -> Result<BaselineStatusView> {
        let root_str = self.workspace_root.to_string_lossy().to_string();
        let rules_hash_current = crate::skills::hasher::get_rules_fingerprint(&root_str);

        let baseline_set: HashSet<&str> = baseline.finding_ids.iter().map(|s| s.as_str()).collect();

        let mut current_ids: HashSet<String> = HashSet::new();
        for critique in current {
            current_ids.insert(finding_id_for_critique(
                &self.workspace_root,
                critique,
                &rules_hash_current,
            ));
        }

        let mut active = 0usize;
        let mut new_since = 0usize;
        for id in current_ids.iter() {
            if baseline_set.contains(id.as_str()) {
                active += 1;
            } else {
                new_since += 1;
            }
        }

        let mut resolved = 0usize;
        for id in baseline_set.iter() {
            if !current_ids.contains(*id) {
                resolved += 1;
            }
        }

        let baseline_age_days = baseline_age_days(&baseline.created_at);

        let valid = baseline.schema_version == 2 && baseline.rules_hash == rules_hash_current;

        Ok(BaselineStatusView {
            valid,
            baseline_age_days,
            active,
            new_since_baseline: new_since,
            resolved_since_baseline: resolved,
            rules_hash_current,
            rules_hash_baseline: baseline.rules_hash.clone(),
            created_at: baseline.created_at.clone(),
        })
    }
}

fn baseline_age_days(created_at: &str) -> u32 {
    let Ok(parsed) = DateTime::parse_from_rfc3339(created_at) else {
        return 0;
    };
    let dt = parsed.with_timezone(&Utc);
    let days = Utc::now()
        .signed_duration_since(dt)
        .num_days()
        .max(0);
    days as u32
}

fn truncate_for_baseline(message: &str) -> String {
    const MAX_CHARS: usize = 600;
    let trimmed = message.trim();
    if trimmed.len() <= MAX_CHARS {
        return trimmed.to_string();
    }
    let mut out = trimmed[..MAX_CHARS].to_string();
    out.push_str("…");
    out
}

pub fn compute_workspace_id(root: &Path) -> Result<String> {
    let normalized = dunce::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    Ok(sha256_hex(normalized.to_string_lossy().as_bytes()))
}

pub fn compute_finding_id(
    rule_id: &str,
    file_path: &str,
    location_fingerprint: &str,
    rules_hash: &str,
) -> String {
    let normalized = format!("{rule_id}|{file_path}|{location_fingerprint}|{rules_hash}");
    sha256_hex(normalized.as_bytes())
}

fn normalize_rel_file_path(workspace_root: &Path, file_path: &str) -> String {
    let input = Path::new(file_path);

    if !input.is_absolute() {
        let rel = file_path.trim().trim_start_matches("./").to_string();
        return rel.replace('\\', "/");
    }

    if let Ok(rel) = input.strip_prefix(workspace_root) {
        return rel
            .to_string_lossy()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string();
    }

    let canonical_root = dunce::canonicalize(workspace_root).unwrap_or_else(|_| workspace_root.to_path_buf());
    let canonical_input = dunce::canonicalize(input).unwrap_or_else(|_| input.to_path_buf());
    if let Ok(rel) = canonical_input.strip_prefix(&canonical_root) {
        return rel
            .to_string_lossy()
            .replace('\\', "/")
            .trim_start_matches("./")
            .to_string();
    }

    file_path.trim().replace('\\', "/")
}

pub fn finding_id_for_critique(workspace_root: &Path, critique: &Critique, rules_hash: &str) -> String {
    // Phase 2: Normalize paths to be portable across machines/CI.
    // We intentionally do NOT include AI message text in the ID for stability.
    let sev = critique.severity.trim().to_lowercase();
    let rule_id = format!("guardian-v1::{sev}");
    let rel_path = normalize_rel_file_path(workspace_root, &critique.file_path);
    compute_finding_id(&rule_id, &rel_path, "", rules_hash)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn sample_critique(path: &str, severity: &str, message: &str) -> Critique {
        Critique {
            file_path: path.to_string(),
            severity: severity.to_string(),
            message: message.to_string(),
            suggestion: None,
            chat_message: None,
            suggested_diff: None,
            finding_id: None,
        }
    }

    #[test]
    fn finding_id_is_deterministic_for_same_inputs() {
        let rules_hash = "abc123";
        let c1 = sample_critique("/tmp/a.rs", "Critical", "X");
        let c2 = sample_critique("/tmp/a.rs", "Critical", "Y"); // message changes should not matter
        let root = Path::new("/tmp");
        let id1 = finding_id_for_critique(root, &c1, rules_hash);
        let id2 = finding_id_for_critique(root, &c2, rules_hash);
        assert_eq!(id1, id2);
    }

    #[test]
    fn baseline_roundtrip_and_status_counts() {
        let dir = TempDir::new().unwrap();
        let root = dir.path().join("workspace");
        fs::create_dir_all(root.join(".guardian")).unwrap();
        let manager = BaselineManager::new(root.clone());

        let critiques = vec![
            sample_critique(root.join("src/a.rs").to_string_lossy().as_ref(), "Critical", "A"),
            sample_critique(root.join("src/b.rs").to_string_lossy().as_ref(), "Warning", "B"),
        ];
        let baseline = manager.create_baseline(&critiques).unwrap();
        let loaded = manager.load().unwrap().unwrap();
        assert_eq!(baseline.schema_version, loaded.schema_version);
        assert_eq!(baseline.finding_ids.len(), 2);

        // Current: keep one, add one new -> resolved 1, active 1, new 1.
        let current = vec![
            critiques[0].clone(),
            sample_critique(root.join("src/c.rs").to_string_lossy().as_ref(), "Critical", "C"),
        ];
        let status = manager.status(&loaded, &current).unwrap();
        assert_eq!(status.active, 1);
        assert_eq!(status.new_since_baseline, 1);
        assert_eq!(status.resolved_since_baseline, 1);
    }
}
