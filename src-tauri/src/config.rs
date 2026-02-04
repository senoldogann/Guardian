use std::env;
use anyhow::{Result, bail};

pub const DEFAULT_MODEL: &str = "gemini-3-flash-preview:cloud";
pub const DEFAULT_HOST: &str = "https://ollama.com";

const PLACEHOLDER_API_KEY: &str = "PLACEHOLDER_KEY";
const PLACEHOLDER_TAVILY_KEYS: [&str; 2] = ["PLACEHOLDER_TAVILY_1", "PLACEHOLDER_TAVILY_2"];
const PLACEHOLDER_GITHUB_CLIENT_ID: &str = "PLACEHOLDER_GITHUB_CLIENT_ID";
const PLACEHOLDER_GITHUB_CLIENT_SECRET: &str = "PLACEHOLDER_GITHUB_CLIENT_SECRET";

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

pub fn api_key() -> Result<String> {
    let key = env::var("GUARDIAN_API_KEY").unwrap_or_default();
    let trimmed = key.trim();

    if is_placeholder_key(trimmed) {
        if is_production() {
            bail!("GUARDIAN_API_KEY is missing or still a placeholder");
        }
        return Ok(trimmed.to_string());
    }

    Ok(trimmed.to_string())
}

pub fn tavily_keys() -> Result<Vec<String>> {
    let raw = env::var("TAVILY_API_KEYS").unwrap_or_default();
    let keys = raw
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !is_placeholder_key(s))
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    if keys.is_empty() && is_production() {
        bail!("TAVILY_API_KEYS is missing or still a placeholder");
    }

    Ok(keys)
}

pub fn github_client_id() -> Result<String> {
    let raw = env::var("GITHUB_CLIENT_ID").unwrap_or_default();
    let trimmed = raw.trim();

    if is_placeholder_key(trimmed) {
        if is_production() {
            bail!("GITHUB_CLIENT_ID is missing or still a placeholder");
        }
        return Ok(trimmed.to_string());
    }

    Ok(trimmed.to_string())
}

pub fn github_client_secret() -> Option<String> {
    let raw = env::var("GITHUB_CLIENT_SECRET").unwrap_or_default();
    let trimmed = raw.trim();

    if trimmed.is_empty() || is_placeholder_key(trimmed) {
        return None;
    }

    Some(trimmed.to_string())
}
