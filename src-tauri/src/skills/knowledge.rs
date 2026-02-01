use ignore::WalkBuilder;
use std::fs;
use std::path::Path;

pub struct KnowledgeBase;

impl KnowledgeBase {
    /// Finds the project root by walking up looking for `.agent`
    pub fn find_project_root(start_path: &str) -> String {
        let mut current = Path::new(start_path);
        if current.is_file() {
            current = current.parent().unwrap_or(current);
        }

        loop {
            let agent_dir = current.join(".agent");
            if agent_dir.exists() && agent_dir.is_dir() {
                return current.to_string_lossy().to_string();
            }

            match current.parent() {
                Some(parent) => current = parent,
                None => break,
            }
        }

        // Fallback to start path if not found, hoping it's the root
        Path::new(start_path)
            .parent()
            .unwrap_or(Path::new("."))
            .to_string_lossy()
            .to_string()
    }

    /// Loads all active rules from `.agent/rules/`
    pub fn load_system_rules(start_path: &str) -> String {
        let root = Self::find_project_root(start_path);
        let rules_dir = Path::new(&root).join(".agent/rules");
        let mut combined_rules = String::new();

        if !rules_dir.exists() {
            return format!("No system rules found in {}/.agent/rules", root);
        }

        let walker = WalkBuilder::new(rules_dir)
            .hidden(false)
            .git_ignore(false) // We want to read these even if ignored by git (though likely tracked)
            .max_depth(Some(1))
            .build();

        for result in walker {
            if let Ok(entry) = result {
                if entry.file_type().map(|f| f.is_file()).unwrap_or(false) {
                    if let Some(ext) = entry.path().extension() {
                        if ext == "md" {
                            if let Ok(content) = fs::read_to_string(entry.path()) {
                                let filename = entry.file_name().to_string_lossy();
                                combined_rules.push_str(&format!(
                                    "\n--- RULE: {} ---\n{}\n",
                                    filename, content
                                ));
                            }
                        }
                    }
                }
            }
        }

        if combined_rules.is_empty() {
            "Default Safety Rules Active.".to_string()
        } else {
            combined_rules
        }
    }

    /// Loads a specific agent persona from `.agent/agents/` based on file type
    pub fn get_specialist_persona(start_path: &str, target_file: &str) -> String {
        let root = Self::find_project_root(start_path);

        // Simple heuristic mapping
        let agent_name = if target_file.ends_with(".rs") || target_file.ends_with(".toml") {
            "backend-specialist.md"
        } else if target_file.ends_with(".tsx")
            || target_file.ends_with(".css")
            || target_file.ends_with(".ts")
        {
            "frontend-specialist.md"
        } else {
            "clean-code.md" // Fallback to a generic skill or agent if available
        };

        let agent_path = Path::new(&root).join(".agent/agents").join(agent_name);

        if agent_path.exists() {
            if let Ok(content) = fs::read_to_string(agent_path) {
                return format!("ACT AS THIS AGENT:\n{}", content);
            }
        }

        "ACT AS: Senior Software Engineer (Generic)".to_string()
    }
}
