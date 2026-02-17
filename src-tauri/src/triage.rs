use guardian_scan_policy::{is_infra_relevant_path, ScanProfile};
use once_cell::sync::Lazy;
use regex::Regex;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileKind {
    Source,
    Infra,
    Doc,
    Lock,
    Test,
    Other,
}

impl FileKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Source => "source",
            Self::Infra => "infra",
            Self::Doc => "doc",
            Self::Lock => "lock",
            Self::Test => "test",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone)]
pub struct TriageResult {
    pub risk_score: i64,
    pub signals: Vec<&'static str>,
    pub file_kind: FileKind,
}

pub const EXTENDED_NON_SOURCE_THRESHOLD: i64 = 30;
pub const FULL_NON_SOURCE_THRESHOLD: i64 = 30;
pub const FULL_DOC_TEST_THRESHOLD: i64 = 50;

pub fn should_audit(profile: ScanProfile, kind: FileKind, risk_score: i64) -> bool {
    match profile {
        ScanProfile::Source => true, // scan-policy already limits to source-like files
        ScanProfile::Extended => {
            if kind == FileKind::Source {
                true
            } else {
                risk_score >= EXTENDED_NON_SOURCE_THRESHOLD
            }
        }
        ScanProfile::Full => {
            if kind == FileKind::Source {
                true
            } else if kind == FileKind::Doc || kind == FileKind::Test {
                risk_score >= FULL_DOC_TEST_THRESHOLD
            } else {
                risk_score >= FULL_NON_SOURCE_THRESHOLD
            }
        }
    }
}

pub fn classify_file_kind(path: &Path) -> FileKind {
    let normalized = path.to_string_lossy().replace('\\', "/").to_lowercase();
    let file_name = normalized.rsplit('/').next().unwrap_or_default();

    if is_lock_file_name(file_name) {
        return FileKind::Lock;
    }

    if is_test_like_path(&normalized, file_name) {
        return FileKind::Test;
    }

    if is_doc_like_path(&normalized, file_name, path) {
        return FileKind::Doc;
    }

    if is_infra_relevant_path(path) || normalized.contains("/.github/workflows/") {
        return FileKind::Infra;
    }

    if is_source_extension(path) {
        return FileKind::Source;
    }

    FileKind::Other
}

pub fn triage(path: &Path, content: &str) -> TriageResult {
    static OPENAI_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"\bsk-[A-Za-z0-9]{48}\b").unwrap());
    static OPENAI_PROJECT_KEY: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\bsk-proj-[A-Za-z0-9]{20,}\b").unwrap());
    static ANTHROPIC_KEY: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\bsk-ant-[A-Za-z0-9_-]{10,}\b").unwrap());
    static GITHUB_TOKEN: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{36}\b").unwrap());
    static GITHUB_PAT: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b").unwrap());
    static AWS_ACCESS_KEY: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\bAKIA[0-9A-Z]{16}\b").unwrap());
    static PRIVATE_KEY_BLOCK: Lazy<Regex> = Lazy::new(|| {
        Regex::new(
            r"(?s)-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----.*?-----END[ A-Z0-9_-]*PRIVATE KEY-----",
        )
        .unwrap()
    });
    static DATABASE_URL: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r#"(?i)\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s'"]+"#).unwrap()
    });

    static CURL_PIPE_SH: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"(?i)\bcurl\s+[^\n]+\|\s*(sh|bash)\b").unwrap());
    static CHMOD_777: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\bchmod\s+777\b").unwrap());

    let kind = classify_file_kind(path);
    let lower = content.to_lowercase();

    let mut score: i64 = 0;
    let mut signals: Vec<&'static str> = Vec::new();

    let has_secret = OPENAI_KEY.is_match(content)
        || OPENAI_PROJECT_KEY.is_match(content)
        || ANTHROPIC_KEY.is_match(content)
        || GITHUB_TOKEN.is_match(content)
        || GITHUB_PAT.is_match(content)
        || AWS_ACCESS_KEY.is_match(content)
        || PRIVATE_KEY_BLOCK.is_match(content)
        || DATABASE_URL.is_match(content);
    if has_secret {
        score += 80;
        signals.push("secret_pattern");
    }

    if CURL_PIPE_SH.is_match(content) {
        score += 60;
        signals.push("curl_pipe_sh");
    }

    if lower.contains("--no-sandbox") || lower.contains("--disable-setuid-sandbox") {
        score += 35;
        signals.push("no_sandbox");
    }

    if lower.contains("--privileged") {
        score += 40;
        signals.push("privileged_container");
    }

    if CHMOD_777.is_match(&lower) {
        score += 25;
        signals.push("chmod_777");
    }

    if lower.contains("0.0.0.0") {
        score += 15;
        signals.push("bind_all_interfaces");
    }

    if kind == FileKind::Infra {
        if lower.contains("user root") {
            score += 35;
            signals.push("root_user");
        } else if is_dockerfile(path) && !lower.contains("\nuser ") {
            // Medium-signal best practice; doesn't trip gating alone.
            score += 15;
            signals.push("no_user_directive");
        }
    }

    score = score.clamp(0, 100);
    signals.sort();
    signals.dedup();

    TriageResult {
        risk_score: score,
        signals,
        file_kind: kind,
    }
}

