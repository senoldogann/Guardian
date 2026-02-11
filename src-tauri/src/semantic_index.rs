use crate::config;
use crate::storage::{SemanticMatch, SemanticVectorRecord, StorageManager};
use anyhow::Result;
use reqwest::Client;
use secrecy::ExposeSecret;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::{Arc, Mutex};
use tracing::{debug, warn};

const CANONICAL_EMBED_DIM: usize = 256;
const MAX_INDEX_TEXT_CHARS: usize = 8_000;
const MAX_PREVIEW_CHARS: usize = 280;
const DEFAULT_OPENAI_EMBED_MODEL: &str = "text-embedding-3-small";
const DEFAULT_OLLAMA_EMBED_MODEL: &str = "nomic-embed-text";
const DEFAULT_MATCH_LIMIT: usize = 5;
const MIN_SIMILARITY_THRESHOLD: f32 = 0.55;
const CRITICAL_SIMILARITY_THRESHOLD: f32 = 0.72;
static AUTO_OPENAI_KEY_MISSING_LOGGED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone)]
pub struct SemanticIndexInput {
    pub file_path: String,
    pub content_hash: String,
    pub critique_id: String,
    pub severity: String,
    pub text: String,
}

#[derive(Debug, Clone)]
pub struct SemanticIndexOutcome {
    pub file_path: String,
    pub critique_id: String,
    pub severity: String,
    pub source_mode: String,
    pub similar_critical: Vec<SemanticMatch>,
}

#[derive(Debug, Deserialize)]
struct OpenAIEmbeddingDatum {
    embedding: Vec<f32>,
}

#[derive(Debug, Deserialize)]
struct OpenAIEmbeddingResponse {
    data: Vec<OpenAIEmbeddingDatum>,
}

#[derive(Debug, Deserialize)]
struct OllamaEmbeddingResponse {
    embedding: Option<Vec<f32>>,
}

pub async fn index_entries_with_similarity(
    storage: Arc<Mutex<StorageManager>>,
    workspace: &str,
    entries: Vec<SemanticIndexInput>,
) -> Result<Vec<SemanticIndexOutcome>> {
    if entries.is_empty() {
        return Ok(Vec::new());
    }

    let mut out: Vec<SemanticIndexOutcome> = Vec::new();
    for entry in entries {
        let normalized_text = normalize_text(&entry.text);
        if normalized_text.is_empty() {
            continue;
        }

        let embedding = embed_text(&normalized_text).await;
        let record = SemanticVectorRecord {
            workspace: workspace.to_string(),
            file_path: entry.file_path.clone(),
            content_hash: entry.content_hash.clone(),
            critique_id: entry.critique_id.clone(),
            severity: entry.severity.clone(),
            embedding: embedding.vector.clone(),
            source_mode: embedding.source_mode.clone(),
            preview: build_preview(&normalized_text),
        };

        let similar_critical = {
            let Ok(storage_guard) = storage.lock() else {
                continue;
            };
            storage_guard.upsert_semantic_vector(&record)?;
            if entry.severity.eq_ignore_ascii_case("critical") {
                let mut matches = storage_guard.search_semantic_vectors(
                    workspace,
                    &embedding.vector,
                    4,
                    Some("Critical"),
                    Some(entry.content_hash.as_str()),
                    Some(entry.critique_id.as_str()),
                )?;
                matches.retain(|m| m.similarity >= CRITICAL_SIMILARITY_THRESHOLD);
                matches
            } else {
                Vec::new()
            }
        };

        out.push(SemanticIndexOutcome {
            file_path: entry.file_path,
            critique_id: entry.critique_id,
            severity: entry.severity,
            source_mode: embedding.source_mode,
            similar_critical,
        });
    }

    Ok(out)
}

