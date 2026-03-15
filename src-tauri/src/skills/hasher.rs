use sha2::{Digest, Sha256};
use std::fs;
use std::io::{BufReader, Read};
use std::path::Path;
use walkdir::WalkDir;

pub fn calculate_file_hash(path: &str) -> String {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(_) => return String::new(),
    };

    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buf[..n]),
            Err(_) => return String::new(),
        }
    }

    hex::encode(hasher.finalize())
}

pub fn get_rules_fingerprint(workspace_root: &str) -> String {
    let rules_path = Path::new(workspace_root).join(".agent").join("rules");
    if !rules_path.exists() {
        return String::new();
    }
    let mut hasher = Sha256::new();

    let mut entries: Vec<(String, std::path::PathBuf)> = WalkDir::new(&rules_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && e.path().extension().is_some_and(|ext| ext == "md"))
        .filter_map(|e| {
            let rel = e.path().strip_prefix(&rules_path).ok()?;
            let rel = rel.to_string_lossy().replace('\\', "/");
            Some((rel, e.into_path()))
        })
        .collect();

    entries.sort_by(|a, b| a.0.cmp(&b.0));

    for (rel, path) in entries {
        if let Ok(content) = fs::read(&path) {
            hasher.update(rel.as_bytes());
            hasher.update(content);
        }
    }

    hex::encode(hasher.finalize())
}
