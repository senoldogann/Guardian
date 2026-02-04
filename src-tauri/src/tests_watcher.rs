#[cfg(test)]
mod tests {
    use std::path::Path;
    use crate::watcher::should_skip_path;

    #[test]
    fn test_logic_filter_simulation() {
        let files = vec![
            "src/main.rs",
            "src/style.css",
            "package.json",
            ".guardian/chat.md",
            ".guardian/STALL",
            "target/debug/bin",
        ];

        let filtered: Vec<&str> = files
            .iter()
            .copied()
            .filter(|path_str| {
                let path = Path::new(path_str);
                let is_chat = path_str.contains("chat.md");
                !should_skip_path(path, is_chat)
            })
            .collect();

        assert!(filtered.contains(&"src/main.rs"));
        assert!(filtered.contains(&".guardian/chat.md"));
        assert!(!filtered.contains(&"src/style.css"));
        assert!(!filtered.contains(&"target/debug/bin"));
        assert!(!filtered.contains(&".guardian/STALL"));
    }
}
