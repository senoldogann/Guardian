use std::path::Path;

/// Phase 0: Minimum redaction gate.
///
/// This module is intentionally conservative: it prefers masking over leaking.
pub fn is_sensitive_file(path: &Path) -> bool {
    const SENSITIVE_NAMES: &[&str] = &[
        ".env",
        ".env.local",
        ".env.production",
        ".npmrc",
        ".pypirc",
        ".htpasswd",
        "config.json",
        "secrets.yaml",
        "secrets.yml",
        ".credentials",
        "credentials.json",
        ".key",
        ".pem",
        ".p12",
        ".pfx",
        "id_rsa",
        "id_ed25519",
        "credentials",
        "secrets",
        ".secret",
        "docker-compose.override.yml",
        "docker-compose.override.yaml",
    ];
    const SENSITIVE_EXTS: &[&str] = &[
        "key", "pem", "p12", "pfx", "pkcs12", "jks", "keystore", "cer", "crt", "der",
    ];

    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
        if SENSITIVE_NAMES
            .iter()
            .any(|&name| file_name == name || file_name.ends_with(name))
        {
            return true;
        }
    }

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if SENSITIVE_EXTS.iter().any(|&s| ext.eq_ignore_ascii_case(s)) {
            return true;
        }
    }

    false
}

