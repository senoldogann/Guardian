use anyhow::{bail, Result};
use keyring::{Entry, Error as KeyringError};
use secrecy::{ExposeSecret, SecretString};
use std::env;
use std::path::Path;

pub const DEFAULT_MODEL: &str = "gemini-3-flash-preview:cloud";
pub const DEFAULT_HOST: &str = "http://localhost:11434";

const PLACEHOLDER_API_KEY: &str = "PLACEHOLDER_KEY";
const PLACEHOLDER_TAVILY_KEYS: [&str; 2] = ["PLACEHOLDER_TAVILY_1", "PLACEHOLDER_TAVILY_2"];
const PLACEHOLDER_GITHUB_CLIENT_ID: &str = "PLACEHOLDER_GITHUB_CLIENT_ID";
const PLACEHOLDER_GITHUB_CLIENT_SECRET: &str = "PLACEHOLDER_GITHUB_CLIENT_SECRET";
const DEFAULT_GITHUB_CLIENT_ID: &str = "Ov23liQHOy4TmPsvqLxV";
const KEYCHAIN_SERVICE: &str = "guardian";
const KEYCHAIN_AI_ACCOUNT_LEGACY: &str = "ai_api_key";
const KEYCHAIN_TAVILY_ACCOUNT: &str = "tavily_api_key";
const KEYCHAIN_GITHUB_SECRET_ACCOUNT: &str = "github_client_secret";
const DEFAULT_TIMEOUT_SECS: u64 = 60;
const MIN_TIMEOUT_SECS: u64 = 5;
// Local providers (e.g. Ollama) can legitimately take longer for large prompts.
// Keep a sane upper bound to avoid hanging forever, but allow user override.
const MAX_TIMEOUT_SECS: u64 = 600;

// Watcher Configuration
pub const DEFAULT_MAX_BATCH_SIZE: usize = 3;
pub const DEFAULT_MAX_CONTENT_CHARS: usize = 6000;
pub const DEFAULT_MAX_CONTENT_LINES: usize = 220;
pub const DEFAULT_MIN_BATCH_INTERVAL_SECS: u64 = 2;
pub const DEFAULT_RATE_LIMIT_RETRIES: u32 = 2;
pub const DEFAULT_RATE_LIMIT_BACKOFF_SECS: u64 = 2;
pub const DEFAULT_MAX_FILE_BYTES: u64 = 512 * 1024; // 512KB

pub fn is_production() -> bool {
    !cfg!(debug_assertions)
}

pub fn is_placeholder_key(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.is_empty()
        || trimmed == PLACEHOLDER_API_KEY
        || PLACEHOLDER_TAVILY_KEYS.iter().any(|k| k == &trimmed)
        || trimmed == PLACEHOLDER_GITHUB_CLIENT_ID
        || trimmed == PLACEHOLDER_GITHUB_CLIENT_SECRET
        || trimmed.starts_with("PLACEHOLDER_")
}

fn normalize_provider_id(provider_id: &str) -> String {
    let trimmed = provider_id.trim().to_lowercase();
    if trimmed.is_empty() {
        "ollama".to_string()
    } else {
        trimmed
    }
}

fn ai_key_account(provider_id: &str) -> String {
    let id = normalize_provider_id(provider_id);
    format!("ai_api_key_{}", id)
}

fn ai_key_entry(provider_id: &str) -> Result<Entry> {
    let account = ai_key_account(provider_id);
    Entry::new(KEYCHAIN_SERVICE, &account).map_err(|e| anyhow::anyhow!(e.to_string()))
}

fn ai_key_entry_legacy() -> Result<Entry> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_AI_ACCOUNT_LEGACY)
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

fn tavily_key_entry() -> Result<Entry> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_TAVILY_ACCOUNT)
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

fn github_secret_entry() -> Result<Entry> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_GITHUB_SECRET_ACCOUNT)
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

