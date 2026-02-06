use anyhow::{Context, Result};
use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use tracing::info;

/// Validates that the target path is within an allowed workspace directory.
/// Uses strict path canonicalization and symlink checks to prevent traversal.
fn validate_path_security(file_path: &str, workspace_root: &str) -> Result<PathBuf> {
    let root = Path::new(workspace_root);
    let canonical_root = fs::canonicalize(root).with_context(|| {
        format!(
            "Security Violation: Could not resolve workspace root {}",
            workspace_root
        )
    })?;

    let input_path = Path::new(file_path);
    if input_path
        .components()
        .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
    {
        anyhow::bail!("Security Violation: Path contains traversal components.");
    }

    let candidate = if input_path.is_absolute() {
        input_path.to_path_buf()
    } else {
        canonical_root.join(input_path)
    };

    if !candidate.exists() {
        anyhow::bail!(
            "Security Violation: Target file does not exist: {}",
            file_path
        );
    }

    #[cfg(unix)]
    ensure_no_symlink_components(&candidate, &canonical_root)?;

    let canonical_path = fs::canonicalize(&candidate)
        .with_context(|| format!("Security Violation: Could not resolve path {}", file_path))?;

    if !canonical_path.starts_with(&canonical_root) {
        anyhow::bail!("Security Violation: Target path is outside approved workspace.");
    }

    Ok(canonical_path)
}

fn ensure_no_symlink_components(candidate: &Path, canonical_root: &Path) -> Result<()> {
    let rel = candidate
        .strip_prefix(canonical_root)
        .with_context(|| "Security Violation: Path is not within workspace root")?;

    let mut current = canonical_root.to_path_buf();
    for component in rel.components() {
        match component {
            Component::CurDir | Component::ParentDir => {
                anyhow::bail!("Security Violation: Path contains traversal components.");
            }
            Component::Normal(part) => {
                current.push(part);
            }
            _ => {}
        }

        let meta = fs::symlink_metadata(&current)
            .with_context(|| format!("Security Violation: Could not read metadata for {:?}", current))?;
        if meta.file_type().is_symlink() {
            anyhow::bail!("Security Violation: Symlink detected in path.");
        }
    }

    Ok(())
}

fn looks_like_diff(content: &str) -> bool {
    let mut has_old = false;
    let mut has_new = false;

    for line in content.lines().take(200) {
        let trimmed = line.trim_start();
        if trimmed.starts_with("diff --git")
            || trimmed.starts_with("@@")
            || trimmed.starts_with("*** Begin Patch")
        {
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

    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&tmp_path)
        .with_context(|| format!("Failed to create temp file: {:?}", tmp_path))?;

    file.write_all(new_content.as_bytes())
        .with_context(|| "Failed to write to temp file")?;

    fs::rename(&tmp_path, &canonical_path)
        .with_context(|| format!("Failed to overwrite original file: {}", file_path))?;

    // 3. Cleanup temp file if it still exists (shouldn't happen after rename, but defensive)
    if tmp_path.exists() {
        let _ = fs::remove_file(&tmp_path);
    }

    info!(target: "guardian::patcher", "Successfully patched: {}", file_path);
    Ok(format!("Patch applied successfully to {}", file_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn rejects_diff_payloads() {
        let root = std::env::current_dir().unwrap();
        let temp_dir = root.join("target").join("test_temp");
        let _ = std::fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("patcher_diff_test.txt");
        let mut file = std::fs::File::create(&file_path).unwrap();
        writeln!(file, "Original").unwrap();

        let diff_payload = "diff --git a/file b/file\n@@ -1 +1 @@\n-Old\n+New\n";
        let res = apply_patch(
            file_path.to_str().unwrap(),
            diff_payload,
            root.to_str().unwrap(),
        );

        assert!(res.is_err(), "Diff payloads must be rejected");
    }

    #[test]
    fn rejects_path_traversal_components() {
        let root = std::env::current_dir().unwrap();
        let temp_dir = root.join("target").join("test_temp");
        let _ = std::fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("patcher_traversal_test.txt");
        let mut file = std::fs::File::create(&file_path).unwrap();
        writeln!(file, "Original").unwrap();

        let traversal_path = temp_dir.join("..").join("test_temp").join("patcher_traversal_test.txt");
        let res = apply_patch(
            traversal_path.to_str().unwrap(),
            "Patched",
            root.to_str().unwrap(),
        );

        assert!(res.is_err(), "Traversal components must be rejected");
    }
}
