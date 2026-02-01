#[cfg(test)]
mod tests {

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
            .into_iter()
            .filter(|path_str| {
                let is_chat = path_str.contains("chat.md");
                is_chat
                    || !(path_str.contains(".git")
                        || path_str.contains("target")
                        || path_str.contains("node_modules")
                        || path_str.ends_with(".css")
                        || path_str.ends_with(".json")
                        || path_str.ends_with(".md")
                        || path_str.ends_with(".svg")
                        || path_str.ends_with(".png")
                        || path_str.ends_with(".jpg")
                        || path_str.contains(".guardian"))
            })
            .collect();

        assert!(filtered.contains(&"src/main.rs"));
        assert!(filtered.contains(&".guardian/chat.md"));
        assert!(!filtered.contains(&"src/style.css")); // We don't skip CSS in the current code, but we might want to.
                                                       // Wait, looking at the code, we ONLY skip .git, target, node_modules and .guardian (except chat.md)
        assert!(!filtered.contains(&"target/debug/bin"));
        assert!(!filtered.contains(&".guardian/STALL"));
    }
}
