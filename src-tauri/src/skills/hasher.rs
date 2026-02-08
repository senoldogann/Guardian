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
    let rules_path = Path::new(workspace_root).join(".agent/rules");
    let mut hasher = Sha256::new();

    // Sort files to ensure deterministic hash
    let mut entries: Vec<_> = WalkDir::new(rules_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file() && e.path().extension().is_some_and(|ext| ext == "md"))
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
