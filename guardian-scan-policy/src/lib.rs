use serde::{Deserialize, Serialize};
use std::path::Path;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScanProfile {
    Source,
    Extended,
    Full,
}

impl Default for ScanProfile {
    fn default() -> Self {
        Self::Source
    }
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
            Self::Extended => 3,
            Self::Full => 2,
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
    "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "java", "kt", "swift",
    "cs", "rb", "php", "c", "cc", "cpp", "h", "hpp", "sql", "vue", "svelte",
];

const EXTENDED_EXTRA_EXTENSIONS: &[&str] = &["sh", "yml", "yaml", "toml", "json", "ini", "cfg", "conf"];

const COMMON_IGNORED_SEGMENTS: &[&str] = &[
    ".git",
    "target",
    "node_modules",
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
    "exe", "dll", "so", "dylib", "bin", "o", "a", "lib", "png", "jpg", "jpeg", "gif", "bmp",
    "ico", "mp3", "mp4", "wav", "avi", "mov", "mkv", "zip", "tar", "gz", "rar", "7z", "bz2",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "wasm", "class", "jar", "pyc", "pyo",
    "lockb",
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
        .map(|ext| SOURCE_EXTENSIONS.contains(&ext.as_str()) || EXTENDED_EXTRA_EXTENSIONS.contains(&ext.as_str()))
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
        assert_eq!(ScanProfile::Extended.max_batch_size(), 3);
        assert_eq!(ScanProfile::Full.max_batch_size(), 2);
    }

    #[test]
    fn parse_profile_from_str() {
        assert_eq!(ScanProfile::from_str("source").unwrap(), ScanProfile::Source);
        assert_eq!(ScanProfile::from_str("extended").unwrap(), ScanProfile::Extended);
        assert_eq!(ScanProfile::from_str("full").unwrap(), ScanProfile::Full);
        assert!(ScanProfile::from_str("invalid").is_err());
    }
}
