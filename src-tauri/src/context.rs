use guardian_scan_policy::{classify_path, ScanProfile};
use ignore::WalkBuilder;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use std::time::{Duration, Instant};

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

    #[allow(dead_code)]
    pub fn index_path(root_path: &str) -> Self {
        Self::index_path_with_profile(root_path, ScanProfile::Source)
    }

    pub fn index_path_with_profile(root_path: &str, profile: ScanProfile) -> Self {
        let mut context = ProjectContext::new();
        let root = Path::new(root_path);

        let (file_structure, included_files) = collect_file_structure(root, profile);
        context.file_structure = file_structure;
        context.total_files = included_files;
        context.dependencies = discover_dependencies(root);
        context.intent_summary = discover_intent_summary(root);

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

    pub fn to_intent_pack_string(&self, root_path: &str, profile: ScanProfile) -> String {
        let root = Path::new(root_path);
        let workspace = root
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.trim().is_empty())
            .unwrap_or("<workspace>");

        let rules_hash = crate::skills::hasher::get_rules_fingerprint(&root.to_string_lossy());

        let mut out = String::new();
        out.push_str("PROJECT INTENT PACK (v1)\n");
        out.push_str(&format!("- workspace: {}\n", workspace));
        out.push_str(&format!(
            "- guardian_version: {}\n",
            env!("CARGO_PKG_VERSION")
        ));
        out.push_str(&format!("- scan_profile: {}\n", profile.as_str()));
        out.push_str(&format!(
            "- rules_hash: {}\n",
            if rules_hash.trim().is_empty() {
                "<none>"
            } else {
                &rules_hash
            }
        ));
        out.push_str(&format!(
            "- limits: max_file_bytes={}, max_batch_size={}\n",
            crate::config::max_file_bytes(),
            crate::config::max_batch_size()
        ));

        let top_level = list_top_level(root, 24);
        if !top_level.is_empty() {
            out.push_str("\nTOP-LEVEL SUMMARY\n");
            for item in top_level {
                out.push_str("- ");
                out.push_str(&item);
                out.push('\n');
            }
        }

        if !self.dependencies.is_empty() {
            out.push_str("\nDEPENDENCIES (sample)\n");
            for dep in self.dependencies.iter().take(60) {
                out.push_str("- ");
                out.push_str(dep);
                out.push('\n');
            }
        }

        if !self.file_structure.is_empty() {
            out.push_str(&format!(
                "\nFILE STRUCTURE (sample; {} of {} included)\n",
                self.file_structure.len(),
                self.total_files
            ));
            for p in self.file_structure.iter().take(80) {
                out.push_str("- ");
                out.push_str(p);
                out.push('\n');
            }
        }

        if !self.intent_summary.trim().is_empty()
            && self.intent_summary != "No explicit intent found."
        {
            out.push_str("\nINTENT / ARCHITECTURE NOTES (redacted)\n");
            out.push_str(self.intent_summary.trim());
            out.push('\n');
        }

        truncate_chars(out, 7000)
    }
}

#[derive(Debug, Clone)]
struct CachedIntentPack {
    built_at: Instant,
    pack: String,
}

static INTENT_PACK_CACHE: Lazy<RwLock<HashMap<String, CachedIntentPack>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

const INTENT_PACK_TTL: Duration = Duration::from_secs(300);

fn cache_key(root: &str, profile: ScanProfile) -> String {
    format!("{}::{}", root, profile.as_str())
}

pub fn seed_intent_pack_cache(root: &str, profile: ScanProfile, pack: String) {
    let key = cache_key(root, profile);
    if let Ok(mut guard) = INTENT_PACK_CACHE.write() {
        guard.insert(
            key,
            CachedIntentPack {
                built_at: Instant::now(),
                pack,
            },
        );
    }
}