fn is_dockerfile(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("dockerfile"))
        .unwrap_or(false)
}

fn is_lock_file_name(file_name: &str) -> bool {
    matches!(
        file_name,
        "package-lock.json"
            | "pnpm-lock.yaml"
            | "yarn.lock"
            | "cargo.lock"
            | "bun.lockb"
            | "poetry.lock"
            | "pipfile.lock"
    )
}

fn is_doc_like_path(normalized: &str, file_name: &str, path: &Path) -> bool {
    if matches!(file_name, "readme.md" | "changelog.md" | "license") {
        return true;
    }

    if normalized.contains("/docs/") || normalized.contains("/doc/") {
        return true;
    }

    matches!(
        path.extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).as_deref(),
        Some("md") | Some("rst") | Some("txt")
    )
}

fn is_test_like_path(normalized: &str, file_name: &str) -> bool {
    if normalized.contains("/tests/")
        || normalized.contains("/test/")
        || normalized.contains("/__tests__/")
        || normalized.contains("/__mocks__/")
    {
        return true;
    }

    file_name.contains(".test.")
        || file_name.contains(".spec.")
        || file_name.ends_with("_test.rs")
        || file_name.ends_with("_test.go")
        || file_name.ends_with("_spec.rb")
}

fn is_source_extension(path: &Path) -> bool {
    const SOURCE_EXTENSIONS: &[&str] = &[
        "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "go", "java", "kt", "swift", "cs",
        "rb", "php", "c", "cc", "cpp", "h", "hpp", "sql", "vue", "svelte",
    ];

    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .map(|ext| SOURCE_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn triage_detects_secrets() {
        let token = format!("sk-{}", "A".repeat(48));
        let input = format!("const key = \"{}\";", token);
        let res = triage(Path::new("src/main.ts"), &input);
        assert!(res.risk_score >= 80);
        assert!(res.signals.contains(&"secret_pattern"));
        assert_eq!(res.file_kind, FileKind::Source);
    }

    #[test]
    fn triage_detects_curl_pipe_sh() {
        let input = "curl https://example.com/install.sh | sh";
        let res = triage(Path::new("scripts/install.sh"), input);
        assert!(res.risk_score >= 60);
        assert!(res.signals.contains(&"curl_pipe_sh"));
        assert_eq!(res.file_kind, FileKind::Infra);
    }

    #[test]
    fn mixed_gate_matrix_behaves() {
        // Source: always audit.
        assert!(should_audit(ScanProfile::Source, FileKind::Source, 0));
        assert!(should_audit(ScanProfile::Source, FileKind::Doc, 0));

        // Extended: non-source needs risk.
        assert!(should_audit(
            ScanProfile::Extended,
            FileKind::Source,
            0
        ));
        assert!(!should_audit(
            ScanProfile::Extended,
            FileKind::Infra,
            EXTENDED_NON_SOURCE_THRESHOLD - 1
        ));
        assert!(should_audit(
            ScanProfile::Extended,
            FileKind::Infra,
            EXTENDED_NON_SOURCE_THRESHOLD
        ));

        // Full: docs/tests are stricter, other non-source uses the lower threshold.
        assert!(!should_audit(
            ScanProfile::Full,
            FileKind::Doc,
            FULL_DOC_TEST_THRESHOLD - 1
        ));
        assert!(should_audit(
            ScanProfile::Full,
            FileKind::Doc,
            FULL_DOC_TEST_THRESHOLD
        ));
        assert!(!should_audit(
            ScanProfile::Full,
            FileKind::Infra,
            FULL_NON_SOURCE_THRESHOLD - 1
        ));
        assert!(should_audit(
            ScanProfile::Full,
            FileKind::Infra,
            FULL_NON_SOURCE_THRESHOLD
        ));
    }
}

