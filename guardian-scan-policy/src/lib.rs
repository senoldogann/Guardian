use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ScanProfile {
    #[default]
    Source,
    Extended,
    Full,
}

impl ScanProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Extended => "extended",
            Self::Full => "full",
        }
    }

    pub fn initial_scan_limit(self) -> usize {
        match self {
            Self::Source => 200,
            Self::Extended => 300,
            Self::Full => 500,
        }
    }

    pub fn max_batch_size(self) -> usize {
        match self {
            Self::Source => 3,
            Self::Extended => 4,
            Self::Full => 4,
        }
    }
}

impl FromStr for ScanProfile {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_lowercase().as_str() {
            "source" => Ok(Self::Source),
            "extended" => Ok(Self::Extended),
            "full" => Ok(Self::Full),
            other => Err(format!(
                "Unsupported scan profile '{}'. Use source|extended|full.",
                other
            )),
        }
    }
}

pub const DEFAULT_POLICY_FILE: &str = "guardian.policy.yaml";
const POLICY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GuardianPolicy {
    #[serde(default = "default_policy_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub packs: Vec<String>,
    #[serde(default)]
    pub gate: GuardianGatePolicy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GuardianGatePolicy {
    #[serde(default = "default_pass_max_warnings")]
    pub pass_max_warnings: usize,
    #[serde(default = "default_block_on_critical")]
    pub block_on_critical: bool,
    #[serde(default = "default_require_human_approval_on_ai_heavy")]
    pub require_human_approval_on_ai_heavy: bool,
    #[serde(default = "default_require_override_reason")]
    pub require_override_reason: bool,
}

impl Default for GuardianGatePolicy {
    fn default() -> Self {
        Self {
            pass_max_warnings: default_pass_max_warnings(),
            block_on_critical: default_block_on_critical(),
            require_human_approval_on_ai_heavy: default_require_human_approval_on_ai_heavy(),
            require_override_reason: default_require_override_reason(),
        }
    }
}

impl Default for GuardianPolicy {
    fn default() -> Self {
        Self {
            schema_version: default_policy_schema_version(),
            packs: vec![
                "clean_architecture".to_string(),
                "api_backend_guardrails".to_string(),
                "secrets_security_hygiene".to_string(),
                "test_coverage_expectations".to_string(),
                "ai_generated_code_strict_mode".to_string(),
            ],
            gate: GuardianGatePolicy::default(),
        }
    }
}

impl GuardianPolicy {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version == 0 {
            return Err("guardian.policy.yaml: schema_version must be >= 1".to_string());
        }
        if self.schema_version != POLICY_SCHEMA_VERSION {
            return Err(format!(
                "guardian.policy.yaml: unsupported schema_version {} (expected {}).",
                self.schema_version, POLICY_SCHEMA_VERSION
            ));
        }
        Ok(())
    }
}

fn default_policy_schema_version() -> u32 {
    POLICY_SCHEMA_VERSION
}

fn default_pass_max_warnings() -> usize {
    5
}

fn default_block_on_critical() -> bool {
    true
}

fn default_require_human_approval_on_ai_heavy() -> bool {
    true
}

fn default_require_override_reason() -> bool {
    true
}

pub fn default_policy_path(root: &Path) -> PathBuf {
    root.join(DEFAULT_POLICY_FILE)
}

pub fn load_policy_for_root(
    root: &Path,
    explicit_path: Option<&Path>,
) -> Result<(GuardianPolicy, PathBuf), String> {
    let path = explicit_path
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| default_policy_path(root));
    if !path.exists() {
        let policy = GuardianPolicy::default();
        policy.validate()?;
        return Ok((policy, path));
    }

    let raw = fs::read_to_string(&path).map_err(|err| {
        format!(
            "Failed to read policy file {}: {}",
            path.to_string_lossy(),
            err
        )
    })?;
    let policy: GuardianPolicy = serde_yaml::from_str(&raw)
        .map_err(|err| format!("Invalid policy YAML {}: {}", path.to_string_lossy(), err))?;
    policy.validate()?;
    Ok((policy, path))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReleaseDecision {
    #[default]
    Pass,
    PassWithWarning,
    BlockUntilApproved,
    Overridden,
}

