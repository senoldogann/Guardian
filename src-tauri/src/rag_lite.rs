use ignore::WalkBuilder;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

const FILE_TOKEN_EXTENSIONS: &[&str] = &[
    ".rs", ".tsx", ".ts", ".js", ".jsx", ".py", ".sh", ".md", ".json", ".toml",
    ".yml", ".yaml", ".go", ".txt", ".css", ".html", ".sql"
];
const ENV_QUERY_KEYWORDS: &[&str] = &[
    ".env", "dotenv", "environment", "env", "secret", "secrets", "apikey", "api key"
];

fn is_file_token(token: &str) -> bool {
    let lower = token.to_lowercase();
    FILE_TOKEN_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

fn clean_token(token: &str) -> String {
    token
        .trim_matches(|c: char| {
            !(c.is_alphanumeric() || c == '.' || c == '_' || c == '-' || c == '/' || c == '\\')
        })
        .to_string()
}

fn extract_file_tokens(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    for raw in query.split_whitespace() {
        let token = clean_token(raw);
        if token.is_empty() {
            continue;
        }
        if is_file_token(&token) {
            tokens.push(token);
        }
    }
    tokens
}

fn resolve_explicit_files(root: &str, tokens: &[String]) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for token in tokens {
        if results.len() >= 3 {
            break;
        }

        let candidate = Path::new(token);
        let candidate_path = if candidate.is_absolute() {
            candidate.to_path_buf()
        } else {
            Path::new(root).join(candidate)
        };

        if candidate_path.exists() && candidate_path.is_file() {
            let key = candidate_path.to_string_lossy().to_string();
            if seen.insert(key) {
                results.push(candidate_path);
            }
            continue;
        }

        let file_name = candidate.file_name().and_then(|s| s.to_str());
        if let Some(file_name) = file_name {
            let walker = WalkBuilder::new(root)
                .hidden(false)
                .git_ignore(true)
                .build();

            for result in walker {
                if results.len() >= 3 {
                    break;
                }
                if let Ok(entry) = result {
                    if entry.file_type().map(|f| f.is_file()).unwrap_or(false) {
                        if entry.file_name().to_string_lossy() == file_name {
                            let path = entry.path().to_path_buf();
                            let key = path.to_string_lossy().to_string();
                            if seen.insert(key) {
                                results.push(path);
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    results
}

fn resolve_special_context_files(root: &str, query: &str) -> Vec<PathBuf> {
    let mut results = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let query_lower = query.to_lowercase();

    if ENV_QUERY_KEYWORDS.iter().any(|k| query_lower.contains(k)) {
        for name in [".env.example", ".gitignore"] {
            let path = Path::new(root).join(name);
            if path.exists() && path.is_file() {
                let key = path.to_string_lossy().to_string();
                if seen.insert(key) {
                    results.push(path);
                }
            }
        }
    }

    results
}

fn append_special_notes(context: &mut String, root: &str, query: &str) {
    let query_lower = query.to_lowercase();
    if ENV_QUERY_KEYWORDS.iter().any(|k| query_lower.contains(k)) {
        let env_example = Path::new(root).join(".env.example");
        if !env_example.exists() {
            context.push_str("Note: .env.example not found in this workspace root.\n\n");
        }
    }
}

fn append_workspace_snapshot(context: &mut String, root: &str) {
    let mut dirs: Vec<String> = Vec::new();
    let mut files: Vec<String> = Vec::new();

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            if path.is_dir() {
                dirs.push(name);
            } else {
                files.push(name);
            }
        }
    }

    dirs.sort();
    files.sort();

    context.push_str("### Workspace Snapshot:\n");
    if !dirs.is_empty() {
        let listing = dirs.iter().take(20).cloned().collect::<Vec<_>>().join(", ");
        context.push_str(&format!("- Directories ({}): {}\n", dirs.len(), listing));
    }
    if !files.is_empty() {
        let listing = files.iter().take(20).cloned().collect::<Vec<_>>().join(", ");
        context.push_str(&format!("- Files ({}): {}\n", files.len(), listing));
    }
    context.push('\n');
}

fn append_package_json_summary(context: &mut String, root: &str) {
    let pkg_path = Path::new(root).join("package.json");
    if !pkg_path.exists() {
        return;
    }
    let Ok(content) = fs::read_to_string(&pkg_path) else { return; };
    let Ok(parsed) = serde_json::from_str::<Value>(&content) else { return; };

    context.push_str("### package.json Summary:\n");
    if let Some(name) = parsed.get("name").and_then(|v| v.as_str()) {
        context.push_str(&format!("- name: {}\n", name));
    }
    if let Some(version) = parsed.get("version").and_then(|v| v.as_str()) {
        context.push_str(&format!("- version: {}\n", version));
    }
    if let Some(scripts) = parsed.get("scripts").and_then(|v| v.as_object()) {
        let mut keys: Vec<String> = scripts.keys().cloned().collect();
        keys.sort();
        let listing = keys.iter().take(12).cloned().collect::<Vec<_>>().join(", ");
        if !listing.is_empty() {
            context.push_str(&format!("- scripts: {}\n", listing));
        }
    }
    if let Some(deps) = parsed.get("dependencies").and_then(|v| v.as_object()) {
        let mut keys: Vec<String> = deps.keys().cloned().collect();
        keys.sort();
        let listing = keys.iter().take(12).cloned().collect::<Vec<_>>().join(", ");
        if !listing.is_empty() {
            context.push_str(&format!("- dependencies: {}\n", listing));
        }
    }
    if let Some(deps) = parsed.get("devDependencies").and_then(|v| v.as_object()) {
        let mut keys: Vec<String> = deps.keys().cloned().collect();
        keys.sort();
        let listing = keys.iter().take(12).cloned().collect::<Vec<_>>().join(", ");
        if !listing.is_empty() {
            context.push_str(&format!("- devDependencies: {}\n", listing));
        }
    }
    context.push('\n');
}

fn append_routes_summary(context: &mut String, root: &str) {
    let routes_dir = Path::new(root).join("src").join("routes");
    if !routes_dir.exists() || !routes_dir.is_dir() {
        return;
    }

    let mut routes: Vec<String> = Vec::new();
    if let Ok(entries) = fs::read_dir(&routes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    routes.push(name.to_string());
                }
            }
        }
    }
    routes.sort();
    if !routes.is_empty() {
        context.push_str("### Routes Folder:\n");
        context.push_str(&format!("- src/routes files: {}\n\n", routes.join(", ")));
    }
}

pub fn search_context(path: &str, query: &str) -> String {
    // 1. Keyword Search (Native Rust + WalkBuilder)
    // Replaced 'grep' command with native implementation for:
    // - Better Performance (No shell overhead)
    // - Cross-platform reliability
    // - Respecting .gitignore automatically

    let mut context_accumulator = String::new();
    context_accumulator.push_str(&format!("### Workspace Root: {}\n", path));
    context_accumulator.push_str(&format!("### Context for query: '{}'\n\n", query));
    append_workspace_snapshot(&mut context_accumulator, path);
    append_package_json_summary(&mut context_accumulator, path);
    append_routes_summary(&mut context_accumulator, path);

    let mut explicit_files = resolve_explicit_files(path, &extract_file_tokens(query));
    explicit_files.extend(resolve_special_context_files(path, query));
    if !explicit_files.is_empty() {
        context_accumulator.push_str("### Explicit File Context:\n\n");
        for file_path in explicit_files {
            if let Ok(content) = fs::read_to_string(&file_path) {
                let truncated: String = content.lines().take(240).collect::<Vec<_>>().join("\n");
                context_accumulator.push_str(&format!(
                    "#### File: {}\n```\n{}\n```\n\n",
                    file_path.display(),
                    truncated
                ));
            }
        }
    }

    append_special_notes(&mut context_accumulator, path, query);

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
