use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

const LOCK_SCHEMA_VERSION: u32 = 1;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum LockMode {
    Off,
    Warn,
    Strict,
}

impl LockMode {
    pub fn as_str(self) -> &'static str {
        match self {
            LockMode::Off => "off",
            LockMode::Warn => "warn",
            LockMode::Strict => "strict",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianLock {
    pub schema_version: u32,
    pub created_at: String,
    pub updated_at: String,
    pub guardian_version: String,
    pub workspace_id: String,
    pub rules_hash: String,
    pub rules_source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianLockSummary {
    pub path: String,
    pub mode: String,
    pub status: String,
    pub message: String,
    pub rules_hash_current: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rules_hash_locked: Option<String>,
    pub guardian_version_current: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guardian_version_locked: Option<String>,
}

pub fn resolve_lock_path(root: &Path, candidate: Option<PathBuf>) -> PathBuf {
    candidate.unwrap_or_else(|| root.join("guardian.lock"))
}

pub fn sync_guardian_lock(
    root: &Path,
    rules_hash: &str,
    lock_path: &Path,
    mode: LockMode,
) -> Result<GuardianLockSummary> {
    let guardian_version = env!("CARGO_PKG_VERSION").to_string();
    let workspace_id = workspace_id(root);

    if mode == LockMode::Off {
        return Ok(GuardianLockSummary {
            path: lock_path.to_string_lossy().to_string(),
            mode: mode.as_str().to_string(),
            status: "disabled".to_string(),
            message: "guardian.lock enforcement disabled".to_string(),
            rules_hash_current: rules_hash.to_string(),
            rules_hash_locked: None,
            guardian_version_current: guardian_version,
            guardian_version_locked: None,
        });
    }

    let mut warnings: Vec<String> = Vec::new();
    let mut existing_for_summary: Option<GuardianLock> = None;
    let mut should_write = false;
    let now = Utc::now().to_rfc3339();

    if lock_path.exists() {
        let raw = fs::read_to_string(lock_path)
            .with_context(|| format!("Failed to read lock file: {}", lock_path.display()))?;
        match serde_json::from_str::<GuardianLock>(&raw) {
            Ok(lock) => {
                let mut reasons: Vec<&str> = Vec::new();
                if lock.schema_version != LOCK_SCHEMA_VERSION {
                    reasons.push("schema_version mismatch");
                }
                if lock.workspace_id != workspace_id {
                    reasons.push("workspace mismatch");
                }
                if lock.rules_hash != rules_hash {
                    reasons.push("rules_hash mismatch");
                }
                if !reasons.is_empty() {
                    let reason_text = reasons.join(", ");
                    if mode == LockMode::Strict {
                        anyhow::bail!(
                            "guardian.lock validation failed in strict mode: {} (path={})",
                            reason_text,
                            lock_path.display()
                        );
                    }
                    warnings.push(format!("guardian.lock mismatch detected: {}", reason_text));
                    should_write = true;
                }
                if lock.guardian_version != guardian_version {
                    should_write = true;
                }
                existing_for_summary = Some(lock);
            }
            Err(err) => {
                if mode == LockMode::Strict {
                    anyhow::bail!(
                        "guardian.lock parse failed in strict mode (path={}): {}",
                        lock_path.display(),
                        err
                    );
                }
                warnings.push("guardian.lock parse failed, lock will be regenerated".to_string());
                should_write = true;
            }
        }
    } else {
        should_write = true;
    }

    if should_write {
        let created_at = existing_for_summary
            .as_ref()
            .map(|lock| lock.created_at.clone())
            .unwrap_or_else(|| now.clone());
        let lock = GuardianLock {
            schema_version: LOCK_SCHEMA_VERSION,
            created_at,
            updated_at: now,
            guardian_version: guardian_version.clone(),
            workspace_id,
            rules_hash: rules_hash.to_string(),
            rules_source: ".agent/rules".to_string(),
        };
        if let Some(parent) = lock_path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).with_context(|| {
                    format!("Failed to create lock directory: {}", parent.display())
                })?;
            }
        }
        let encoded = serde_json::to_string_pretty(&lock)
            .context("Failed to encode guardian.lock payload")?;
        fs::write(lock_path, encoded)
            .with_context(|| format!("Failed to write lock file: {}", lock_path.display()))?;
        existing_for_summary = Some(lock);
    }

    let status = if should_write {
        if warnings.is_empty() {
            "synced"
        } else {
            "synced_with_warning"
        }
    } else {
        "verified"
    };
    let message = if warnings.is_empty() {
        "guardian.lock verified".to_string()
    } else {
        warnings.join("; ")
    };

    Ok(GuardianLockSummary {
        path: lock_path.to_string_lossy().to_string(),
        mode: mode.as_str().to_string(),
        status: status.to_string(),
        message,
        rules_hash_current: rules_hash.to_string(),
        rules_hash_locked: existing_for_summary
            .as_ref()
            .map(|lock| lock.rules_hash.clone()),
        guardian_version_current: guardian_version,
        guardian_version_locked: existing_for_summary
            .as_ref()
            .map(|lock| lock.guardian_version.clone()),
    })
}

fn workspace_id(root: &Path) -> String {
    let normalized = dunce::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut hasher = Sha256::new();
    hasher.update(normalized.to_string_lossy().as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn sync_creates_lock_file_when_missing() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        let lock_path = root.join("guardian.lock");
        let summary = sync_guardian_lock(root, "abc123", &lock_path, LockMode::Warn).unwrap();
        assert_eq!(summary.status, "synced");
        assert!(lock_path.exists());
    }

    #[test]
    fn strict_mode_fails_on_rules_mismatch() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        let lock_path = root.join("guardian.lock");
        sync_guardian_lock(root, "abc123", &lock_path, LockMode::Warn).unwrap();
        let result = sync_guardian_lock(root, "def456", &lock_path, LockMode::Strict);
        assert!(result.is_err());
    }
}