pub fn cached_intent_pack(root: &str, profile: ScanProfile) -> String {
    let key = cache_key(root, profile);
    if let Ok(guard) = INTENT_PACK_CACHE.read() {
        if let Some(entry) = guard.get(&key) {
            if entry.built_at.elapsed() < INTENT_PACK_TTL && !entry.pack.trim().is_empty() {
                return entry.pack.clone();
            }
        }
    }

    let ctx = ProjectContext::index_path_with_profile(root, profile);
    let pack = ctx.to_intent_pack_string(root, profile);
    seed_intent_pack_cache(root, profile, pack.clone());
    pack
}

fn collect_file_structure(root: &Path, profile: ScanProfile) -> (Vec<String>, usize) {
    let mut included = 0usize;
    let mut sample: Vec<String> = Vec::new();

    let walker = WalkBuilder::new(root)
        // Keep gitignore-style filtering, but do not hide dot-prefixed roots or directories.
        .standard_filters(true)
        .hidden(false)
        .follow_links(false)
        .build();

    for entry in walker.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        if crate::redaction::gate::is_sensitive_file(path) {
            continue;
        }

        let rel_path = rel_path_string(root, path);
        let decision = classify_path(Path::new(&rel_path), false, profile);
        if !decision.include {
            continue;
        }

        included += 1;
        if sample.len() < 80 {
            sample.push(rel_path);
        }
    }

    sample.sort();
    (sample, included)
}

fn rel_path_string(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
        .trim_start_matches("./")
        .to_string()
}

fn list_top_level(root: &Path, limit: usize) -> Vec<String> {
    let Ok(read_dir) = fs::read_dir(root) else {
        return Vec::new();
    };

    let mut items: Vec<String> = read_dir
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let name = path.file_name()?.to_string_lossy().to_string();
            if name == ".git" || name == "node_modules" || name == "target" {
                return None;
            }
            Some(if path.is_dir() {
                format!("{}/", name)
            } else {
                name
            })
        })
        .collect();

    items.sort();
    items.truncate(limit);
    items
}

fn discover_dependencies(root: &Path) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();

    let pkg = root.join("package.json");
    if pkg.exists() && pkg.is_file() && !crate::redaction::gate::is_sensitive_file(&pkg) {
        if let Ok(raw) = fs::read_to_string(&pkg) {
            let masked = crate::redaction::gate::mask_inline_secrets(&raw);
            out.extend(extract_npm_deps(&masked));
        }
    }

    let cargo = root.join("Cargo.toml");
    if cargo.exists() && cargo.is_file() && !crate::redaction::gate::is_sensitive_file(&cargo) {
        if let Ok(raw) = fs::read_to_string(&cargo) {
            let masked = crate::redaction::gate::mask_inline_secrets(&raw);
            out.extend(extract_cargo_deps(&masked));
        }
    }

    out.sort();
    out.dedup();
    out.truncate(60);
    out
}

fn extract_npm_deps(raw: &str) -> Vec<String> {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw) else {
        return Vec::new();
    };

    let sections = [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies",
    ];
    let mut out: Vec<String> = Vec::new();

    for section in sections {
        let Some(obj) = value.get(section).and_then(|v| v.as_object()) else {
            continue;
        };
        for name in obj.keys() {
            if name.trim().is_empty() {
                continue;
            }
            out.push(format!("npm:{}", name));
        }
    }

    out
}

fn extract_cargo_deps(raw: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut in_section = false;

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            let section = trimmed.trim_start_matches('[').trim_end_matches(']').trim();
            in_section = matches!(
                section,
                "dependencies" | "dev-dependencies" | "build-dependencies"
            );
            continue;
        }

        if !in_section {
            continue;
        }

        let Some((name, _rest)) = trimmed.split_once('=') else {
            continue;
        };
        let dep = name.trim();
        if dep.is_empty() || dep.contains(' ') {
            continue;
        }
        if dep
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            out.push(format!("rust:{}", dep));
        }
    }

    out
}

