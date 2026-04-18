//! # Guardian Rules
//!
//! A deterministic, regex-based rule engine for static code analysis.
//! Complements AI-powered analysis with fast, predictable pattern matching.
//!
//! ## Quick start
//!
//! ```rust
//! use guardian_rules::{RuleEngine, Severity};
//!
//! let engine = RuleEngine::with_defaults();
//! let violations = engine.evaluate("app.js", "console.log('debug');\n");
//! assert!(!violations.is_empty());
//! ```

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;

// ── Severity ────────────────────────────────────────────────────────────────

/// Severity level for a rule violation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Severity::Error => write!(f, "error"),
            Severity::Warning => write!(f, "warning"),
            Severity::Info => write!(f, "info"),
        }
    }
}

// ── Rule ────────────────────────────────────────────────────────────────────

/// A single analysis rule backed by a compiled regex pattern.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub severity: Severity,
    /// Regex pattern that triggers a violation when matched.
    #[serde(rename = "pattern")]
    pattern_str: String,
    /// Human-readable message shown when the rule fires.
    pub message: String,
    /// Optional suggested fix (may contain `$0`–`$9` capture-group references).
    pub auto_fix: Option<String>,
    /// If set, a match is suppressed when the same line also matches this regex.
    #[serde(default)]
    pub exclude_pattern: Option<String>,
    /// If set, a match is suppressed when any of the preceding
    /// `preceding_lines` lines matches this regex.
    #[serde(default)]
    pub preceding_pattern: Option<String>,
    /// How many lines before the match to check for `preceding_pattern` (default 1).
    #[serde(default = "default_one")]
    pub preceding_lines: usize,
    /// Glob patterns restricting which files this rule applies to.
    /// An empty list means the rule applies to every file.
    #[serde(default)]
    pub file_patterns: Vec<String>,
    /// Whether this rule is currently enabled.
    #[serde(default = "default_true")]
    pub enabled: bool,

    #[serde(skip)]
    compiled: Option<Regex>,
    #[serde(skip)]
    exclude_compiled: Option<Regex>,
    #[serde(skip)]
    preceding_compiled: Option<Regex>,
}

fn default_true() -> bool {
    true
}

fn default_one() -> usize {
    1
}

impl Rule {
    /// Create a new rule. The pattern is compiled eagerly; returns `Err` on bad regex.
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        severity: Severity,
        pattern: impl Into<String>,
        message: impl Into<String>,
    ) -> Result<Self, regex::Error> {
        let pattern_str: String = pattern.into();
        let compiled = Regex::new(&pattern_str)?;
        Ok(Self {
            id: id.into(),
            name: name.into(),
            severity,
            pattern_str,
            message: message.into(),
            auto_fix: None,
            exclude_pattern: None,
            preceding_pattern: None,
            preceding_lines: 1,
            file_patterns: Vec::new(),
            enabled: true,
            compiled: Some(compiled),
            exclude_compiled: None,
            preceding_compiled: None,
        })
    }

    /// Builder helper — attach a suggested auto-fix.
    pub fn with_auto_fix(mut self, fix: impl Into<String>) -> Self {
        self.auto_fix = Some(fix.into());
        self
    }

    /// Builder helper — restrict to specific file globs.
    pub fn with_file_patterns(mut self, patterns: Vec<String>) -> Self {
        self.file_patterns = patterns;
        self
    }

    /// Builder helper — suppress violation when the matched line also matches `pat`.
    pub fn with_exclude_pattern(mut self, pat: impl Into<String>) -> Result<Self, regex::Error> {
        let s: String = pat.into();
        self.exclude_compiled = Some(Regex::new(&s)?);
        self.exclude_pattern = Some(s);
        Ok(self)
    }

    /// Builder helper — suppress violation when a preceding line matches `pat`.
    pub fn with_preceding_pattern(
        mut self,
        pat: impl Into<String>,
        lines: usize,
    ) -> Result<Self, regex::Error> {
        let s: String = pat.into();
        self.preceding_compiled = Some(Regex::new(&s)?);
        self.preceding_pattern = Some(s);
        self.preceding_lines = lines;
        Ok(self)
    }

    /// Ensure all regexes are compiled (needed after deserialization).
    pub fn compile(&mut self) -> Result<(), regex::Error> {
        if self.compiled.is_none() {
            self.compiled = Some(Regex::new(&self.pattern_str)?);
        }
        if let Some(ref pat) = self.exclude_pattern {
            if self.exclude_compiled.is_none() {
                self.exclude_compiled = Some(Regex::new(pat)?);
            }
        }
        if let Some(ref pat) = self.preceding_pattern {
            if self.preceding_compiled.is_none() {
                self.preceding_compiled = Some(Regex::new(pat)?);
            }
        }
        Ok(())
    }

    /// Return the compiled main regex, if available.
    pub fn regex(&self) -> Option<&Regex> {
        self.compiled.as_ref()
    }

    /// Check whether `file_path` matches this rule's file-pattern filters.
    pub fn matches_file(&self, file_path: &str) -> bool {
        if self.file_patterns.is_empty() {
            return true;
        }
        let path = Path::new(file_path);
        self.file_patterns.iter().any(|pat| {
            if let Some(ext) = pat.strip_prefix("*.") {
                path.extension().and_then(|e| e.to_str()) == Some(ext)
            } else {
                file_path.contains(pat.trim_start_matches('*'))
            }
        })
    }
}

