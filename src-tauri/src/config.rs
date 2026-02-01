use std::env;
use anyhow::{Result, bail};

pub const DEFAULT_MODEL: &str = "gemini-3-flash-preview:cloud";
pub const DEFAULT_HOST: &str = "https://ollama.com";

const PLACEHOLDER_API_KEY: &str = "PLACEHOLDER_KEY";
const PLACEHOLDER_TAVILY_KEYS: [&str; 2] = ["PLACEHOLDER_TAVILY_1", "PLACEHOLDER_TAVILY_2"];

pub fn is_production() -> bool {
    !cfg!(debug_assertions)
}

pub fn is_placeholder_key(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.is_empty()
        || trimmed == PLACEHOLDER_API_KEY
        || PLACEHOLDER_TAVILY_KEYS.iter().any(|k| k == &trimmed)
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