pub async fn search_similar_for_query(
    storage: Arc<Mutex<StorageManager>>,
    workspace: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<SemanticMatch>> {
    let normalized = normalize_text(query);
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let embedding = embed_text(&normalized).await;
    let requested_limit = if limit == 0 {
        DEFAULT_MATCH_LIMIT
    } else {
        limit
    };
    let Ok(storage_guard) = storage.lock() else {
        return Ok(Vec::new());
    };
    let mut matches = storage_guard.search_semantic_vectors(
        workspace,
        &embedding.vector,
        requested_limit,
        None,
        None,
        None,
    )?;
    matches.retain(|m| m.similarity >= MIN_SIMILARITY_THRESHOLD);
    Ok(matches)
}

pub fn should_use_semantic_search(query: &str) -> bool {
    let q = query.to_lowercase();
    let triggers = [
        "benzer",
        "similar",
        "like this",
        "resemble",
        "kritik",
        "critical",
        "pattern",
        "örüntü",
        "semantik",
        "semantic",
    ];
    triggers.iter().any(|t| q.contains(t))
}

pub fn render_semantic_matches(matches: &[SemanticMatch]) -> String {
    if matches.is_empty() {
        return String::new();
    }

    let mut out = String::from("### Semantic Similarity Matches\n");
    for m in matches {
        out.push_str(&format!(
            "- `{}` [{}] similarity={:.2} ({})\n",
            m.file_path, m.severity, m.similarity, m.source_mode
        ));
        if !m.preview.is_empty() {
            out.push_str(&format!("  - preview: {}\n", m.preview));
        }
    }
    out.push('\n');
    out
}

struct EmbeddingResult {
    vector: Vec<f32>,
    source_mode: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EmbeddingExecutionPlan {
    LocalOnly,
    OllamaOnly,
    OpenAiOnly,
    AutoOpenAiFirst,
    AutoOllamaFirst,
}

fn configured_embed_mode() -> String {
    let preferred = std::env::var("GUARDIAN_EMBED_MODE")
        .ok()
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty());
    let legacy = std::env::var("GUARDIAN_EMBED_PROVIDER")
        .ok()
        .map(|v| v.trim().to_lowercase())
        .filter(|v| !v.is_empty());
    preferred.or(legacy).unwrap_or_else(|| "auto".to_string())
}

fn has_openai_embedding_key() -> bool {
    match config::user_api_key_for_provider("openai") {
        Ok(Some(key)) => {
            let trimmed = key.expose_secret().trim();
            !trimmed.is_empty() && !config::is_placeholder_key(trimmed)
        }
        _ => false,
    }
}

fn embedding_execution_plan(mode: &str, has_openai_key: bool) -> EmbeddingExecutionPlan {
    let normalized = mode.trim().to_lowercase();
    match normalized.as_str() {
        "local" | "local-hash" => EmbeddingExecutionPlan::LocalOnly,
        "ollama" => EmbeddingExecutionPlan::OllamaOnly,
        "openai" => EmbeddingExecutionPlan::OpenAiOnly,
        _ => {
            if has_openai_key {
                EmbeddingExecutionPlan::AutoOpenAiFirst
            } else {
                EmbeddingExecutionPlan::AutoOllamaFirst
            }
        }
    }
}

async fn embed_text(text: &str) -> EmbeddingResult {
    if is_offline_mode() {
        return EmbeddingResult {
            vector: local_hash_embedding(text),
            source_mode: "local-hash-fallback".to_string(),
        };
    }

    let mode = configured_embed_mode();
    let plan = embedding_execution_plan(&mode, has_openai_embedding_key());

    match plan {
        EmbeddingExecutionPlan::LocalOnly => EmbeddingResult {
            vector: local_hash_embedding(text),
            source_mode: "local-hash-manual".to_string(),
        },
        EmbeddingExecutionPlan::OllamaOnly => match embed_with_ollama(text).await {
            Ok(raw) => EmbeddingResult {
                vector: compress_embedding(&raw, CANONICAL_EMBED_DIM),
                source_mode: format!("ollama:{}", embedding_model_for("ollama")),
            },
            Err(err) => {
                warn!(target: "guardian::semantic", "Ollama embedding failed, falling back to local: {}", err);
                EmbeddingResult {
                    vector: local_hash_embedding(text),
                    source_mode: "local-hash-fallback".to_string(),
                }
            }
        },
        EmbeddingExecutionPlan::OpenAiOnly => match embed_with_openai(text).await {
            Ok(raw) => EmbeddingResult {
                vector: compress_embedding(&raw, CANONICAL_EMBED_DIM),
                source_mode: format!("openai:{}", embedding_model_for("openai")),
            },
            Err(err) => {
                warn!(target: "guardian::semantic", "OpenAI embedding failed, falling back to local: {}", err);
                EmbeddingResult {
                    vector: local_hash_embedding(text),
                    source_mode: "local-hash-fallback".to_string(),
                }
            }
        },
        EmbeddingExecutionPlan::AutoOpenAiFirst => match embed_with_openai(text).await {
            Ok(raw) => EmbeddingResult {
                vector: compress_embedding(&raw, CANONICAL_EMBED_DIM),
                source_mode: format!("openai:{}", embedding_model_for("openai")),
            },
            Err(openai_err) => {
                warn!(
                    target: "guardian::semantic",
                    "OpenAI embedding failed in auto mode, trying Ollama: {}",
                    openai_err
                );
                match embed_with_ollama(text).await {
                    Ok(raw) => EmbeddingResult {
                        vector: compress_embedding(&raw, CANONICAL_EMBED_DIM),
                        source_mode: format!("ollama:{}", embedding_model_for("ollama")),
                    },
                    Err(ollama_err) => {
                        warn!(
                            target: "guardian::semantic",
                            "Ollama embedding failed in auto mode, falling back to local: {}",
                            ollama_err
                        );
                        EmbeddingResult {
                            vector: local_hash_embedding(text),
                            source_mode: "local-hash-fallback".to_string(),
                        }
                    }
                }
            }
        },
        EmbeddingExecutionPlan::AutoOllamaFirst => {
            if !AUTO_OPENAI_KEY_MISSING_LOGGED.swap(true, AtomicOrdering::Relaxed) {
                debug!(
                    target: "guardian::semantic",
                    "Auto embedding: OpenAI key missing, skipping OpenAI and trying Ollama."
                );
            }

            match embed_with_ollama(text).await {
                Ok(raw) => EmbeddingResult {
                    vector: compress_embedding(&raw, CANONICAL_EMBED_DIM),
                    source_mode: format!("ollama:{}", embedding_model_for("ollama")),
                },
                Err(ollama_err) => {
                    warn!(
                        target: "guardian::semantic",
                        "Ollama embedding failed in auto mode, falling back to local: {}",
                        ollama_err
                    );
                    EmbeddingResult {
                        vector: local_hash_embedding(text),
                        source_mode: "local-hash-fallback".to_string(),
                    }
                }
            }
        }
    }
}

async fn embed_with_openai(text: &str) -> Result<Vec<f32>> {
    let key = config::api_key_for_provider("openai")?;
    let model = embedding_model_for("openai");
    let base_url = std::env::var("GUARDIAN_EMBED_BASE_URL_OPENAI")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(|| std::env::var("GUARDIAN_EMBED_BASE_URL").ok())
        .unwrap_or_else(|| crate::provider::OPENAI_BASE_URL.to_string());
    let url = format!("{}/embeddings", base_url.trim_end_matches('/'));

    let client = Client::new();
    let response = client
        .post(url)
        .bearer_auth(key.expose_secret())
        .json(&serde_json::json!({
            "model": model,
            "input": text,
        }))
        .send()
        .await?;

    if !response.status().is_success() {
        anyhow::bail!("OpenAI embeddings failed: {}", response.status());
    }

    let payload = response.json::<OpenAIEmbeddingResponse>().await?;
    let embedding = payload
        .data
        .first()
        .map(|d| d.embedding.clone())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow::anyhow!("OpenAI embedding response was empty"))?;
    Ok(embedding)
}

