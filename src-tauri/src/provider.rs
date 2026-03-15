use crate::config;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub const OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
pub const ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com/v1";
pub const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
pub const GITHUB_MODELS_BASE_URL: &str = "https://models.github.ai";
pub const OLLAMA_CLOUD_BASE_URL: &str = "https://ollama.com";
const OLLAMA_LOCALHOST_URL: &str = "http://localhost:11434";

fn normalize_provider_id(provider_id: &str) -> String {
    let trimmed = provider_id.trim().to_lowercase();
    if trimmed.is_empty() {
        "ollama".to_string()
    } else {
        trimmed
    }
}

fn default_base_url(provider_id: &str) -> &'static str {
    match normalize_provider_id(provider_id).as_str() {
        "openai" => OPENAI_BASE_URL,
        "anthropic" => ANTHROPIC_BASE_URL,
        "gemini" => GEMINI_BASE_URL,
        "github-models" => GITHUB_MODELS_BASE_URL,
        "ollama-cloud" => OLLAMA_CLOUD_BASE_URL,
        _ => config::DEFAULT_HOST,
    }
}

fn normalize_model_id(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .trim_start_matches("models/")
        .to_string()
}

fn filter_models(provider_id: &str, models: Vec<String>) -> Vec<String> {
    let id = normalize_provider_id(provider_id);
    if id == "ollama" {
        return models;
    }

    let mut filtered = Vec::new();
    for model in models.iter() {
        let normalized = normalize_model_id(model);
        let allowed = match id.as_str() {
            "openai" => {
                let blocked = [
                    "embedding",
                    "tts",
                    "whisper",
                    "audio",
                    "image",
                    "dall-e",
                    "moderation",
                    "realtime",
                    "speech",
                ];
                let is_chat = normalized.contains("gpt")
                    || normalized.starts_with("o1")
                    || normalized.starts_with("o3")
                    || normalized.contains("omni");
                let is_blocked = blocked.iter().any(|b| normalized.contains(b));
                is_chat && !is_blocked
            }
            "anthropic" => normalized.contains("claude"),
            "gemini" => normalized.contains("gemini") && !normalized.contains("embedding"),
            _ => true,
        };
        if allowed {
            filtered.push(model.clone());
        }
    }

    if filtered.is_empty() {
        models
    } else {
        filtered
    }
}

pub fn apply_defaults(mut config: ProviderConfig) -> ProviderConfig {
    config.provider_id = normalize_provider_id(&config.provider_id);
    if config.base_url.trim().is_empty() {
        config.base_url = default_base_url(&config.provider_id).to_string();
    }
    if config.provider_id == "ollama" {
        config.base_url = normalize_ollama_base_url(&config.base_url);
    }
    config
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider_id: String,
    pub base_url: String,
    pub model: String,
}

impl ProviderConfig {
    pub fn default() -> Self {
        Self {
            provider_id: "ollama".to_string(),
            base_url: config::DEFAULT_HOST.to_string(),
            model: config::DEFAULT_MODEL.to_string(),
        }
    }
}

fn provider_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(base.join("provider.json"))
}

pub fn load_provider_config(app: &AppHandle) -> Result<ProviderConfig, String> {
    let path = provider_config_path(app)?;
    if !path.exists() {
        return Ok(ProviderConfig::default());
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let parsed: ProviderConfig = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if parsed.provider_id.trim().is_empty() {
        return Ok(ProviderConfig::default());
    }
    Ok(apply_defaults(parsed))
}

pub fn save_provider_config(
    app: &AppHandle,
    config: ProviderConfig,
) -> Result<ProviderConfig, String> {
    let path = provider_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let payload = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(path, payload).map_err(|e| e.to_string())?;
    Ok(config)
}

pub fn resolve_provider_config(app: &AppHandle) -> Result<ProviderConfig, String> {
    let mut config = load_provider_config(app)?;
    config = apply_defaults(config);
    match config.provider_id.as_str() {
        "mock" => {
            let enabled = cfg!(debug_assertions)
                || std::env::var("GUARDIAN_MOCK")
                    .ok()
                    .is_some_and(|v| v.trim() == "1");
            if enabled {
                Ok(config)
            } else {
                Err(
                    "Provider 'mock' is only available when GUARDIAN_MOCK=1 (test/dev only)."
                        .to_string(),
                )
            }
        }
        "ollama" | "ollama-cloud" | "openai" | "anthropic" | "gemini" | "github-models" => {
            Ok(config)
        }
        other => Err(format!("Provider '{}' is not supported yet.", other)),
    }
}

#[derive(Debug, Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

pub async fn list_ollama_models(base_url: &str) -> Result<Vec<String>, String> {
    let client = Client::new();
    let base = normalize_ollama_base_url(base_url);
    let url = format!("{}/api/tags", base.trim_end_matches('/'));
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Model list failed: {}", response.status()));
    }

    let payload = response
        .json::<OllamaTagsResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let mut names = payload
        .models
        .into_iter()
        .map(|m| m.name)
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

fn normalize_base_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

fn normalize_ollama_base_url(base_url: &str) -> String {
    let base = normalize_base_url(base_url);
    if base.eq_ignore_ascii_case("http://127.0.0.1:11434") {
        OLLAMA_LOCALHOST_URL.to_string()
    } else {
        base
    }
}

#[derive(Debug, Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModel>,
}

