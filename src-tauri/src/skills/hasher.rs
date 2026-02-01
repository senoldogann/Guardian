use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

pub fn calculate_file_hash(path: &str) -> String {
    match fs::read(path) {
        Ok(content) => {
            let mut hasher = Sha256::new();
            hasher.update(content);
            hex::encode(hasher.finalize())
        }
        Err(_) => String::new(),
    }
}

pub fn get_rules_fingerprint(workspace_root: &str) -> String {
    let rules_path = Path::new(workspace_root).join(".agent/rules");
    let mut hasher = Sha256::new();

    // Sort files to ensure deterministic hash
    let mut entries: Vec<_> = WalkDir::new(rules_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().map_or(false, |ext| ext == "md")
        })
        .collect();

    entries.sort_by(|a, b| a.path().cmp(b.path()));

    for entry in entries {
        if let Ok(content) = fs::read(entry.path()) {
            hasher.update(entry.path().to_string_lossy().as_bytes());
            hasher.update(content);
        }
    }

    hex::encode(hasher.finalize())
}