fn parse_timeout_env(key: &str) -> Option<u64> {
    env::var(key).ok().and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            trimmed.parse::<u64>().ok()
        }
    })
}

fn clamp_timeout(value: u64) -> u64 {
    value.clamp(MIN_TIMEOUT_SECS, MAX_TIMEOUT_SECS)
}

fn non_empty_env(key: &str) -> Option<String> {
    env::var(key).ok().and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn load_env_file(path: &Path) {
    let _ = dotenvy::from_path(path);
}

pub fn load_runtime_env() {
    // Development mode: local project .env
    let _ = dotenvy::dotenv();

    // Installed app override: ~/.guardian/.env
    if let Some(home) = dirs::home_dir() {
        load_env_file(&home.join(".guardian").join(".env"));
    }

    // Portable override: executable sibling .env
    if let Ok(exe_path) = env::current_exe() {
        if let Some(dir) = exe_path.parent() {
            load_env_file(&dir.join(".env"));
        }
    }
}

pub fn provider_timeout_seconds(provider_id: &str) -> u64 {
    let default = parse_timeout_env("GUARDIAN_TIMEOUT_DEFAULT").unwrap_or(DEFAULT_TIMEOUT_SECS);
    let normalized = normalize_provider_id(provider_id);
    let env_key = format!(
        "GUARDIAN_TIMEOUT_{}",
        normalized.replace('-', "_").to_uppercase()
    );
    let provider_default = if normalized == "ollama" {
        // Ollama can be slower on consumer hardware; use a safer default than cloud.
        default.max(180)
    } else {
        default
    };
    let provider_timeout = parse_timeout_env(&env_key).unwrap_or(provider_default);
    clamp_timeout(provider_timeout)
}

pub fn provider_pinned_cert_path(provider_id: &str) -> Option<String> {
    let normalized = normalize_provider_id(provider_id);
    let env_key = format!(
        "GUARDIAN_TLS_PINNED_CERT_{}",
        normalized.replace('-', "_").to_uppercase()
    );
    non_empty_env(&env_key).or_else(|| non_empty_env("GUARDIAN_TLS_PINNED_CERT"))
}

pub fn set_user_api_key_for_provider(provider_id: &str, key: &str) -> Result<()> {
    let entry = ai_key_entry(provider_id)?;
    entry
        .set_password(key)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    if normalize_provider_id(provider_id) == "ollama" {
        if let Ok(legacy) = ai_key_entry_legacy() {
            let _ = legacy.set_password(key);
        }
    }
    Ok(())
}

pub fn clear_user_api_key_for_provider(provider_id: &str) -> Result<()> {
    let entry = ai_key_entry(provider_id)?;
    match entry.delete_password() {
        Ok(()) => {}
        Err(KeyringError::NoEntry) => {}
        Err(err) => return Err(anyhow::anyhow!(err.to_string())),
    }

    if normalize_provider_id(provider_id) == "ollama" {
        if let Ok(legacy) = ai_key_entry_legacy() {
            match legacy.delete_password() {
                Ok(()) => {}
                Err(KeyringError::NoEntry) => {}
                Err(err) => return Err(anyhow::anyhow!(err.to_string())),
            }
        }
    }
    Ok(())
}

pub fn user_api_key_for_provider(provider_id: &str) -> Result<Option<SecretString>> {
    let entry = ai_key_entry(provider_id)?;
    match entry.get_password() {
        Ok(token) => Ok(Some(SecretString::new(token.into()))),
        Err(KeyringError::NoEntry) => {
            if normalize_provider_id(provider_id) == "ollama" {
                if let Ok(legacy) = ai_key_entry_legacy() {
                    match legacy.get_password() {
                        Ok(token) => return Ok(Some(SecretString::new(token.into()))),
                        Err(KeyringError::NoEntry) => {}
                        Err(err) => return Err(anyhow::anyhow!(err.to_string())),
                    }
                }
            }
            Ok(None)
        }
        Err(err) => Err(anyhow::anyhow!(err.to_string())),
    }
}

pub fn set_user_tavily_key(key: &str) -> Result<()> {
    let entry = tavily_key_entry()?;
    entry
        .set_password(key)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(())
}

pub fn clear_user_tavily_key() -> Result<()> {
    let entry = tavily_key_entry()?;
    match entry.delete_password() {
        Ok(()) => {}
        Err(KeyringError::NoEntry) => {}
        Err(err) => return Err(anyhow::anyhow!(err.to_string())),
    }
    Ok(())
}

pub fn user_tavily_key() -> Result<Option<SecretString>> {
    let entry = tavily_key_entry()?;
    match entry.get_password() {
        Ok(token) => Ok(Some(SecretString::new(token.into()))),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(err) => Err(anyhow::anyhow!(err.to_string())),
    }
}

#[allow(dead_code)]
pub fn set_github_client_secret(secret: &str) -> Result<()> {
    let entry = github_secret_entry()?;
    entry
        .set_password(secret)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(())
}

pub fn env_api_key() -> SecretString {
    SecretString::new(env::var("GUARDIAN_API_KEY").unwrap_or_default().into())
}

pub fn api_key_for_provider(provider_id: &str) -> Result<SecretString> {
    if let Some(key) = user_api_key_for_provider(provider_id)? {
        let trimmed = key.expose_secret().trim();
        if !is_placeholder_key(trimmed) {
            return Ok(SecretString::new(trimmed.to_string().into()));
        }
    }

    bail!("User API key is missing. Set your own key in Settings.")
}

pub fn api_key_for_provider_or_empty(provider_id: &str) -> Result<SecretString> {
    if normalize_provider_id(provider_id) == "ollama" {
        if let Some(key) = user_api_key_for_provider(provider_id)? {
            let trimmed = key.expose_secret().trim();
            if !is_placeholder_key(trimmed) {
                return Ok(SecretString::new(trimmed.to_string().into()));
            }
        }
        return Ok(SecretString::new(String::new().into()));
    }

    api_key_for_provider(provider_id)
}

pub fn tavily_keys() -> Result<Vec<SecretString>> {
    let mut keys: Vec<SecretString> = Vec::new();
    if let Some(key) = user_tavily_key()? {
        let trimmed = key.expose_secret().trim();
        if !is_placeholder_key(trimmed) {
            keys.push(SecretString::new(trimmed.to_string().into()));
        }
    }

    // Optional env var fallback (useful for development / CI-like environments)
    // Supports comma or whitespace separated lists.
    for env_key in [
        "TAVILY_API_KEYS",
        "GUARDIAN_TAVILY_API_KEYS",
        "TAVILY_API_KEY",
        "GUARDIAN_TAVILY_API_KEY",
    ] {
        let raw = env::var(env_key).unwrap_or_default();
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }

        for part in trimmed.split(|c: char| c == ',' || c.is_whitespace()) {
            let candidate = part.trim();
            if candidate.is_empty() {
                continue;
            }
            if is_placeholder_key(candidate) {
                continue;
            }

            let already = keys
                .iter()
                .any(|k| k.expose_secret().trim() == candidate);
            if !already {
                keys.push(SecretString::new(candidate.to_string().into()));
            }
        }
    }

    if keys.is_empty() {
        bail!("Tavily API key is missing. Add your key in Settings to enable web search.");
    }

    Ok(keys)
}