#[derive(Debug, Deserialize)]
struct OpenAIModel {
    id: String,
}

pub async fn list_openai_models(base_url: &str, api_key: &str) -> Result<Vec<String>, String> {
    let base = base_url.trim_end_matches('/');
    let url = format!("{}/models", base);
    let client = Client::new();
    let response = client
        .get(url)
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Model list failed: {}", response.status()));
    }

    let payload = response
        .json::<OpenAIModelsResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let mut names = payload.data.into_iter().map(|m| m.id).collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

#[derive(Debug, Deserialize)]
struct AnthropicModelsResponse {
    data: Vec<AnthropicModel>,
}

#[derive(Debug, Deserialize)]
struct AnthropicModel {
    id: String,
}

pub async fn list_anthropic_models(base_url: &str, api_key: &str) -> Result<Vec<String>, String> {
    let base = base_url.trim_end_matches('/');
    let url = format!("{}/models", base);
    let client = Client::new();
    let response = client
        .get(url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Model list failed: {}", response.status()));
    }

    let payload = response
        .json::<AnthropicModelsResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let mut names = payload.data.into_iter().map(|m| m.id).collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

#[derive(Debug, Deserialize)]
struct GeminiModelsResponse {
    models: Vec<GeminiModel>,
}

#[derive(Debug, Deserialize)]
struct GeminiModel {
    name: String,
}

pub async fn list_gemini_models(base_url: &str, api_key: &str) -> Result<Vec<String>, String> {
    let base = base_url.trim_end_matches('/');
    let url = format!("{}/models", base);
    let client = Client::new();
    let response = client
        .get(url)
        .header("x-goog-api-key", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Model list failed: {}", response.status()));
    }

    let payload = response
        .json::<GeminiModelsResponse>()
        .await
        .map_err(|e| e.to_string())?;

    let mut names = payload
        .models
        .into_iter()
        .map(|m| m.name)
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

#[derive(Debug, Deserialize)]
struct GithubCatalogModel {
    id: String,
    supported_input_modalities: Option<Vec<String>>,
    supported_output_modalities: Option<Vec<String>>,
}

pub async fn list_github_models(base_url: &str, api_key: &str) -> Result<Vec<String>, String> {
    let base = base_url.trim_end_matches('/');
    let url = format!("{}/catalog/models", base);
    let client = Client::new();
    let response = client
        .get(url)
        .header("accept", "application/vnd.github+json")
        .header("x-github-api-version", "2022-11-28")
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Model list failed: {}", response.status()));
    }

    let payload = response
        .json::<Vec<GithubCatalogModel>>()
        .await
        .map_err(|e| e.to_string())?;

    let mut names = payload
        .into_iter()
        .filter(|model| {
            let input = model.supported_input_modalities.as_ref();
            let output = model.supported_output_modalities.as_ref();
            let input_ok = input.map(|m| m.iter().any(|v| v == "text")).unwrap_or(true);
            let output_ok = output
                .map(|m| m.iter().any(|v| v == "text"))
                .unwrap_or(true);
            input_ok && output_ok
        })
        .map(|m| m.id)
        .collect::<Vec<_>>();
    names.sort();
    names.dedup();
    Ok(names)
}

pub async fn list_provider_models(
    config: &ProviderConfig,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    let models = match config.provider_id.as_str() {
        "mock" => Ok(vec!["mock".to_string()]),
        "ollama" => list_ollama_models(&config.base_url).await,
        "ollama-cloud" => {
            // Ollama Cloud uses same API format but may require auth
            list_ollama_models(&config.base_url).await
        }
        "openai" => {
            let key = api_key.ok_or_else(|| "OpenAI API key missing.".to_string())?;
            list_openai_models(&config.base_url, &key).await
        }
        "anthropic" => {
            let key = api_key.ok_or_else(|| "Anthropic API key missing.".to_string())?;
            list_anthropic_models(&config.base_url, &key).await
        }
        "gemini" => {
            let key = api_key.ok_or_else(|| "Gemini API key missing.".to_string())?;
            list_gemini_models(&config.base_url, &key).await
        }
        "github-models" => {
            let key = api_key.ok_or_else(|| "GitHub Models token missing.".to_string())?;
            list_github_models(&config.base_url, &key).await
        }
        other => Err(format!("Provider '{}' is not supported.", other)),
    }?;

    let filtered = filter_models(&config.provider_id, models);
    Ok(filtered)
}