async fn embed_with_ollama(text: &str) -> Result<Vec<f32>> {
    let model = embedding_model_for("ollama");
    let base_url = std::env::var("GUARDIAN_EMBED_BASE_URL_OLLAMA")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(|| std::env::var("GUARDIAN_EMBED_BASE_URL").ok())
        .unwrap_or_else(|| config::DEFAULT_HOST.to_string());
    let url = format!("{}/api/embeddings", base_url.trim_end_matches('/'));

    let client = Client::new();
    let response = client
        .post(url)
        .json(&serde_json::json!({
            "model": model,
            "prompt": text,
        }))
        .send()
        .await?;

    if !response.status().is_success() {
        anyhow::bail!("Ollama embeddings failed: {}", response.status());
    }

    let payload = response.json::<OllamaEmbeddingResponse>().await?;
    let embedding = payload
        .embedding
        .filter(|v| !v.is_empty())
        .ok_or_else(|| anyhow::anyhow!("Ollama embedding response was empty"))?;
    Ok(embedding)
}

fn embedding_model_for(provider: &str) -> String {
    let key = match provider {
        "ollama" => "GUARDIAN_EMBED_MODEL_OLLAMA",
        _ => "GUARDIAN_EMBED_MODEL",
    };
    let default = match provider {
        "ollama" => DEFAULT_OLLAMA_EMBED_MODEL,
        _ => DEFAULT_OPENAI_EMBED_MODEL,
    };
    std::env::var(key)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| default.to_string())
}

