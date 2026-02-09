use crate::ai_client::Critique;
use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use std::fs;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const MAX_HISTORY_BYTES: u64 = 10 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct HistoryEvent {
    pub timestamp: String,
    pub event: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finding_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redacted: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tokens_in: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tokens_out: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

pub fn append_history_event(root: &str, event: HistoryEvent) {
    let history_path = history_path(root);
    let guardian_dir = history_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));

    if !guardian_dir.exists() {
        let _ = fs::create_dir_all(&guardian_dir);
    }

    migrate_v0_if_needed(&history_path);
    rotate_if_needed(&history_path);

    let payload = serde_json::to_string(&event).unwrap_or_else(|_| "{}".to_string());
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&history_path)
    {
        let _ = writeln!(file, "{}", payload);
    }
}

pub fn append_critique_event(root: &str, critique: &Critique) {
    let root_path = Path::new(root);
    let file_path = normalize_rel_file_path(root_path, &critique.file_path);

    append_history_event(
        root,
        HistoryEvent {
            timestamp: Utc::now().to_rfc3339(),
            event: "scan".to_string(),
            finding_id: critique.finding_id.clone(),
            file_path: Some(file_path),
            model: None,
            provider: None,
            redacted: None,
            tokens_in: None,
            tokens_out: None,
            details: Some(json!({
                "severity": critique.severity,
            })),
        },
    );
}

fn history_path(root: &str) -> PathBuf {
    Path::new(root).join(".guardian").join("history.jsonl")
}

fn rotate_if_needed(history_path: &Path) {
    let Ok(meta) = fs::metadata(history_path) else {
        return;
    };
    if meta.len() < MAX_HISTORY_BYTES {
        return;
    }

    let Some(parent) = history_path.parent() else {
        return;
    };

    let stamp = Utc::now().format("%Y%m%dT%H%M%SZ");
    let archive = parent.join(format!("history.{}.jsonl", stamp));
    let _ = fs::rename(history_path, archive);
}

fn migrate_v0_if_needed(history_path: &Path) {
    if !history_path.exists() {
        return;
    }

    let Ok(mut file) = fs::File::open(history_path) else {
        return;
    };
    let mut buf = vec![0u8; 2048];
    let Ok(n) = file.read(&mut buf) else {
        return;
    };
    let sample = String::from_utf8_lossy(&buf[..n]);

    if !sample.contains("\"critique\"") {
        return;
    }

    let Some(parent) = history_path.parent() else {
        return;
    };
    let candidate = parent.join("history.v0.jsonl");
    if !candidate.exists() {
        let _ = fs::rename(history_path, candidate);
        return;
    }

    let stamp = Utc::now().format("%Y%m%dT%H%M%SZ");
    let fallback = parent.join(format!("history.v0.{}.jsonl", stamp));
    let _ = fs::rename(history_path, fallback);
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

    let canonical_root =
        dunce::canonicalize(workspace_root).unwrap_or_else(|_| workspace_root.to_path_buf());
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

