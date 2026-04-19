use crate::atomic_write;
use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const GUARDIAN_LOCK_FILE: &str = "guardian.lock";
const GUARDIAN_LOCK_SCHEMA_VERSION: u32 = 1;

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

#[derive(Debug, Clone, Serialize)]
pub struct GuardianLockStatus {
    pub path: String,
    pub exists: bool,
    pub valid: bool,
    pub message: String,
    pub rules_hash_current: String,
    pub rules_hash_locked: Option<String>,
    pub guardian_version_current: String,
    pub guardian_version_locked: Option<String>,
    pub schema_version_locked: Option<u32>,
}

pub fn lock_path(root: &Path) -> PathBuf {
    root.join(GUARDIAN_LOCK_FILE)
}

pub fn status(root: &Path) -> Result<GuardianLockStatus> {
    let path = lock_path(root);
    let rules_hash_current = rules_hash_for_root(root);
    let guardian_version_current = env!("CARGO_PKG_VERSION").to_string();

    if !path.exists() {
        return Ok(GuardianLockStatus {
            path: path.to_string_lossy().to_string(),
            exists: false,
            valid: false,
            message: "guardian.lock not found".to_string(),
            rules_hash_current,
            rules_hash_locked: None,
            guardian_version_current,
            guardian_version_locked: None,
            schema_version_locked: None,
        });
    }

    let raw = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read lock file: {}", path.display()))?;
    let parsed: GuardianLock = match serde_json::from_str(&raw) {
        Ok(lock) => lock,
        Err(err) => {
            return Ok(GuardianLockStatus {
                path: path.to_string_lossy().to_string(),
                exists: true,
                valid: false,
                message: format!("guardian.lock parse error: {}", err),
                rules_hash_current,
                rules_hash_locked: None,
                guardian_version_current,
                guardian_version_locked: None,
                schema_version_locked: None,
            });
        }
    };

    let workspace_id_current = crate::baseline::manager::compute_workspace_id(root)?;
    let schema_ok = parsed.schema_version == GUARDIAN_LOCK_SCHEMA_VERSION;
    let workspace_ok = parsed.workspace_id == workspace_id_current;
    let rules_ok = parsed.rules_hash == rules_hash_current;
    let valid = schema_ok && workspace_ok && rules_ok;

    let message = if valid {
        if rules_hash_current.is_empty() {
            "guardian.lock is valid but rules hash is empty (.agent/rules not found)".to_string()
        } else {
            "guardian.lock is valid".to_string()
        }
    } else {
        let mut reasons: Vec<&str> = Vec::new();
        if !schema_ok {
            reasons.push("schema_version mismatch");
        }
        if !workspace_ok {
            reasons.push("workspace mismatch");
        }
        if !rules_ok {
            reasons.push("rules_hash mismatch");
        }
        format!("guardian.lock invalid: {}", reasons.join(", "))
    };

    Ok(GuardianLockStatus {
        path: path.to_string_lossy().to_string(),
        exists: true,
        valid,
        message,
        rules_hash_current,
        rules_hash_locked: Some(parsed.rules_hash),
        guardian_version_current,
        guardian_version_locked: Some(parsed.guardian_version),
        schema_version_locked: Some(parsed.schema_version),
    })
}

pub fn sync_guardian_lock(root: &Path) -> Result<GuardianLockStatus> {
    let path = lock_path(root);
    let rules_hash = rules_hash_for_root(root);
    let guardian_version = env!("CARGO_PKG_VERSION").to_string();
    let workspace_id = crate::baseline::manager::compute_workspace_id(root)?;
    let now = Utc::now().to_rfc3339();

    let existing = read_lock_if_valid(&path)?;
    let created_at = existing
        .as_ref()
        .map(|lock| lock.created_at.clone())
        .unwrap_or_else(|| now.clone());

    let mut should_write = existing.is_none();

    if let Some(lock) = existing.as_ref() {
        let unchanged = lock.schema_version == GUARDIAN_LOCK_SCHEMA_VERSION
            && lock.rules_hash == rules_hash
            && lock.guardian_version == guardian_version
            && lock.workspace_id == workspace_id
            && lock.rules_source == ".agent/rules";
        if !unchanged {
            should_write = true;
        }
    }

    if should_write {
        let payload = GuardianLock {
            schema_version: GUARDIAN_LOCK_SCHEMA_VERSION,
            created_at,
            updated_at: now,
            guardian_version,
            workspace_id,
            rules_hash,
            rules_source: ".agent/rules".to_string(),
        };
        let encoded =
            serde_json::to_string_pretty(&payload).context("Failed to serialize guardian.lock")?;
        atomic_write::atomic_write(&path, encoded.as_bytes())
            .with_context(|| format!("Failed to write lock file: {}", path.display()))?;
    }

    status(root)
}

fn read_lock_if_valid(path: &Path) -> Result<Option<GuardianLock>> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .with_context(|| format!("Failed to read lock file: {}", path.display()))?;
    let parsed = serde_json::from_str::<GuardianLock>(&raw).ok();
    Ok(parsed)
}

fn rules_hash_for_root(root: &Path) -> String {
    crate::skills::hasher::get_rules_fingerprint(&root.to_string_lossy())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn seed_rules(root: &Path, content: &str) {
        let rules_dir = root.join(".agent").join("rules");
        fs::create_dir_all(&rules_dir).unwrap();
        fs::write(rules_dir.join("policy.md"), content).unwrap();
    }

    #[test]
    fn sync_creates_guardian_lock_file() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        seed_rules(root, "# policy v1");

        let status = sync_guardian_lock(root).unwrap();
        assert!(status.exists);
        assert!(status.valid);
        assert!(lock_path(root).exists());
    }

    #[test]
    fn status_detects_rules_hash_mismatch() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        seed_rules(root, "# policy v1");
        sync_guardian_lock(root).unwrap();

        seed_rules(root, "# policy v2");
        let status = status(root).unwrap();
        assert!(status.exists);
        assert!(!status.valid);
        assert!(status.message.contains("rules_hash mismatch"));
    }

    #[test]
    fn sync_repairs_outdated_lock() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        seed_rules(root, "# policy v1");
        sync_guardian_lock(root).unwrap();

        seed_rules(root, "# policy v2");
        let repaired = sync_guardian_lock(root).unwrap();
        assert!(repaired.valid);
    }
}
