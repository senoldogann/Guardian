use std::fs;
use std::io::Write;
use std::path::Path;
use anyhow::{Context, Result};

/// Validates that the target path is within an allowed workspace directory.
/// Uses strict path canonicalization to prevent path traversal attacks.
fn validate_path_security(file_path: &str, workspace_root: &str) -> Result<std::path::PathBuf> {
    let path = Path::new(file_path);
    let root = Path::new(workspace_root);

    // Canonicalize to resolve symlinks and normalize the path
    let canonical_path = fs::canonicalize(path)
        .with_context(|| format!("Security Violation: Could not resolve path {}", file_path))?;

    let canonical_root = fs::canonicalize(root)
        .with_context(|| format!("Security Violation: Could not resolve workspace root {}", workspace_root))?;

    // Strict validation: Path must be within workspace root
    if !canonical_path.starts_with(&canonical_root) {
        anyhow::bail!("Security Violation: Target path is outside approved workspace.");
    }

    if !canonical_path.exists() {
        anyhow::bail!("Security Violation: Target file does not exist: {}", file_path);
    }

    Ok(canonical_path)
}

fn looks_like_diff(content: &str) -> bool {
    let mut has_old = false;
    let mut has_new = false;

    for line in content.lines().take(200) {
        let trimmed = line.trim_start();
        if trimmed.starts_with("diff --git") || trimmed.starts_with("@@") || trimmed.starts_with("*** Begin Patch") {
            return true;
        }
        if trimmed.starts_with("--- ") {
            has_old = true;
        }
        if trimmed.starts_with("+++ ") {
            has_new = true;
        }
    }

    has_old && has_new
}

pub fn apply_patch(file_path: &str, new_content: &str, workspace_root: &str) -> Result<String> {
    // 1. Security Validation (SPAP v2.2)
    let canonical_path = validate_path_security(file_path, workspace_root)?;

    if looks_like_diff(new_content) {
        anyhow::bail!("Patch rejected: expected full file content, received a diff. Ask Guru for full file content only.");
    }

    // 2. Atomic Write: Write to .tmp file then rename
    let tmp_path = canonical_path.with_extension("tmp");

    let mut file = fs::File::create(&tmp_path)
        .with_context(|| format!("Failed to create temp file: {:?}", tmp_path))?;

    file.write_all(new_content.as_bytes())
        .with_context(|| "Failed to write to temp file")?;

    fs::rename(&tmp_path, &canonical_path)
        .with_context(|| format!("Failed to overwrite original file: {}", file_path))?;

    // 3. Cleanup temp file if it still exists (shouldn't happen after rename, but defensive)
    if tmp_path.exists() {
        let _ = fs::remove_file(&tmp_path);
    }

    eprintln!("[INFO] Autopilot: Successfully patched {}", file_path);
    Ok(format!("Patch applied successfully to {}", file_path))
}
