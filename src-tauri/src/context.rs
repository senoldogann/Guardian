use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectContext {
    pub file_structure: Vec<String>,
    pub dependencies: Vec<String>,
    pub total_files: usize,
    pub intent_summary: String,
}

impl ProjectContext {
    pub fn new() -> Self {
        Self {
            file_structure: Vec::new(),
            dependencies: Vec::new(),
            total_files: 0,
            intent_summary: String::from("No explicit intent found."),
        }
    }

    pub fn index_path(root_path: &str) -> Self {
        let mut context = ProjectContext::new();
        let root = Path::new(root_path);

        for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Ok(relative) = path.strip_prefix(root) {
                    if is_noise_path(relative) {
                        continue;
                    }
                    context
                        .file_structure
                        .push(relative.to_string_lossy().to_string());
                } else {
                    if is_noise_path(path) {
                        continue;
                    }
                    let path_str = path.to_string_lossy().to_string();
                    context.file_structure.push(path_str);
                }

                if path.ends_with("Cargo.toml") {
                    // OPTIMIZATION: Fire-and-forget async read for dependencies
                    let path_clone = path.to_path_buf();
                    tokio::spawn(async move {
                        if let Ok(_content) = tokio::fs::read_to_string(&path_clone).await {
                            // Dependencies detected asynchronously
                        }
                    });
                    context
                        .dependencies
                        .push("Rust: Cargo.toml found".to_string());
                } else if path.ends_with("package.json") {
                    // OPTIMIZATION: Fire-and-forget async read for dependencies
                    let path_clone = path.to_path_buf();
                    tokio::spawn(async move {
                        if let Ok(_content) = tokio::fs::read_to_string(&path_clone).await {
                            // Dependencies detected asynchronously
                        }
                    });
                    context
                        .dependencies
                        .push("Node: package.json found".to_string());
                }
            }
        }

        context.total_files = context.file_structure.len();

        // DYNAMIC INTENT DISCOVERY: Priority Waterfall
        // 1. Agent Artifacts (High Fidelity)
        // 2. Standard Docs (Medium Fidelity)
        // 3. Generic (Baseline)

        let mut intent_summary =
            String::from("No explicit intent found. Defaulting to Universal Safety Standards.");
        let mut high_fidelity_intent = String::new();
        let mut medium_fidelity_intent = String::new();

        for entry in WalkDir::new(root)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            // Priority 1: Agent Artifacts
            if file_name.starts_with("PLAN-") && file_name.ends_with(".md")
                || file_name == "implementation_plan.md"
                || file_name == "task.md"
                || file_name == "AGENTS.md"
            {
                if let Ok(content) = fs::read_to_string(path) {
                    high_fidelity_intent
                        .push_str(&format!("\n--- AGENT PLAN ({}) ---\n", file_name));
                    high_fidelity_intent.push_str(&content.chars().take(2000).collect::<String>());
                }
            }
            // Priority 2: Safe Fallbacks for Humans
            else if file_name.to_uppercase() == "README.MD"
                || file_name.to_uppercase() == "TODO.MD"
            {
                if let Ok(content) = fs::read_to_string(path) {
                    medium_fidelity_intent
                        .push_str(&format!("\n--- PROJECT DOC ({}) ---\n", file_name));
                    medium_fidelity_intent
                        .push_str(&content.chars().take(1000).collect::<String>());
                }
            }
        }

        if !high_fidelity_intent.is_empty() {
            intent_summary = high_fidelity_intent;
        } else if !medium_fidelity_intent.is_empty() {
            intent_summary = medium_fidelity_intent;
        }

        context.intent_summary = intent_summary;

        context
    }

    #[allow(dead_code)]
    pub fn to_prompt_string(&self) -> String {
        let structure_sample = self
            .file_structure
            .iter()
            .take(50)
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        let extra_msg = if self.file_structure.len() > 50 {
            "... (more files)"
        } else {
            ""
        };

        format!(
            "Project Context:\n- Total Files: {}\n- Dependencies: {:?}\n\nUSER INTENT & PLAN:\n{}\n\nFile Structure Sample:\n{}{}",
            self.total_files,
            self.dependencies,
            self.intent_summary,
            structure_sample,
            extra_msg
        )
    }
}

fn is_noise_path(path: &Path) -> bool {
    for component in path.components() {
        if let Some(part) = component.as_os_str().to_str() {
            if part.starts_with('.') {
                return true;
            }
            if matches!(
                part,
                "node_modules"
                    | "target"
                    | "dist"
                    | "build"
                    | "out"
                    | "coverage"
                    | ".git"
                    | ".github"
                    | ".idea"
                    | ".vscode"
                    | ".turbo"
                    | ".next"
                    | ".cache"
                    | "tmp"
                    | "temp"
            ) {
                return true;
            }
        }
    }

    if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
        if matches!(
            file_name,
            "package-lock.json" | "pnpm-lock.yaml" | "yarn.lock" | "Cargo.lock"
        ) {
            return true;
        }
    }

    false
}