// ── RuleSet ─────────────────────────────────────────────────────────────────

/// A named collection of rules that can be serialized to/from YAML or JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSet {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub rules: Vec<Rule>,
}

impl RuleSet {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            description: String::new(),
            rules: Vec::new(),
        }
    }

    pub fn add_rule(&mut self, rule: Rule) {
        self.rules.push(rule);
    }

    /// Load a rule set from a JSON string.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        let mut set: Self = serde_json::from_str(json)?;
        for rule in &mut set.rules {
            let _ = rule.compile();
        }
        Ok(set)
    }

    /// Load a rule set from a YAML string.
    pub fn from_yaml(yaml: &str) -> Result<Self, serde_yaml::Error> {
        let mut set: Self = serde_yaml::from_str(yaml)?;
        for rule in &mut set.rules {
            let _ = rule.compile();
        }
        Ok(set)
    }

    /// Serialize to pretty JSON.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Serialize to YAML.
    pub fn to_yaml(&self) -> Result<String, serde_yaml::Error> {
        serde_yaml::to_string(self)
    }
}

// ── RuleViolation ───────────────────────────────────────────────────────────

/// A single violation produced when a rule matches content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleViolation {
    pub rule_id: String,
    pub file: String,
    pub line: usize,
    pub column: usize,
    pub message: String,
    pub severity: Severity,
    pub suggested_fix: Option<String>,
}

impl std::fmt::Display for RuleViolation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "[{}] {}:{}:{} — {} ({})",
            self.severity, self.file, self.line, self.column, self.message, self.rule_id,
        )
    }
}

// ── RuleEngine ──────────────────────────────────────────────────────────────

/// The core engine that evaluates content against a set of rules.
pub struct RuleEngine {
    rule_sets: Vec<RuleSet>,
}

impl RuleEngine {
    /// Create an empty engine with no rules.
    pub fn new() -> Self {
        Self {
            rule_sets: Vec::new(),
        }
    }

    /// Create an engine pre-loaded with the built-in default rules.
    pub fn with_defaults() -> Self {
        let mut engine = Self::new();
        engine.add_rule_set(default_rules());
        engine
    }

    /// Add a complete rule set to the engine.
    pub fn add_rule_set(&mut self, set: RuleSet) {
        self.rule_sets.push(set);
    }

    /// Add a single rule (placed into an anonymous rule set).
    pub fn add_rule(&mut self, rule: Rule) {
        if let Some(last) = self.rule_sets.last_mut() {
            last.rules.push(rule);
        } else {
            let mut set = RuleSet::new("custom");
            set.add_rule(rule);
            self.add_rule_set(set);
        }
    }

    /// Return a flat iterator over every rule in the engine.
    pub fn rules(&self) -> impl Iterator<Item = &Rule> {
        self.rule_sets.iter().flat_map(|s| s.rules.iter())
    }

