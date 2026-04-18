use once_cell::sync::Lazy;
use regex::Regex;
use std::path::Path;

// ── API Keys ───────────────────────────────────────────────────
static OPENAI_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"\bsk-[A-Za-z0-9]{20,}\b").unwrap());
static OPENAI_PROJECT_KEY: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bsk-proj-[A-Za-z0-9]{20,}\b").unwrap());
static ANTHROPIC_KEY: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bsk-ant-[A-Za-z0-9_-]{10,}\b").unwrap());
static GITHUB_TOKEN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{36}\b").unwrap());
static GITHUB_PAT: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b").unwrap());
static AWS_ACCESS_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"\bAKIA[0-9A-Z]{16}\b").unwrap());
static GCP_API_KEY: Lazy<Regex> = Lazy::new(|| Regex::new(r"\bAIzaSy[0-9A-Za-z_-]{33}\b").unwrap());
static STRIPE_KEY: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bsk_(?:live|test)_[0-9a-zA-Z]{24,}\b").unwrap());
static SLACK_TOKEN: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\bxox[bpars]-[0-9a-zA-Z-]{10,}\b").unwrap());
static NPM_TOKEN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\bnpm_[A-Za-z0-9]{20,}\b").unwrap());

// ── Structured Secrets ─────────────────────────────────────────
static PRIVATE_KEY_BLOCK: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?s)-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----.*?-----END[ A-Z0-9_-]*PRIVATE KEY-----")
        .unwrap()
});
static JWT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b").unwrap()
});
static KV_SECRET_DOUBLE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)\b(api[_-]?key|token|secret|password)\b(\s*[:=]\s*)"[^"]{6,}""#).unwrap()
});
static KV_SECRET_SINGLE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)\b(api[_-]?key|token|secret|password)\b(\s*[:=]\s*)'[^']{6,}'"#).unwrap()
});
static DATABASE_URL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s'"]+"#).unwrap()
});

// ── PII ────────────────────────────────────────────────────────
static EMAIL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}0-9-]{2,}").unwrap());
static PHONE_E164: Lazy<Regex> = Lazy::new(|| Regex::new(r"\+\d[\d\s().-]{6,}\d").unwrap());
static PHONE_NANP: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b").unwrap()
});

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

    // Structured secrets first (multi-line)
    out = PRIVATE_KEY_BLOCK
        .replace_all(&out, "[REDACTED_PRIVATE_KEY]")
        .to_string();
    out = JWT.replace_all(&out, "[REDACTED_JWT]").to_string();

    // API keys (specific patterns first, then generic)
    out = OPENAI_PROJECT_KEY
        .replace_all(&out, "[REDACTED_OPENAI_KEY]")
        .to_string();
    out = ANTHROPIC_KEY
        .replace_all(&out, "[REDACTED_ANTHROPIC_KEY]")
        .to_string();
    out = OPENAI_KEY
        .replace_all(&out, "[REDACTED_OPENAI_KEY]")
        .to_string();
    out = GITHUB_TOKEN
        .replace_all(&out, "[REDACTED_GITHUB_TOKEN]")
        .to_string();
    out = GITHUB_PAT
        .replace_all(&out, "[REDACTED_GITHUB_TOKEN]")
        .to_string();
    out = AWS_ACCESS_KEY
        .replace_all(&out, "[REDACTED_AWS_ACCESS_KEY]")
        .to_string();
    out = GCP_API_KEY
        .replace_all(&out, "[REDACTED_GCP_KEY]")
        .to_string();
    out = STRIPE_KEY
        .replace_all(&out, "[REDACTED_STRIPE_KEY]")
        .to_string();
    out = SLACK_TOKEN
        .replace_all(&out, "[REDACTED_SLACK_TOKEN]")
        .to_string();
    out = NPM_TOKEN
        .replace_all(&out, "[REDACTED_NPM_TOKEN]")
        .to_string();

    // KV secrets and database URLs
    out = DATABASE_URL
        .replace_all(&out, "[REDACTED_DATABASE_URL]")
        .to_string();
    out = KV_SECRET_DOUBLE
        .replace_all(&out, r#"$1$2"[REDACTED_SECRET]""#)
        .to_string();
    out = KV_SECRET_SINGLE
        .replace_all(&out, "$1$2'[REDACTED_SECRET]'")
        .to_string();

    // PII
    out = EMAIL.replace_all(&out, "[REDACTED_EMAIL]").to_string();
    out = PHONE_E164
        .replace_all(&out, |caps: &regex::Captures| {
            let raw = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            let digits = raw.chars().filter(|c| c.is_ascii_digit()).count();
            if (7..=15).contains(&digits) {
                "[REDACTED_PHONE]".to_string()
            } else {
                raw.to_string()
            }
        })
        .to_string();
    out = PHONE_NANP.replace_all(&out, "[REDACTED_PHONE]").to_string();

    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_email_addresses() {
        let input = "Contact: test@example.com";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_EMAIL]"));
        assert!(!out.contains("test@example.com"));
    }

    #[test]
    fn masks_openai_key() {
        let input = "key=sk-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_OPENAI_KEY]"));
    }

    #[test]
    fn masks_github_pat() {
        let token = format!("{}{}", "github_pat_", "a".repeat(35));
        let input = format!("GITHUB_TOKEN={token}");
        let out = mask_inline_secrets(&input);
        assert!(out.contains("[REDACTED_GITHUB_TOKEN]"));
    }

    #[test]
    fn masks_jwt() {
        let input = "token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_JWT]"));
    }

    #[test]
    fn masks_database_url() {
        let input = "DATABASE_URL=postgres://user:pass@host:5432/db";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_DATABASE_URL]"));
    }

    #[test]
    fn masks_gcp_key() {
        let input = format!("GCP_KEY={}{}", "AIzaSy", "A".repeat(33));
        let out = mask_inline_secrets(&input);
        assert!(out.contains("[REDACTED_GCP_KEY]"));
    }

    #[test]
    fn masks_stripe_key() {
        let token = format!("sk_{}_{}", "live", "a".repeat(24));
        let input = format!("STRIPE={token}");
        let out = mask_inline_secrets(&input);
        assert!(out.contains("[REDACTED_STRIPE_KEY]"));
    }

    #[test]
    fn masks_slack_token() {
        let token = format!("{}{}-{}-{}", "xox", "b", "1234567890", "abcdefghijklmn");
        let input = format!("SLACK={token}");
        let out = mask_inline_secrets(&input);
        assert!(out.contains("[REDACTED_SLACK_TOKEN]"));
    }

    #[test]
    fn masks_npm_token() {
        let input = "//registry.npmjs.org/:_authToken=npm_AbCdEfGhIjKlMnOpQrStUvWxYz123456789";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_NPM_TOKEN]"));
    }

    #[test]
    fn masks_private_key_block() {
        let input =
            "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK...\n-----END RSA PRIVATE KEY-----";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_PRIVATE_KEY]"));
        assert!(!out.contains("MIIEpAIBAAK"));
    }

    #[test]
    fn masks_kv_secret() {
        let input = r#"api_key = "super_secret_value_here""#;
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_SECRET]"));
        assert!(!out.contains("super_secret_value_here"));
    }

    #[test]
    fn masks_phone_nanp() {
        let input = "Call me: (555) 123-4567";
        let out = mask_inline_secrets(input);
        assert!(out.contains("[REDACTED_PHONE]"));
    }
}
