use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub fn get_rules_fingerprint(workspace_root: &Path) -> String {
    let rules_dir = workspace_root.join(".agent").join("rules");
    if !rules_dir.exists() {
        return String::new();
    }

    let walker = ignore::WalkBuilder::new(&rules_dir)
        .hidden(false)
        .git_ignore(false)
        .build();

    let mut entries: Vec<PathBuf> = Vec::new();
    for result in walker {
        let Ok(entry) = result else {
            continue;
        };
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "md") {
            entries.push(path.to_path_buf());
        }
    }

    entries.sort();

    let mut hasher = Sha256::new();
    for path in entries {
        if let Ok(content) = fs::read(&path) {
            let rel = path.strip_prefix(&rules_dir).unwrap_or(&path);
            hasher.update(rel.to_string_lossy().as_bytes());
            hasher.update(content);
        }
    }

    hex::encode(hasher.finalize())
}