    /// Evaluate `content` as if it came from `file_path`.
    /// Returns all violations found, sorted by line number.
    pub fn evaluate(&self, file_path: &str, content: &str) -> Vec<RuleViolation> {
        let mut violations = Vec::new();
        let lines: Vec<&str> = content.lines().collect();

        for rule in self.rules() {
            if !rule.enabled {
                continue;
            }
            if !rule.matches_file(file_path) {
                continue;
            }
            let re = match rule.regex() {
                Some(r) => r,
                None => continue,
            };

            for (line_idx, line) in lines.iter().enumerate() {
                if let Some(m) = re.find(line) {
                    // Check same-line exclude pattern
                    if let Some(ref exc) = rule.exclude_compiled {
                        if exc.is_match(line) {
                            continue;
                        }
                    }
                    // Check preceding-line pattern
                    if let Some(ref prec) = rule.preceding_compiled {
                        let start = line_idx.saturating_sub(rule.preceding_lines);
                        let suppressed = (start..line_idx).any(|i| prec.is_match(lines[i]));
                        if suppressed {
                            continue;
                        }
                    }

                    violations.push(RuleViolation {
                        rule_id: rule.id.clone(),
                        file: file_path.to_string(),
                        line: line_idx + 1,
                        column: m.start() + 1,
                        message: rule.message.clone(),
                        severity: rule.severity,
                        suggested_fix: rule.auto_fix.clone(),
                    });
                }
            }
        }

        violations.sort_by_key(|v| (v.line, v.column));
        violations
    }
}

impl Default for RuleEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ── Built-in default rules ──────────────────────────────────────────────────

