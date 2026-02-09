use once_cell::sync::Lazy;
use regex::Regex;
use std::path::Path;

static OPENAI_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"sk-[A-Za-z0-9]{16,}").unwrap());
static GITHUB_TOKEN: Lazy<Regex> = Lazy::new(|| Regex::new(r"gh[pousr]_[A-Za-z0-9]{20,}").unwrap());
static ANTHROPIC_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"sk-ant-[A-Za-z0-9\\-_]{16,}").unwrap());
static AWS_ACCESS_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"AKIA[0-9A-Z]{16}").unwrap());
static EMAIL: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b").unwrap());

pub fn is_sensitive_file(path: &Path) -> bool {
    const SENSITIVE_NAMES: &[&str] = &[
        ".env",
        ".env.local",
        ".env.production",
        ".npmrc",
        ".pypirc",
        "id_rsa",
        "id_ed25519",
        "credentials",
        "secrets",
        "config.json",
        "secrets.yml",
        "secrets.yaml",
    ];
    const SENSITIVE_EXTS: &[&str] = &["key", "pem", "p12", "pfx", "cer", "crt", "der"];

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_lowercase();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_lowercase();

    if SENSITIVE_EXTS.iter().any(|e| ext == *e) {
        return true;
    }
    if SENSITIVE_NAMES.iter().any(|s| name.contains(s)) {
        return true;
    }

    false
}

pub fn mask_inline_secrets(content: &str) -> String {
    let mut out = content.to_string();

    if out.contains("-----BEGIN") && out.contains("PRIVATE KEY-----") {
        out = redact_private_key_blocks(&out);
    }

    out = OPENAI_KEY.replace_all(&out, "[REDACTED_OPENAI_KEY]").to_string();
    out = ANTHROPIC_KEY
        .replace_all(&out, "[REDACTED_ANTHROPIC_KEY]")
        .to_string();
    out = GITHUB_TOKEN
        .replace_all(&out, "[REDACTED_GITHUB_TOKEN]")
        .to_string();
    out = AWS_ACCESS_KEY
        .replace_all(&out, "[REDACTED_AWS_ACCESS_KEY]")
        .to_string();
    out = EMAIL.replace_all(&out, "[REDACTED_EMAIL]").to_string();

    out
}

fn redact_private_key_blocks(content: &str) -> String {
    let mut out = String::with_capacity(content.len());
    let mut in_block = false;
    for line in content.lines() {
        if line.contains("-----BEGIN") && line.contains("PRIVATE KEY-----") {
            in_block = true;
            out.push_str("[REDACTED_PRIVATE_KEY_BLOCK]\n");
            continue;
        }
        if in_block {
            if line.contains("-----END") && line.contains("PRIVATE KEY-----") {
                in_block = false;
            }
            continue;
        }
        out.push_str(line);
        out.push('\n');
    }
    out
}

