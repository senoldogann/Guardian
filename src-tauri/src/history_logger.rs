use crate::ai_client::Critique;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::Path;

pub fn append_history_log(root: &str, critique: &Critique) {
    let history_path = Path::new(root).join(".guardian").join("history.jsonl");

    // Add timestamp field to the JSON object manually or rely on the struct if it had one.
    // Since Critique doesn't have a timestamp, we wrap it.
    let log_entry = serde_json::json!({
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "critique": critique
    });

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(history_path)
    {
        let _ = writeln!(file, "{log_entry}");
    }
}