/// Returns the built-in "guardian-defaults" rule set.
pub fn default_rules() -> RuleSet {
    let mut set = RuleSet::new("guardian-defaults");
    set.description = "Built-in rules shipped with Guardian".into();

    // 1. No hardcoded secrets
    set.add_rule(
        Rule::new(
            "no-hardcoded-secrets",
            "No hardcoded secrets",
            Severity::Error,
            r#"(?i)(password|secret|api_?key|token|private_?key)\s*[:=]\s*["'][^"']{8,}["']"#,
            "Hardcoded secret detected — use environment variables or a secrets manager",
        )
        .expect("valid regex")
        .with_auto_fix("Replace the literal value with an environment variable reference"),
    );

    // 2. No TODO/FIXME without issue reference
    set.add_rule(
        Rule::new(
            "todo-needs-issue",
            "TODO/FIXME without issue reference",
            Severity::Warning,
            r"(?i)\b(TODO|FIXME)\b",
            "TODO/FIXME comment should reference an issue (e.g. TODO(#123) or TODO(PROJ-456))",
        )
        .expect("valid regex")
        .with_exclude_pattern(r"#\d+|[A-Z]+-\d+")
        .expect("valid exclude regex"),
    );

    // 3. No console.log in production code
    set.add_rule(
        Rule::new(
            "no-console-log",
            "No console.log in production code",
            Severity::Warning,
            r"\bconsole\.(log|debug|info)\s*\(",
            "Remove console.log — use a proper logger instead",
        )
        .expect("valid regex")
        .with_auto_fix("Replace with a structured logger call")
        .with_file_patterns(vec![
            "*.js".into(),
            "*.ts".into(),
            "*.jsx".into(),
            "*.tsx".into(),
        ]),
    );

    // 4. No unsafe blocks without a SAFETY comment on a preceding line
    set.add_rule(
        Rule::new(
            "unsafe-needs-safety-comment",
            "Unsafe block without SAFETY comment",
            Severity::Error,
            r"\bunsafe\s*\{",
            "unsafe block must be preceded by a `// SAFETY: ...` comment explaining the invariant",
        )
        .expect("valid regex")
        .with_preceding_pattern(r"//\s*SAFETY:", 2)
        .expect("valid preceding regex")
        .with_file_patterns(vec!["*.rs".into()]),
    );

    set
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_hardcoded_secrets() {
        let engine = RuleEngine::with_defaults();
        let content = r#"const API_KEY = "sk-abc123xxxxxxxxx";"#;
        let violations = engine.evaluate("config.ts", content);
        assert!(
            violations
                .iter()
                .any(|v| v.rule_id == "no-hardcoded-secrets"),
            "expected a hardcoded-secret violation, got: {violations:?}"
        );
    }

    #[test]
    fn detects_todo_without_issue() {
        let engine = RuleEngine::with_defaults();
        let content = "// TODO: fix this later\n";
        let violations = engine.evaluate("main.rs", content);
        assert!(
            violations.iter().any(|v| v.rule_id == "todo-needs-issue"),
            "expected a todo-needs-issue violation, got: {violations:?}"
        );
    }

    #[test]
    fn allows_todo_with_issue_ref() {
        let engine = RuleEngine::with_defaults();
        let content = "// TODO(#42): handle edge case\n";
        let violations = engine.evaluate("main.rs", content);
        assert!(
            !violations.iter().any(|v| v.rule_id == "todo-needs-issue"),
            "TODO with issue ref should not trigger, got: {violations:?}"
        );
    }

    #[test]
    fn detects_console_log_in_js() {
        let engine = RuleEngine::with_defaults();
        let content = "function init() {\n  console.log('hello');\n}\n";
        let violations = engine.evaluate("app.js", content);
        assert!(
            violations.iter().any(|v| v.rule_id == "no-console-log"),
            "expected no-console-log violation, got: {violations:?}"
        );
        assert_eq!(violations[0].line, 2);
    }

    #[test]
    fn ignores_console_log_in_non_js_files() {
        let engine = RuleEngine::with_defaults();
        let content = "console.log('test');\n";
        let violations = engine.evaluate("README.md", content);
        assert!(
            !violations.iter().any(|v| v.rule_id == "no-console-log"),
            "console.log rule should not fire on .md files"
        );
    }

    #[test]
    fn detects_unsafe_without_safety_comment() {
        let engine = RuleEngine::with_defaults();
        let content = "fn main() {\n    unsafe {\n        do_stuff();\n    }\n}\n";
        let violations = engine.evaluate("lib.rs", content);
        assert!(
            violations
                .iter()
                .any(|v| v.rule_id == "unsafe-needs-safety-comment"),
            "expected unsafe-needs-safety-comment violation, got: {violations:?}"
        );
    }

    #[test]
    fn custom_rule_integration() {
        let mut engine = RuleEngine::new();
        let rule = Rule::new(
            "no-dbg-macro",
            "No dbg! macro",
            Severity::Warning,
            r"\bdbg!\s*\(",
            "Remove dbg! macro before committing",
        )
        .unwrap();
        engine.add_rule(rule);

        let content = "let x = dbg!(compute());\n";
        let violations = engine.evaluate("lib.rs", content);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].rule_id, "no-dbg-macro");
    }

    #[test]
    fn ruleset_json_roundtrip() {
        let set = default_rules();
        let json = set.to_json().unwrap();
        let loaded = RuleSet::from_json(&json).unwrap();
        assert_eq!(loaded.rules.len(), set.rules.len());
        // Ensure compiled regexes work after deserialization
        let engine = {
            let mut e = RuleEngine::new();
            e.add_rule_set(loaded);
            e
        };
        let violations = engine.evaluate("x.ts", "const token = \"abcdefghij\";\n");
        assert!(!violations.is_empty());
    }

    #[test]
    fn ruleset_yaml_roundtrip() {
        let set = default_rules();
        let yaml = set.to_yaml().unwrap();
        let loaded = RuleSet::from_yaml(&yaml).unwrap();
        assert_eq!(loaded.rules.len(), set.rules.len());
    }

    #[test]
    fn violation_display_format() {
        let v = RuleViolation {
            rule_id: "test-rule".into(),
            file: "src/main.rs".into(),
            line: 10,
            column: 5,
            message: "bad thing".into(),
            severity: Severity::Error,
            suggested_fix: None,
        };
        let display = format!("{v}");
        assert!(display.contains("src/main.rs:10:5"));
        assert!(display.contains("test-rule"));
    }
}
