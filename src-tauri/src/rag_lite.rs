use ignore::WalkBuilder;
use std::fs;

pub fn search_context(path: &str, query: &str) -> String {
    // 1. Keyword Search (Native Rust + WalkBuilder)
    // Replaced 'grep' command with native implementation for:
    // - Better Performance (No shell overhead)
    // - Cross-platform reliability
    // - Respecting .gitignore automatically

    let mut context_accumulator = String::new();
    context_accumulator.push_str(&format!("### Context for query: '{}'\n\n", query));

    let walker = WalkBuilder::new(path)
        .hidden(false)
        .git_ignore(true)
        .build();

    let mut matches_found = 0;

    for result in walker {
        if matches_found >= 5 {
            break;
        } // Limit to top 5 files

        if let Ok(entry) = result {
            if entry.file_type().map(|f| f.is_file()).unwrap_or(false) {
                let file_path = entry.path();

                // Skip binaries/large files optimization could go here.

                if let Ok(content) = fs::read_to_string(file_path) {
                    // Case-insensitive check (Basic)
                    if content.to_lowercase().contains(&query.to_lowercase()) {
                        let truncated: String =
                            content.lines().take(200).collect::<Vec<_>>().join("\n");

                        context_accumulator.push_str(&format!(
                            "#### File: {}\n```\n{}\n```\n\n",
                            file_path.display(),
                            truncated
                        ));
                        matches_found += 1;
                    }
                }
            }
        }
    }

    if matches_found == 0 {
        context_accumulator.push_str("No direct keyword matches found in codebase.\n");
    }

    // 2. Structure Injection (Project Map)
    // Add a summary of the file structure to help Guru understand the landscape.
    context_accumulator.push_str("\n### Project Structure (Top 2 Levels):\n");
    let walker = WalkBuilder::new(path)
        .max_depth(Some(2))
        .git_ignore(true)
        .build();

    for result in walker {
        if let Ok(entry) = result {
            let depth = entry.depth();
            let indent = "  ".repeat(depth);
            let name = entry.file_name().to_string_lossy();
            context_accumulator.push_str(&format!("{}{}\n", indent, name));
        }
    }

    context_accumulator
}
