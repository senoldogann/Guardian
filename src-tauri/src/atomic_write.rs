//! Atomic file write helper.
//!
//! Writes data to a temporary file in the same directory and then atomically
//! renames it to the target path. This prevents partially-written or
//! corrupted files when the process crashes mid-write.

use std::fs;
use std::io::Write;
use std::path::Path;

/// Atomically write `data` to `path`.
///
/// Creates a sibling `.tmp` file, writes the full payload, flushes to disk,
/// then renames over the target. If any step fails the original file is
/// left intact.
pub fn atomic_write(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");

    let mut file = fs::File::create(&tmp)?;
    file.write_all(data)?;
    file.flush()?;

    // sync_data ensures the bytes actually reach disk before the rename.
    file.sync_data()?;

    fs::rename(&tmp, path)?;
    Ok(())
}

/// Convenience wrapper: serialize `data` as pretty JSON and write atomically.
pub fn atomic_write_json<T: serde::Serialize>(path: &Path, data: &T) -> anyhow::Result<()> {
    let encoded = serde_json::to_string_pretty(data)?;
    atomic_write(path, encoded.as_bytes())
        .map_err(|e| anyhow::anyhow!("atomic write to {}: {}", path.display(), e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_atomic_write_creates_file() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("test.json");
        atomic_write(&target, b"hello world").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "hello world");
        // tmp should be cleaned up (renamed)
        assert!(!dir.path().join("test.tmp").exists());
    }

    #[test]
    fn test_atomic_write_overwrites_existing() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("data.txt");
        fs::write(&target, "old").unwrap();
        atomic_write(&target, b"new").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "new");
    }

    #[test]
    fn test_atomic_write_json_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("config.json");
        let data = serde_json::json!({"key": "value", "n": 42});
        atomic_write_json(&target, &data).unwrap();
        let read: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&target).unwrap()).unwrap();
        assert_eq!(read, data);
    }

    #[test]
    fn test_atomic_write_invalid_dir_fails() {
        let target = PathBuf::from("/nonexistent_dir_xyz/test.json");
        assert!(atomic_write(&target, b"data").is_err());
    }
}
