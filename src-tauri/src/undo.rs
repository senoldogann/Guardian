use crate::patcher;
use anyhow::{Context, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixHistoryEntry {
    pub file_path: String,
    pub applied_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UndoIndexEntry {
    applied_at: String,
    backup_file: String,
    bytes: u64,
}

fn canonicalize_path(path: &Path) -> Result<PathBuf> {
    #[cfg(windows)]
    {
        dunce::canonicalize(path).with_context(|| {
            format!(
                "Security Violation: Could not canonicalize path {}",
                path.display()
            )
        })
    }

    #[cfg(not(windows))]
    {
        fs::canonicalize(path).with_context(|| {
            format!(
                "Security Violation: Could not canonicalize path {}",
                path.display()
            )
        })
    }
}

fn undo_dir(root: &str) -> PathBuf {
    Path::new(root).join(".guardian").join("undo")
}

fn undo_index_path(root: &str) -> PathBuf {
    undo_dir(root).join("index.json")
}

fn sha256_hex(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn normalize_rel_path(path: &Path, canonical_root: &Path) -> String {
    path.strip_prefix(canonical_root)
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/"))
}

fn looks_like_chat_or_tool_transcript(content: &str) -> bool {
    let window = &content[..content.len().min(4096)];
    let lower = window.to_lowercase();

    // Strong markers — any single one is enough to reject
    let strong_markers = ["<invoke", "tool_call", "<minimax:", "minimax:tool_call"];

    if strong_markers.iter().any(|m| lower.contains(m)) {
        return true;
    }

    // Weak markers — need at least 2 to reject (individually they appear in legitimate code)
    let weak_markers = [
        "```",
        "<function",
        "</function",
        "<assistant",
        "</assistant",
    ];

    let weak_count = weak_markers.iter().filter(|m| lower.contains(**m)).count();
    weak_count >= 2
}

fn read_undo_index(root: &str) -> Result<HashMap<String, UndoIndexEntry>> {
    let path = undo_index_path(root);
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let raw = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read undo index: {:?}", path))?;
    let parsed = serde_json::from_str::<HashMap<String, UndoIndexEntry>>(&raw).unwrap_or_default();
    Ok(parsed)
}

fn write_atomic_bytes(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| format!("Failed to create dir {:?}", parent))?;
    }

    let tmp_path = path.with_extension("tmp");
    if tmp_path.exists() {
        let _ = fs::remove_file(&tmp_path);
    }

    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp_path)
        .with_context(|| format!("Failed to create temp file {:?}", tmp_path))?;

    file.write_all(bytes)
        .with_context(|| format!("Failed to write temp file {:?}", tmp_path))?;

    // On Windows, renaming over an existing file can fail.
    if path.exists() {
        let _ = fs::remove_file(path);
    }

    fs::rename(&tmp_path, path).with_context(|| format!("Failed to finalize write {:?}", path))?;
    Ok(())
}

fn write_undo_index(root: &str, index: &HashMap<String, UndoIndexEntry>) -> Result<()> {
    let path = undo_index_path(root);
    let payload = serde_json::to_vec_pretty(index).context("Failed to serialize undo index")?;
    write_atomic_bytes(&path, &payload)
}

pub fn apply_fix_now(root: &str, file_path: &str, new_content: &str) -> Result<()> {
    let root_path = Path::new(root);
    if !root_path.exists() || !root_path.is_dir() {
        anyhow::bail!("Workspace root not accessible: {}", root);
    }

    if looks_like_chat_or_tool_transcript(new_content) {
        anyhow::bail!(
            "Patch rejected: expected FULL file content only. The payload looks like a chat/tool transcript (tool calls/markdown fences). Ask Guru for FULL file content only (no diff markers, no markdown, no tool calls)."
        );
    }

    let canonical_root = canonicalize_path(root_path)?;
    let canonical_target = patcher::validate_path_security(file_path, root)?;
    let rel_path = normalize_rel_path(&canonical_target, &canonical_root);

    let undo_dir = undo_dir(root);
    fs::create_dir_all(&undo_dir)
        .with_context(|| format!("Failed to create undo dir {:?}", undo_dir))?;

    let backup_name = format!("{}.bak", sha256_hex(&rel_path));
    let backup_path = undo_dir.join(&backup_name);

    let original_bytes = fs::read(&canonical_target)
        .with_context(|| format!("Failed to read target file {:?}", canonical_target))?;

    write_atomic_bytes(&backup_path, &original_bytes)?;

    let patch_res = patcher::apply_patch(
        canonical_target
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid target path"))?,
        new_content,
        canonical_root
            .to_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid workspace root"))?,
    );
    if let Err(err) = patch_res {
        // If the patch was rejected/failed, do not keep an undo entry.
        let _ = fs::remove_file(&backup_path);
        return Err(err);
    }

    let mut index = read_undo_index(root)?;
    index.insert(
        rel_path,
        UndoIndexEntry {
            applied_at: Utc::now().to_rfc3339(),
            backup_file: backup_name,
            bytes: new_content.len() as u64,
        },
    );
    write_undo_index(root, &index)?;

    Ok(())
}