impl ReleaseDecision {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pass => "PASS",
            Self::PassWithWarning => "PASS_WITH_WARNING",
            Self::BlockUntilApproved => "BLOCK_UNTIL_APPROVED",
            Self::Overridden => "OVERRIDDEN",
        }
    }
}

impl FromStr for ReleaseDecision {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_uppercase().as_str() {
            "PASS" => Ok(Self::Pass),
            "PASS_WITH_WARNING" => Ok(Self::PassWithWarning),
            "BLOCK_UNTIL_APPROVED" => Ok(Self::BlockUntilApproved),
            "OVERRIDDEN" => Ok(Self::Overridden),
            other => Err(format!(
                "Unsupported release decision '{}'. Use PASS|PASS_WITH_WARNING|BLOCK_UNTIL_APPROVED|OVERRIDDEN.",
                other
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct IntakeMetrics {
    pub changed_files: usize,
    pub estimated_changed_lines: usize,
    pub refactor_signal: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiHeavyClassification {
    pub ai_heavy_change: bool,
    pub reason: String,
}

pub fn classify_ai_heavy_change(metrics: IntakeMetrics) -> AiHeavyClassification {
    let file_heavy = metrics.changed_files >= 15;
    let line_heavy = metrics.estimated_changed_lines >= 1200;
    let mixed_heavy = metrics.changed_files >= 8 && metrics.estimated_changed_lines >= 700;

    if metrics.refactor_signal || file_heavy || line_heavy || mixed_heavy {
        let reason = if metrics.refactor_signal {
            "Refactor-like signal detected in file paths or findings.".to_string()
        } else if file_heavy {
            format!(
                "Large intake: changed_files={} exceeds threshold 15.",
                metrics.changed_files
            )
        } else if line_heavy {
            format!(
                "Large intake: estimated_changed_lines={} exceeds threshold 1200.",
                metrics.estimated_changed_lines
            )
        } else {
            format!(
                "Large mixed intake: changed_files={} and estimated_changed_lines={}.",
                metrics.changed_files, metrics.estimated_changed_lines
            )
        };
        return AiHeavyClassification {
            ai_heavy_change: true,
            reason,
        };
    }

    AiHeavyClassification {
        ai_heavy_change: false,
        reason: "Intake size is below AI-heavy thresholds.".to_string(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecisionInputs {
    pub critical_findings: usize,
    pub warning_findings: usize,
    pub ai_heavy_change: bool,
    pub human_approved: bool,
    pub override_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReleaseDecisionResult {
    pub decision: ReleaseDecision,
    pub requires_human_approval: bool,
    pub override_applied: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub override_reason: Option<String>,
    #[serde(default)]
    pub reasons: Vec<String>,
}

pub fn evaluate_release_decision(
    policy: &GuardianPolicy,
    inputs: DecisionInputs,
) -> ReleaseDecisionResult {
    let requires_human_approval =
        policy.gate.require_human_approval_on_ai_heavy && inputs.ai_heavy_change;
    let normalized_override_reason = inputs
        .override_reason
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);

    let mut blockers: Vec<String> = Vec::new();
    if policy.gate.block_on_critical && inputs.critical_findings > 0 {
        blockers.push(format!(
            "{} critical finding(s) violate block_on_critical policy.",
            inputs.critical_findings
        ));
    }
    if inputs.warning_findings > policy.gate.pass_max_warnings {
        blockers.push(format!(
            "{} warning(s) exceed pass_max_warnings={}.",
            inputs.warning_findings, policy.gate.pass_max_warnings
        ));
    }
    if requires_human_approval && !inputs.human_approved {
        blockers.push("AI-heavy intake requires human approval before release.".to_string());
    }

    if blockers.is_empty() {
        let decision = if inputs.warning_findings > 0 || requires_human_approval {
            ReleaseDecision::PassWithWarning
        } else {
            ReleaseDecision::Pass
        };
        let mut reasons = vec!["Policy gate checks passed.".to_string()];
        if decision == ReleaseDecision::PassWithWarning && inputs.warning_findings > 0 {
            reasons.push(format!(
                "Release allowed with warning: {} warning finding(s).",
                inputs.warning_findings
            ));
        }
        return ReleaseDecisionResult {
            decision,
            requires_human_approval,
            override_applied: false,
            override_reason: None,
            reasons,
        };
    }

    if let Some(reason) = normalized_override_reason.clone() {
        if !policy.gate.require_override_reason || !reason.trim().is_empty() {
            let mut reasons = blockers;
            reasons.push("Release block was overridden by an approver.".to_string());
            return ReleaseDecisionResult {
                decision: ReleaseDecision::Overridden,
                requires_human_approval,
                override_applied: true,
                override_reason: Some(reason),
                reasons,
            };
        }
    } else if policy.gate.require_override_reason && inputs.override_reason.is_some() {
        blockers.push("Override attempted without a reason.".to_string());
    }

    ReleaseDecisionResult {
        decision: ReleaseDecision::BlockUntilApproved,
        requires_human_approval,
        override_applied: false,
        override_reason: None,
        reasons: blockers,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkipReason {
    IgnoredPathSegment,
    IgnoredFileName,
    TestLikePattern,
    ExtensionNotAllowed,
    BinaryExtension,
}

impl SkipReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::IgnoredPathSegment => "ignored_path_segment",
            Self::IgnoredFileName => "ignored_file_name",
            Self::TestLikePattern => "test_like_pattern",
            Self::ExtensionNotAllowed => "extension_not_allowed",
            Self::BinaryExtension => "binary_extension",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PathDecision {
    pub include: bool,
    pub reason: Option<SkipReason>,
}

impl PathDecision {
    fn include() -> Self {
        Self {
            include: true,
            reason: None,
        }
    }

    fn skip(reason: SkipReason) -> Self {
        Self {
            include: false,
            reason: Some(reason),
        }
    }
}

const SOURCE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "java", "kt", "swift", "cs", "rb",
    "php", "c", "cc", "cpp", "h", "hpp", "sql", "vue", "svelte",
];

const EXTENDED_EXTRA_EXTENSIONS: &[&str] =
    &["sh", "yml", "yaml", "toml", "json", "ini", "cfg", "conf"];

const COMMON_IGNORED_SEGMENTS: &[&str] = &[
    ".git",
    "target",
    "node_modules",
    ".maestro",
    "_library",
    ".agent",
    ".shared",
    "build",
    "dist",
    ".vscode",
    ".next",
    "coverage",
    ".guardian",
    ".guardian-proposals",
    ".idea",
    ".opencode",
    ".loki",
    "tmp",
    "temp",
    "vendor",
    "third_party",
    "storybook-static",
    "benchmarks",
];

const SOURCE_ONLY_IGNORED_SEGMENTS: &[&str] = &[
    "docs",
    "doc",
    "test",
    "tests",
    "__tests__",
    "__mocks__",
    "mocks",
    "fixtures",
    "scripts",
    ".github",
];

const EXTENDED_ONLY_IGNORED_SEGMENTS: &[&str] = &[
    "docs",
    "doc",
    "test",
    "tests",
    "__tests__",
    "__mocks__",
    "mocks",
    "fixtures",
];

const SOURCE_IGNORED_FILE_NAMES: &[&str] = &[
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
    "justfile",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
    "cargo.lock",
    "readme.md",
    "changelog.md",
    "license",
    "default.rules",
];

const EXTENDED_SPECIAL_FILE_NAMES: &[&str] = &[
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
    "justfile",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "cargo.lock",
];

const BINARY_EXTENSIONS: &[&str] = &[
    "exe", "dll", "so", "dylib", "bin", "o", "a", "lib", "png", "jpg", "jpeg", "gif", "bmp", "ico",
    "mp3", "mp4", "wav", "avi", "mov", "mkv", "zip", "tar", "gz", "rar", "7z", "bz2", "pdf", "doc",
    "docx", "xls", "xlsx", "ppt", "pptx", "wasm", "class", "jar", "pyc", "pyo", "lockb",
];

pub fn should_skip_path(path: &Path, is_chat: bool, profile: ScanProfile) -> bool {
    !classify_path(path, is_chat, profile).include
}

pub fn is_candidate_file(path: &Path, is_chat: bool, profile: ScanProfile) -> bool {
    classify_path(path, is_chat, profile).include
}

pub fn classify_path(path: &Path, is_chat: bool, profile: ScanProfile) -> PathDecision {
    if is_chat {
        return PathDecision::include();
    }

    let normalized = path.to_string_lossy().replace('\\', "/").to_lowercase();
    let file_name = normalized.rsplit('/').next().unwrap_or_default();

    if has_ignored_segment(&normalized, profile) {
        return PathDecision::skip(SkipReason::IgnoredPathSegment);
    }

    if has_ignored_file_name(file_name, profile) {
        return PathDecision::skip(SkipReason::IgnoredFileName);
    }

    if profile != ScanProfile::Full && is_test_like_file_name(file_name) {
        return PathDecision::skip(SkipReason::TestLikePattern);
    }

    match profile {
        ScanProfile::Source => {
            if has_allowed_source_extension(path) {
                PathDecision::include()
            } else {
                PathDecision::skip(SkipReason::ExtensionNotAllowed)
            }
        }
        ScanProfile::Extended => {
            if EXTENDED_SPECIAL_FILE_NAMES.contains(&file_name) {
                return PathDecision::include();
            }
            if has_allowed_extended_extension(path) {
                PathDecision::include()
            } else {
                PathDecision::skip(SkipReason::ExtensionNotAllowed)
            }
        }
        ScanProfile::Full => {
            if is_binary_extension(path) {
                PathDecision::skip(SkipReason::BinaryExtension)
            } else {
                PathDecision::include()
            }
        }
    }
}

pub fn is_infra_relevant_path(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('\\', "/").to_lowercase();
    let file_name = normalized.rsplit('/').next().unwrap_or_default();

    if normalized.contains("/.github/workflows/") {
        return true;
    }

    if EXTENDED_SPECIAL_FILE_NAMES.contains(&file_name) || file_name == "default.rules" {
        return true;
    }

    matches!(
        extension_lower(path).as_deref(),
        Some("sh") | Some("yml") | Some("yaml") | Some("toml") | Some("json")
    )
}

fn has_ignored_segment(normalized: &str, profile: ScanProfile) -> bool {
    let mut ignored = COMMON_IGNORED_SEGMENTS;
    for segment in normalized.split('/') {
        if ignored.contains(&segment) {
            return true;
        }

        ignored = match profile {
            ScanProfile::Source => SOURCE_ONLY_IGNORED_SEGMENTS,
            ScanProfile::Extended => EXTENDED_ONLY_IGNORED_SEGMENTS,
            ScanProfile::Full => &[],
        };

        if ignored.contains(&segment) {
            return true;
        }

        ignored = COMMON_IGNORED_SEGMENTS;
    }
    false
}

fn has_ignored_file_name(file_name: &str, profile: ScanProfile) -> bool {
    match profile {
        ScanProfile::Source => SOURCE_IGNORED_FILE_NAMES.contains(&file_name),
        ScanProfile::Extended | ScanProfile::Full => false,
    }
}

fn has_allowed_source_extension(path: &Path) -> bool {
    extension_lower(path)
        .map(|ext| SOURCE_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

fn has_allowed_extended_extension(path: &Path) -> bool {
    extension_lower(path)
        .map(|ext| {
            SOURCE_EXTENSIONS.contains(&ext.as_str())
                || EXTENDED_EXTRA_EXTENSIONS.contains(&ext.as_str())
        })
        .unwrap_or(false)
}

fn extension_lower(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

fn is_binary_extension(path: &Path) -> bool {
    extension_lower(path)
        .map(|ext| BINARY_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

fn is_test_like_file_name(file_name: &str) -> bool {
    file_name.contains(".test.")
        || file_name.contains(".spec.")
        || file_name.ends_with("_test.rs")
        || file_name.ends_with("_test.go")
        || file_name.ends_with("_spec.rb")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn source_profile_filters_non_source_and_docs() {
        let cases = [
            ("src/main.ts", true),
            ("docs/readme.md", false),
            ("scripts/deploy.sh", false),
            (".maestro/skills/playwright-skill/lib/helpers.js", false),
            ("Dockerfile", false),
            (".github/workflows/ci.yml", false),
            ("tests/foo.test.ts", false),
            ("pnpm-lock.yaml", false),
        ];

        for (path, expected) in cases {
            assert_eq!(
                is_candidate_file(Path::new(path), false, ScanProfile::Source),
                expected,
                "path={} profile=source",
                path
            );
        }
    }

    #[test]
    fn extended_profile_includes_infra_but_skips_docs_and_tests() {
        let cases = [
            ("src/main.ts", true),
            ("docs/readme.md", false),
            ("scripts/deploy.sh", true),
            ("Dockerfile", true),
            (".github/workflows/ci.yml", true),
            ("tests/foo.test.ts", false),
            ("package-lock.json", true),
        ];

        for (path, expected) in cases {
            assert_eq!(
                is_candidate_file(Path::new(path), false, ScanProfile::Extended),
                expected,
                "path={} profile=extended",
                path
            );
        }
    }

    #[test]
    fn full_profile_includes_docs_tests_and_scripts_except_binary() {
        let cases = [
            ("src/main.ts", true),
            ("docs/readme.md", true),
            ("scripts/deploy.sh", true),
            ("tests/foo.test.ts", true),
            (".github/workflows/ci.yml", true),
            ("assets/logo.png", false),
            ("dist/app.js", false),
        ];

        for (path, expected) in cases {
            assert_eq!(
                is_candidate_file(Path::new(path), false, ScanProfile::Full),
                expected,
                "path={} profile=full",
                path
            );
        }
    }

    #[test]
    fn profile_limits_match_contract() {
        assert_eq!(ScanProfile::Source.initial_scan_limit(), 200);
        assert_eq!(ScanProfile::Extended.initial_scan_limit(), 300);
        assert_eq!(ScanProfile::Full.initial_scan_limit(), 500);

        assert_eq!(ScanProfile::Source.max_batch_size(), 3);
        assert_eq!(ScanProfile::Extended.max_batch_size(), 4);
        assert_eq!(ScanProfile::Full.max_batch_size(), 4);
    }

    #[test]
    fn parse_profile_from_str() {
        assert_eq!(
            ScanProfile::from_str("source").unwrap(),
            ScanProfile::Source
        );
        assert_eq!(
            ScanProfile::from_str("extended").unwrap(),
            ScanProfile::Extended
        );
        assert_eq!(ScanProfile::from_str("full").unwrap(), ScanProfile::Full);
        assert!(ScanProfile::from_str("invalid").is_err());
    }

    #[test]
    fn default_policy_is_valid() {
        let policy = GuardianPolicy::default();
        assert_eq!(policy.schema_version, 1);
        assert!(policy.validate().is_ok());
    }

    #[test]
    fn ai_heavy_classifier_marks_large_refactor() {
        let out = classify_ai_heavy_change(IntakeMetrics {
            changed_files: 5,
            estimated_changed_lines: 320,
            refactor_signal: true,
        });
        assert!(out.ai_heavy_change);
        assert!(out.reason.to_lowercase().contains("refactor"));
    }

    #[test]
    fn decision_engine_blocks_until_approved_for_ai_heavy_intake() {
        let policy = GuardianPolicy::default();
        let result = evaluate_release_decision(
            &policy,
            DecisionInputs {
                critical_findings: 0,
                warning_findings: 1,
                ai_heavy_change: true,
                human_approved: false,
                override_reason: None,
            },
        );
        assert_eq!(result.decision, ReleaseDecision::BlockUntilApproved);
        assert!(result.requires_human_approval);
    }

    #[test]
    fn decision_engine_requires_override_reason_when_policy_requires_it() {
        let mut policy = GuardianPolicy::default();
        policy.gate.pass_max_warnings = 0;
        let result = evaluate_release_decision(
            &policy,
            DecisionInputs {
                critical_findings: 0,
                warning_findings: 2,
                ai_heavy_change: false,
                human_approved: false,
                override_reason: Some("   ".to_string()),
            },
        );
        assert_eq!(result.decision, ReleaseDecision::BlockUntilApproved);
        assert!(!result.override_applied);
    }

    #[test]
    fn decision_engine_allows_override_with_reason() {
        let policy = GuardianPolicy::default();
        let result = evaluate_release_decision(
            &policy,
            DecisionInputs {
                critical_findings: 1,
                warning_findings: 0,
                ai_heavy_change: false,
                human_approved: false,
                override_reason: Some("Emergency release for hotfix".to_string()),
            },
        );
        assert_eq!(result.decision, ReleaseDecision::Overridden);
        assert!(result.override_applied);
        assert_eq!(
            result.override_reason.as_deref(),
            Some("Emergency release for hotfix")
        );
    }
}
