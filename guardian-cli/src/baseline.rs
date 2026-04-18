use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
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
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub findings: Vec<BaselineFinding>,
}

impl Baseline {
    pub fn finding_id_set(&self) -> HashSet<&str> {
        self.finding_ids.iter().map(|s| s.as_str()).collect()
    }
}

pub fn load_baseline(path: &Path) -> Result<Baseline> {
    let raw = fs::read_to_string(path)
        .with_context(|| format!("Failed to read baseline file: {}", path.display()))?;
    let baseline = serde_json::from_str::<Baseline>(&raw)
        .with_context(|| format!("Failed to parse baseline JSON: {}", path.display()))?;
    Ok(baseline)
}

pub fn resolve_baseline_path(root: &Path, candidate: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(path) = candidate {
        return Some(path);
    }
    let default = root.join(".guardian").join("baseline.json");
    if default.exists() {
        return Some(default);
    }
    None
}