pub fn undo_fix(root: &str, file_path: &str) -> Result<()> {
    let root_path = Path::new(root);
    if !root_path.exists() || !root_path.is_dir() {
        anyhow::bail!("Workspace root not accessible: {}", root);
    }

    let canonical_root = canonicalize_path(root_path)?;
    let canonical_target = patcher::validate_path_security(file_path, root)?;
    let rel_path = normalize_rel_path(&canonical_target, &canonical_root);

    let mut index = read_undo_index(root)?;
    let entry = index
        .get(&rel_path)
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("No undo available for {}", rel_path))?;

    let backup_path = undo_dir(root).join(&entry.backup_file);
    if !backup_path.exists() {
        anyhow::bail!("Undo backup missing for {}", rel_path);
    }

    let bytes = fs::read(&backup_path)
        .with_context(|| format!("Failed to read backup {:?}", backup_path))?;
    write_atomic_bytes(&canonical_target, &bytes)?;

    let _ = fs::remove_file(&backup_path);
    index.remove(&rel_path);
    write_undo_index(root, &index)?;
    Ok(())
}

pub fn list_fix_history(root: &str) -> Result<Vec<FixHistoryEntry>> {
    let index = read_undo_index(root)?;
    let mut out = index
        .into_iter()
        .map(|(file_path, entry)| FixHistoryEntry {
            file_path,
            applied_at: entry.applied_at,
        })
        .collect::<Vec<_>>();
    out.sort_by(|a, b| b.applied_at.cmp(&a.applied_at));
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_file(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn apply_creates_backup_and_undo_restores() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let file_path = root.join("src").join("main.ts");
        write_file(&file_path, "original\n");

        apply_fix_now(
            root.to_str().unwrap(),
            file_path.to_str().unwrap(),
            "patched\n",
        )
        .unwrap();

        let after = fs::read_to_string(&file_path).unwrap();
        assert_eq!(after, "patched\n");

        let history = list_fix_history(root.to_str().unwrap()).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].file_path, "src/main.ts");

        undo_fix(root.to_str().unwrap(), file_path.to_str().unwrap()).unwrap();
        let restored = fs::read_to_string(&file_path).unwrap();
        assert_eq!(restored, "original\n");

        let history = list_fix_history(root.to_str().unwrap()).unwrap();
        assert!(history.is_empty());
    }

    #[test]
    fn per_file_last_overwrites_previous_backup() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let file_path = root.join("src").join("main.ts");
        write_file(&file_path, "v0\n");

        apply_fix_now(root.to_str().unwrap(), file_path.to_str().unwrap(), "v1\n").unwrap();
        apply_fix_now(root.to_str().unwrap(), file_path.to_str().unwrap(), "v2\n").unwrap();

        undo_fix(root.to_str().unwrap(), file_path.to_str().unwrap()).unwrap();
        let restored = fs::read_to_string(&file_path).unwrap();
        assert_eq!(restored, "v1\n");
    }

    #[test]
    fn rejects_tool_call_payloads() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let file_path = root.join("src").join("main.ts");
        write_file(&file_path, "original\n");

        let err = apply_fix_now(
            root.to_str().unwrap(),
            file_path.to_str().unwrap(),
            "<minimax:tool_call>\n<invoke name=\"x\"></invoke>\n",
        )
        .unwrap_err();
        assert!(
            err.to_string().contains("Patch rejected"),
            "Expected tool-call payload rejection"
        );

        let after = fs::read_to_string(&file_path).unwrap();
        assert_eq!(after, "original\n");
    }

    #[test]
    fn diff_payload_does_not_leave_undo_entry() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let file_path = root.join("src").join("main.ts");
        write_file(&file_path, "original\n");

        let diff_payload = "diff --git a/file b/file\n@@ -1 +1 @@\n-Old\n+New\n";
        assert!(apply_fix_now(
            root.to_str().unwrap(),
            file_path.to_str().unwrap(),
            diff_payload,
        )
        .is_err());

        let history = list_fix_history(root.to_str().unwrap()).unwrap();
        assert!(history.is_empty());
    }
}