#[allow(clippy::vec_init_then_push)]
fn discover_intent_summary(root: &Path) -> String {
    let mut parts: Vec<(String, PathBuf, usize)> = Vec::new();

    // High-fidelity: agent/process artifacts
    parts.push(("AGENTS.md".to_string(), root.join("AGENTS.md"), 2000));
    parts.push((
        ".agent/ARCHITECTURE.md".to_string(),
        root.join(".agent").join("ARCHITECTURE.md"),
        1200,
    ));

    // Human docs
    parts.push((
        "ARCHITECTURE.md".to_string(),
        root.join("ARCHITECTURE.md"),
        1200,
    ));
    parts.push(("CODEBASE.md".to_string(), root.join("CODEBASE.md"), 1200));
    parts.push((
        "USAGE_GUIDE.md".to_string(),
        root.join("USAGE_GUIDE.md"),
        1200,
    ));
    parts.push(("README.md".to_string(), root.join("README.md"), 1200));
    parts.push(("TODO.md".to_string(), root.join("TODO.md"), 800));

    // A small sample of workflow docs if present.
    let workflows_dir = root.join(".agent").join("workflows");
    if let Ok(read_dir) = fs::read_dir(&workflows_dir) {
        let mut workflow_files: Vec<PathBuf> = read_dir
            .flatten()
            .map(|e| e.path())
            .filter(|p| {
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("md"))
                    .unwrap_or(false)
            })
            .collect();
        workflow_files.sort();
        for wf in workflow_files.into_iter().take(2) {
            let name = wf
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("workflow.md")
                .to_string();
            parts.push((format!(".agent/workflows/{}", name), wf, 1000));
        }
    }

    let mut remaining = 4000usize;
    let mut out = String::new();

    for (label, path, per_file_limit) in parts {
        if remaining == 0 {
            break;
        }
        if !path.exists() || !path.is_file() {
            continue;
        }
        if crate::redaction::gate::is_sensitive_file(&path) {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let masked = crate::redaction::gate::mask_inline_secrets(&raw);
        let chunk = truncate_chars(masked, per_file_limit.min(remaining));
        let chunk = chunk.trim();
        if chunk.is_empty() {
            continue;
        }

        out.push_str(&format!("\n--- {} ---\n", label));
        out.push_str(chunk);
        out.push('\n');
        remaining = remaining.saturating_sub(chunk.len());
    }

    let trimmed = out.trim().to_string();
    if trimmed.is_empty() {
        "No explicit intent found.".to_string()
    } else {
        trimmed
    }
}

fn truncate_chars(input: String, limit: usize) -> String {
    if input.chars().count() <= limit {
        return input;
    }
    let mut out: String = input.chars().take(limit).collect();
    out.push_str("\n...[truncated]");
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn index_respects_scan_profile_source() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join(".workspace");
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("docs")).unwrap();
        fs::write(root.join("src").join("main.ts"), "export const x = 1;").unwrap();
        fs::write(root.join("docs").join("readme.md"), "hello").unwrap();

        let ctx =
            ProjectContext::index_path_with_profile(root.to_str().unwrap(), ScanProfile::Source);
        assert_eq!(ctx.total_files, 1);
        assert!(ctx.file_structure.iter().any(|p| p == "src/main.ts"));
        assert!(!ctx.file_structure.iter().any(|p| p.contains("docs/")));
    }

    #[test]
    fn extracts_npm_dependencies() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        fs::write(
            root.join("package.json"),
            r#"{"dependencies":{"react":"^18.0.0"},"devDependencies":{"vitest":"^1.0.0"}}"#,
        )
        .unwrap();

        let deps = discover_dependencies(root);
        assert!(deps.iter().any(|d| d == "npm:react"));
        assert!(deps.iter().any(|d| d == "npm:vitest"));
    }

    #[test]
    fn intent_pack_masks_inline_secrets() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        let token = format!("sk-{}", "A".repeat(48));
        fs::write(root.join("README.md"), format!("API_KEY=\"{}\"", token)).unwrap();

        let ctx =
            ProjectContext::index_path_with_profile(root.to_str().unwrap(), ScanProfile::Source);
        let pack = ctx.to_intent_pack_string(root.to_str().unwrap(), ScanProfile::Source);
        assert!(
            pack.contains("[REDACTED_SECRET]") || pack.contains("[REDACTED_OPENAI_KEY]"),
            "expected a redaction marker in intent pack"
        );
        assert!(!pack.contains(&token));
    }
}