pub fn github_client_id() -> Result<String> {
    for key in ["GITHUB_CLIENT_ID", "GUARDIAN_GITHUB_CLIENT_ID"] {
        let raw = env::var(key).unwrap_or_default();
        let trimmed = raw.trim();
        if !is_placeholder_key(trimmed) {
            return Ok(trimmed.to_string());
        }
    }

    let fallback = DEFAULT_GITHUB_CLIENT_ID.trim();
    if !is_placeholder_key(fallback) {
        return Ok(fallback.to_string());
    }

    if is_production() {
        bail!(
            "GITHUB_CLIENT_ID is missing. Set env var or create ~/.guardian/.env with GITHUB_CLIENT_ID=..."
        );
    }

    Ok(String::new())
}

pub fn github_client_secret() -> Option<SecretString> {
    // First check keyring
    if let Ok(entry) = github_secret_entry() {
        match entry.get_password() {
            Ok(secret) if !secret.trim().is_empty() => {
                return Some(SecretString::new(secret.into()));
            }
            _ => {}
        }
    }

    // Fallback to env var (only for development)
    for key in ["GITHUB_CLIENT_SECRET", "GUARDIAN_GITHUB_CLIENT_SECRET"] {
        let raw = env::var(key).unwrap_or_default();
        let trimmed = raw.trim();
        if !trimmed.is_empty() && !is_placeholder_key(trimmed) {
            // In production, warn about env var usage
            if is_production() {
                tracing::warn!(target: "guardian::config", "GITHUB_CLIENT_SECRET should be stored in keyring, not env var");
            }
            return Some(SecretString::new(trimmed.to_string().into()));
        }
    }
    None
}

