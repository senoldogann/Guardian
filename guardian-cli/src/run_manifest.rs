use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestLimits {
    pub max_files: usize,
    pub max_file_bytes: u64,
    pub max_batch_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInventoryEntry {
    pub path_rel: String,
    pub reason: String,
    pub bytes: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunManifest {
    pub schema_version: u32,
    pub generated_at: String,
    pub guardian_version: String,
    pub root: String,
    pub workspace_id: String,
    pub rules_hash: String,
    pub scan_profile: String,
    pub limits: ManifestLimits,
    pub file_inventory: Vec<FileInventoryEntry>,
}

#[derive(Debug, Clone, Serialize)]
struct HashableManifest<'a> {
    schema_version: u32,
    guardian_version: &'a str,
    root: &'a str,
    workspace_id: &'a str,
    rules_hash: &'a str,
    scan_profile: &'a str,
    limits: &'a ManifestLimits,
    file_inventory: &'a [FileInventoryEntry],
}

impl RunManifest {
    pub fn new(
        root: String,
        workspace_id: String,
        rules_hash: String,
        scan_profile: String,
        limits: ManifestLimits,
        mut file_inventory: Vec<FileInventoryEntry>,
    ) -> Self {
        // Stable ordering for deterministic hashing.
        file_inventory.sort_by(|a, b| a.path_rel.cmp(&b.path_rel).then_with(|| a.reason.cmp(&b.reason)));

        Self {
            schema_version: 1,
            generated_at: Utc::now().to_rfc3339(),
            guardian_version: env!("CARGO_PKG_VERSION").to_string(),
            root,
            workspace_id,
            rules_hash,
            scan_profile,
            limits,
            file_inventory,
        }
    }

    /// Deterministic hash that excludes generated_at.
    pub fn stable_hash_hex(&self) -> String {
        let hashable = HashableManifest {
            schema_version: self.schema_version,
            guardian_version: &self.guardian_version,
            root: &self.root,
            workspace_id: &self.workspace_id,
            rules_hash: &self.rules_hash,
            scan_profile: &self.scan_profile,
            limits: &self.limits,
            file_inventory: &self.file_inventory,
        };
        let payload = serde_json::to_vec(&hashable).unwrap_or_default();
        let mut hasher = Sha256::new();
        hasher.update(&payload);
        hex::encode(hasher.finalize())
    }
}