pub fn mask_inline_secrets(content: &str) -> String {
    use regex::Regex;

    lazy_static::lazy_static! {
        static ref OPENAI_KEY: Regex = Regex::new(r"\bsk-[A-Za-z0-9]{48}\b").unwrap();
        static ref OPENAI_PROJECT_KEY: Regex = Regex::new(r"\bsk-proj-[A-Za-z0-9]{20,}\b").unwrap();
        static ref ANTHROPIC_KEY: Regex = Regex::new(r"\bsk-ant-[A-Za-z0-9_-]{10,}\b").unwrap();

        static ref GITHUB_TOKEN: Regex =
            Regex::new(r"\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{36}\b").unwrap();
        static ref GITHUB_PAT: Regex = Regex::new(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b").unwrap();

        static ref AWS_ACCESS_KEY: Regex = Regex::new(r"\bAKIA[0-9A-Z]{16}\b").unwrap();

        static ref GCP_API_KEY: Regex = Regex::new(r"\bAIzaSy[0-9A-Za-z_-]{33}\b").unwrap();
        static ref STRIPE_KEY: Regex = Regex::new(r"\bsk_(?:live|test)_[0-9a-zA-Z]{24,}\b").unwrap();
        static ref SLACK_TOKEN: Regex = Regex::new(r"\bxox[bpars]-[0-9a-zA-Z-]{10,}\b").unwrap();
        static ref NPM_TOKEN: Regex = Regex::new(r"\bnpm_[A-Za-z0-9]{36}\b").unwrap();

        static ref PRIVATE_KEY_BLOCK: Regex = Regex::new(r"(?s)-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----.*?-----END[ A-Z0-9_-]*PRIVATE KEY-----").unwrap();
        static ref JWT: Regex = Regex::new(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b").unwrap();

        // Redaction is not validation; we bias toward masking while avoiding extremely broad matches.
        static ref EMAIL_RE: Regex =
            Regex::new(r"[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}0-9-]{2,}").unwrap();

        // E.164-ish: +<digits> with optional separators. We validate digit count in replacement.
        static ref PHONE_E164: Regex = Regex::new(r"\+\d[\d\s().-]{6,}\d").unwrap();
        // North America (NANP): requires separators/parentheses to reduce false positives.
        static ref PHONE_NANP: Regex = Regex::new(
            r"(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}\b"
        )
        .unwrap();
        // Turkey mobile: 05xx xxx xx xx (optional separators, optional leading 0).
        static ref PHONE_TR_MOBILE: Regex = Regex::new(
            r"\b0?5\d{2}[\s().-]?\d{3}[\s().-]?\d{2}[\s().-]?\d{2}\b"
        )
        .unwrap();

        // Rust's `regex` crate does not support backreferences, so we match single/double quoted
        // secrets separately and preserve spacing/delimiter.
        static ref KV_SECRET_DOUBLE: Regex = Regex::new(
            r#"(?i)\b(api[_-]?key|token|secret|password)\b(\s*[:=]\s*)"[^"]{6,}""#
        )
        .unwrap();
        static ref KV_SECRET_SINGLE: Regex = Regex::new(
            r#"(?i)\b(api[_-]?key|token|secret|password)\b(\s*[:=]\s*)'[^']{6,}'"#
        )
        .unwrap();
        static ref DATABASE_URL: Regex = Regex::new(
            r#"(?i)\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s'"]+"#
        )
        .unwrap();
    }

    let mut filtered = content.to_string();

    filtered = PRIVATE_KEY_BLOCK
        .replace_all(&filtered, "[REDACTED_PRIVATE_KEY]")
        .to_string();
    filtered = JWT.replace_all(&filtered, "[REDACTED_JWT]").to_string();

    filtered = OPENAI_KEY
        .replace_all(&filtered, "[REDACTED_OPENAI_KEY]")
        .to_string();
    filtered = OPENAI_PROJECT_KEY
        .replace_all(&filtered, "[REDACTED_OPENAI_KEY]")
        .to_string();
    filtered = ANTHROPIC_KEY
        .replace_all(&filtered, "[REDACTED_ANTHROPIC_KEY]")
        .to_string();

    filtered = GITHUB_TOKEN
        .replace_all(&filtered, "[REDACTED_GITHUB_TOKEN]")
        .to_string();
    filtered = GITHUB_PAT
        .replace_all(&filtered, "[REDACTED_GITHUB_TOKEN]")
        .to_string();

    filtered = AWS_ACCESS_KEY
        .replace_all(&filtered, "[REDACTED_AWS_ACCESS_KEY]")
        .to_string();

    filtered = GCP_API_KEY
        .replace_all(&filtered, "[REDACTED_GCP_KEY]")
        .to_string();
    filtered = STRIPE_KEY
        .replace_all(&filtered, "[REDACTED_STRIPE_KEY]")
        .to_string();
    filtered = SLACK_TOKEN
        .replace_all(&filtered, "[REDACTED_SLACK_TOKEN]")
        .to_string();
    filtered = NPM_TOKEN
        .replace_all(&filtered, "[REDACTED_NPM_TOKEN]")
        .to_string();

    filtered = DATABASE_URL
        .replace_all(&filtered, "[REDACTED_DATABASE_URL]")
        .to_string();

    filtered = KV_SECRET_DOUBLE
        .replace_all(&filtered, r#"$1$2"[REDACTED_SECRET]""#)
        .to_string();
    filtered = KV_SECRET_SINGLE
        .replace_all(&filtered, "$1$2'[REDACTED_SECRET]'")
        .to_string();

    filtered = EMAIL_RE
        .replace_all(&filtered, "[REDACTED_EMAIL]")
        .to_string();
    filtered = PHONE_E164
        .replace_all(&filtered, |caps: &regex::Captures| {
            let raw = caps.get(0).map(|m| m.as_str()).unwrap_or("");
            let digits = raw.chars().filter(|c| c.is_ascii_digit()).count();
            if (7..=15).contains(&digits) {
                "[REDACTED_PHONE]".to_string()
            } else {
                raw.to_string()
            }
        })
        .to_string();
    filtered = PHONE_NANP
        .replace_all(&filtered, "[REDACTED_PHONE]")
        .to_string();
    filtered = PHONE_TR_MOBILE
        .replace_all(&filtered, "[REDACTED_PHONE]")
        .to_string();

    filtered
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn sensitive_file_detection() {
        assert!(is_sensitive_file(Path::new(".env")));
        assert!(is_sensitive_file(Path::new(".env.production")));
        assert!(is_sensitive_file(Path::new(".npmrc")));
        assert!(is_sensitive_file(Path::new(".pypirc")));
        assert!(is_sensitive_file(Path::new("id_ed25519")));
        assert!(is_sensitive_file(Path::new("secrets.txt.key")));
        assert!(is_sensitive_file(Path::new("cert.PEM")));
        assert!(is_sensitive_file(Path::new("docker-compose.override.yml")));
        assert!(is_sensitive_file(Path::new("foo.secret")));
        assert!(!is_sensitive_file(Path::new("src/main.rs")));
    }

    #[test]
    fn masks_generated_openai_like_keys() {
        let token = format!("sk-{}", "A".repeat(48));
        let input = format!("const key = \"{}\";", token);
        let masked = mask_inline_secrets(&input);
        assert!(masked.contains("[REDACTED_OPENAI_KEY]"));
        assert!(!masked.contains(&token));
    }

    #[test]
    fn masks_generated_github_like_tokens() {
        let token = format!("ghp_{}", "B".repeat(36));
        let input = format!("GITHUB_TOKEN='{}'", token);
        let masked = mask_inline_secrets(&input);
        assert!(masked.contains("[REDACTED_GITHUB_TOKEN]"));
        assert!(!masked.contains(&token));
    }

    #[test]
    fn masks_kv_secrets_and_email() {
        let input = "api_key = \"super-secret-value\"\ncontact: test@example.com\n";
        let masked = mask_inline_secrets(input);
        assert!(masked.contains("[REDACTED_SECRET]"));
        assert!(masked.contains("[REDACTED_EMAIL]"));
        assert!(!masked.contains("super-secret-value"));
        assert!(!masked.contains("test@example.com"));
    }

    #[test]
    fn masks_jwt_like_tokens() {
        let input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
        let masked = mask_inline_secrets(input);
        assert!(masked.contains("[REDACTED_JWT]"));
        assert!(!masked.contains("eyJhbGciOiJIUzI1Ni"));
    }

    #[test]
    fn masks_unicode_emails() {
        let input = "contact: çağrı@örnek.com and test@xn--rnek-0ra.com";
        let masked = mask_inline_secrets(input);
        assert!(masked.contains("[REDACTED_EMAIL]"));
        assert!(!masked.contains("çağrı@örnek.com"));
        assert!(!masked.contains("test@xn--rnek-0ra.com"));
    }

    #[test]
    fn masks_phone_numbers_international_and_tr() {
        let input = "Call +90 532 123 45 67, 0532 123 45 67, or (415) 555-2671";
        let masked = mask_inline_secrets(input);
        let count = masked.matches("[REDACTED_PHONE]").count();
        assert!(
            count >= 3,
            "expected 3 phone redactions, got {count}: {masked}"
        );
        assert!(!masked.contains("+90 532 123 45 67"));
        assert!(!masked.contains("0532 123 45 67"));
        assert!(!masked.contains("(415) 555-2671"));
    }

    #[test]
    fn masks_gcp_api_key() {
        let token = format!("{}{}", "AIzaSy", "A".repeat(33));
        let input = format!("const key = \"{token}\";");
        let result = mask_inline_secrets(&input);
        assert!(result.contains("[REDACTED_GCP_KEY]"), "GCP key not masked: {}", result);
        assert!(!result.contains("AIzaSy"), "GCP key leaked: {}", result);
    }

    #[test]
    fn masks_stripe_key() {
        let token = format!("sk_{}_{}", "live", "a".repeat(24));
        let input = format!("STRIPE_KEY={token}");
        let result = mask_inline_secrets(&input);
        assert!(result.contains("[REDACTED_STRIPE_KEY]"), "Stripe key not masked: {}", result);
    }

    #[test]
    fn masks_slack_token() {
        let token = format!("{}{}-{}-{}", "xox", "b", "1234567890", "abcdefghijklmn");
        let input = format!("token: {token}");
        let result = mask_inline_secrets(&input);
        assert!(result.contains("[REDACTED_SLACK_TOKEN]"), "Slack token not masked: {}", result);
    }

    #[test]
    fn masks_npm_token() {
        let input = "//registry.npmjs.org/:_authToken=npm_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";
        let result = mask_inline_secrets(input);
        assert!(result.contains("[REDACTED_NPM_TOKEN]"), "npm token not masked: {}", result);
    }
}
