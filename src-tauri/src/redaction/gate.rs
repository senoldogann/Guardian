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
        if SENSITIVE_EXTS
            .iter()
            .any(|&s| ext.eq_ignore_ascii_case(s))
        {
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

        static ref PRIVATE_KEY_BLOCK: Regex = Regex::new(r"(?s)-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----.*?-----END[ A-Z0-9_-]*PRIVATE KEY-----").unwrap();
        static ref JWT: Regex = Regex::new(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b").unwrap();

        static ref EMAIL_RE: Regex =
            Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
        static ref PHONE_RE: Regex = Regex::new(
            r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
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

    filtered = DATABASE_URL
        .replace_all(&filtered, "[REDACTED_DATABASE_URL]")
        .to_string();

    filtered = KV_SECRET_DOUBLE
        .replace_all(&filtered, r#"$1$2"[REDACTED_SECRET]""#)
        .to_string();
    filtered = KV_SECRET_SINGLE
        .replace_all(&filtered, "$1$2'[REDACTED_SECRET]'")
        .to_string();

    filtered = EMAIL_RE.replace_all(&filtered, "[REDACTED_EMAIL]").to_string();
    filtered = PHONE_RE.replace_all(&filtered, "[REDACTED_PHONE]").to_string();

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
}
