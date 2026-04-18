use once_cell::sync::Lazy;
use std::collections::HashMap;
use tracing::warn;

static EMBEDDED_PROMPTS: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("batch_system", include_str!("../prompts/batch_system.md"));
    m.insert("single_system", include_str!("../prompts/single_system.md"));
    m.insert("guru_system", include_str!("../prompts/guru_system.md"));
    m
});

/// Load a prompt template by name.
/// First checks for a user override at `{workspace}/.guardian/prompts/{name}.md`,
/// then falls back to the embedded template.
pub fn load_prompt(name: &str, workspace_root: Option<&std::path::Path>) -> String {
    // Check for workspace-level override
    if let Some(root) = workspace_root {
        let override_path = root
            .join(".guardian")
            .join("prompts")
            .join(format!("{}.md", name));
        if override_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&override_path) {
                if !content.trim().is_empty() {
                    warn!(target: "guardian::prompts", "Using workspace prompt override: {}", override_path.display());
                    return content;
                }
            }
        }
    }

    // Fallback to embedded template
    EMBEDDED_PROMPTS
        .get(name)
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            warn!(target: "guardian::prompts", "Prompt template '{}' not found", name);
            String::new()
        })
}

/// Apply simple template substitutions: {{KEY}} → value
pub fn render_prompt(template: &str, vars: &[(&str, &str)]) -> String {
    let mut result = template.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("{{{{{}}}}}", key), value);
    }
    result
}
