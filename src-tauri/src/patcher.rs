use std::fs;
use std::io::Write;
use std::path::Path;
use anyhow::{Context, Result};

/// Validates that the target path is within an allowed workspace directory.
/// Uses strict path canonicalization to prevent path traversal attacks.
fn validate_path_security(file_path: &str) -> Result<std::path::PathBuf> {
    let path = Path::new(file_path);

    // Canonicalize to resolve symlinks and normalize the path
    let canonical_path = fs::canonicalize(path)
        .with_context(|| format!("Security Violation: Could not resolve path {}", file_path))?;

    // Get canonicalized current working directory
    let current_dir = std::env::current_dir()
        .and_then(|d| fs::canonicalize(&d))
        .context("System Error: Cannot determine working directory")?;

    // Strict validation: Path must be within current directory
    if !canonical_path.starts_with(&current_dir) {
        anyhow::bail!("Security Violation: Target path is outside approved workspace.");
    }

    if !canonical_path.exists() {
        anyhow::bail!("Security Violation: Target file does not exist: {}", file_path);
    }

    Ok(canonical_path)
}

pub fn apply_patch(file_path: &str, new_content: &str) -> Result<String> {
    // 1. Security Validation (SPAP v2.2)
    let canonical_path = validate_path_security(file_path)?;

    if !canonical_path.exists() {
        anyhow::bail!("Security Violation: Target file does not exist: {}", file_path);
    }

    // 2. Atomic Write: Write to .tmp file then rename
    let path = Path::new(file_path);
    let tmp_path = path.with_extension("tmp");

    let mut file = fs::File::create(&tmp_path)
        .with_context(|| format!("Failed to create temp file: {:?}", tmp_path))?;

    file.write_all(new_content.as_bytes())
        .with_context(|| "Failed to write to temp file")?;

    fs::rename(&tmp_path, path)
        .with_context(|| format!("Failed to overwrite original file: {}", file_path))?;

    // 3. Cleanup temp file if it still exists (shouldn't happen after rename, but defensive)
    if tmp_path.exists() {
        let _ = fs::remove_file(&tmp_path);
    }

    eprintln!("[INFO] Autopilot: Successfully patched {}", file_path);
    Ok(format!("Patch applied successfully to {}", file_path))
}