fn is_offline_mode() -> bool {
    std::env::var("GUARDIAN_OFFLINE")
        .ok()
        .map(|v| v.trim() == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn normalize_text(text: &str) -> String {
    let mut trimmed = text.trim().to_string();
    if trimmed.len() > MAX_INDEX_TEXT_CHARS {
        trimmed.truncate(MAX_INDEX_TEXT_CHARS);
    }
    trimmed
}

fn build_preview(text: &str) -> String {
    let first_line = text.lines().next().unwrap_or("").trim();
    let mut preview = first_line.to_string();
    if preview.len() > MAX_PREVIEW_CHARS {
        preview.truncate(MAX_PREVIEW_CHARS);
        preview.push('…');
    }
    preview
}

fn compress_embedding(raw: &[f32], dim: usize) -> Vec<f32> {
    if raw.is_empty() {
        return vec![0.0; dim];
    }
    let mut out = vec![0.0f32; dim];
    for (idx, value) in raw.iter().enumerate() {
        out[idx % dim] += *value;
    }
    normalize_vector(out)
}

fn local_hash_embedding(text: &str) -> Vec<f32> {
    let mut out = vec![0.0f32; CANONICAL_EMBED_DIM];
    for token in text
        .split_whitespace()
        .map(|s| s.trim_matches(|c: char| !c.is_alphanumeric() && c != '_'))
        .filter(|s| !s.is_empty())
        .take(4096)
    {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        let hash = hasher.finalize();
        let idx = (((hash[0] as usize) << 8) | hash[1] as usize) % CANONICAL_EMBED_DIM;
        let sign = if hash[2] & 1 == 0 { 1.0 } else { -1.0 };
        let weight = 1.0 + (hash[3] as f32 / 255.0);
        out[idx] += sign * weight;
    }
    normalize_vector(out)
}

fn normalize_vector(mut vector: Vec<f32>) -> Vec<f32> {
    let norm = vector.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > f32::EPSILON {
        for v in &mut vector {
            *v /= norm;
        }
    }
    vector
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn local_embedding_is_deterministic() {
        let a = local_hash_embedding("sql injection in query builder");
        let b = local_hash_embedding("sql injection in query builder");
        assert_eq!(a.len(), CANONICAL_EMBED_DIM);
        assert_eq!(b.len(), CANONICAL_EMBED_DIM);
        assert_eq!(a, b);
    }

    #[test]
    fn auto_embedding_policy_without_openai_key_prefers_ollama() {
        assert_eq!(
            embedding_execution_plan("auto", false),
            EmbeddingExecutionPlan::AutoOllamaFirst
        );
    }

    #[test]
    fn auto_embedding_policy_with_openai_key_prefers_openai() {
        assert_eq!(
            embedding_execution_plan("auto", true),
            EmbeddingExecutionPlan::AutoOpenAiFirst
        );
    }

    #[test]
    fn explicit_ollama_mode_never_uses_openai_branch() {
        assert_eq!(
            embedding_execution_plan("ollama", false),
            EmbeddingExecutionPlan::OllamaOnly
        );
        assert_eq!(
            embedding_execution_plan("ollama", true),
            EmbeddingExecutionPlan::OllamaOnly
        );
    }

    #[tokio::test]
    async fn semantic_query_returns_indexed_match() {
        let temp = TempDir::new().unwrap();
        let storage = Arc::new(Mutex::new(
            StorageManager::init(temp.path().to_string_lossy().as_ref()).unwrap(),
        ));

        let entries = vec![SemanticIndexInput {
            file_path: "src/db.rs".to_string(),
            content_hash: "hash-1".to_string(),
            critique_id: "finding-1".to_string(),
            severity: "Critical".to_string(),
            text: "Raw SQL concatenation with user input".to_string(),
        }];

        let _ = index_entries_with_similarity(storage.clone(), "/tmp/ws", entries)
            .await
            .unwrap();

        let matches = search_similar_for_query(
            storage,
            "/tmp/ws",
            "Raw SQL concatenation with user input",
            3,
        )
        .await
        .unwrap();

        assert!(!matches.is_empty());
        assert_eq!(matches[0].file_path, "src/db.rs");
    }
}