pub fn max_batch_size() -> usize {
    match env::var("GUARDIAN_MAX_BATCH_SIZE") {
        Ok(val) => match val.parse::<usize>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_MAX_BATCH_SIZE value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_MAX_BATCH_SIZE
            }
        },
        Err(_) => DEFAULT_MAX_BATCH_SIZE,
    }
}

pub fn max_content_chars() -> usize {
    match env::var("GUARDIAN_MAX_CONTENT_CHARS") {
        Ok(val) => match val.parse::<usize>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_MAX_CONTENT_CHARS value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_MAX_CONTENT_CHARS
            }
        },
        Err(_) => DEFAULT_MAX_CONTENT_CHARS,
    }
}

pub fn max_content_lines() -> usize {
    match env::var("GUARDIAN_MAX_CONTENT_LINES") {
        Ok(val) => match val.parse::<usize>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_MAX_CONTENT_LINES value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_MAX_CONTENT_LINES
            }
        },
        Err(_) => DEFAULT_MAX_CONTENT_LINES,
    }
}

pub fn min_batch_interval_secs() -> u64 {
    match env::var("GUARDIAN_MIN_BATCH_INTERVAL_SECS") {
        Ok(val) => match val.parse::<u64>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_MIN_BATCH_INTERVAL_SECS value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_MIN_BATCH_INTERVAL_SECS
            }
        },
        Err(_) => DEFAULT_MIN_BATCH_INTERVAL_SECS,
    }
}

pub fn rate_limit_retries() -> u32 {
    match env::var("GUARDIAN_RATE_LIMIT_RETRIES") {
        Ok(val) => match val.parse::<u32>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_RATE_LIMIT_RETRIES value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_RATE_LIMIT_RETRIES
            }
        },
        Err(_) => DEFAULT_RATE_LIMIT_RETRIES,
    }
}

pub fn rate_limit_backoff_secs() -> u64 {
    match env::var("GUARDIAN_RATE_LIMIT_BACKOFF_SECS") {
        Ok(val) => match val.parse::<u64>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_RATE_LIMIT_BACKOFF_SECS value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_RATE_LIMIT_BACKOFF_SECS
            }
        },
        Err(_) => DEFAULT_RATE_LIMIT_BACKOFF_SECS,
    }
}

pub fn max_file_bytes() -> u64 {
    match env::var("GUARDIAN_MAX_FILE_BYTES") {
        Ok(val) => match val.parse::<u64>() {
            Ok(n) => n,
            Err(e) => {
                tracing::warn!(
                    "Invalid GUARDIAN_MAX_FILE_BYTES value '{}': {}. Using default.",
                    val,
                    e
                );
                DEFAULT_MAX_FILE_BYTES
            }
        },
        Err(_) => DEFAULT_MAX_FILE_BYTES,
    }
}
