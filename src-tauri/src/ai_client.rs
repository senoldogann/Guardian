use crate::config;
use anyhow::{Context, Result};
use once_cell::sync::Lazy;
use reqwest::{Certificate, Client};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::Mutex;
use std::sync::Arc;
use std::time::Duration;
use std::time::Instant;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tracing::{debug, error, warn};

#[derive(Debug, Clone)]
pub struct AiClient {
    provider_id: String,
    client: Client,
    base_url: String,
    model: String,
    api_key: SecretString,
    queue: Arc<QueueManager>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiRequestClass {
    Audit,
    Guru,
}

#[derive(Debug, Clone)]
pub struct AiCall<T> {
    pub value: T,
    pub queue_wait_ms: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Critique {
    pub file_path: String,
    pub severity: String, // "Info", "Warning", "Critical"
    pub message: String,
    pub suggestion: Option<String>,
    pub chat_message: Option<String>,
    pub suggested_diff: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finding_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub why: Option<String>,
}

const DEFAULT_AI_REQUEST_CONCURRENCY_CLOUD: usize = 1;
const DEFAULT_AI_REQUEST_CONCURRENCY_LOCAL: usize = 2;
const AI_QUEUE_WAIT_TIMEOUT_AUDIT_SECS: u64 = 120;
const AI_QUEUE_WAIT_TIMEOUT_GURU_SECS: u64 = 300;

#[derive(Debug)]
struct QueueManager {
    global: Arc<Semaphore>,
    audit_lane: Arc<Semaphore>,
}

#[derive(Debug)]
struct RequestSlot {
    _global: OwnedSemaphorePermit,
    _audit: Option<OwnedSemaphorePermit>,
    queue_wait_ms: u64,
}

impl QueueManager {
    fn new(global_concurrency: usize) -> Self {
        Self {
            global: Arc::new(Semaphore::new(global_concurrency.max(1))),
            audit_lane: Arc::new(Semaphore::new(1)),
        }
    }

    async fn acquire(&self, class: AiRequestClass) -> Result<RequestSlot> {
        let start = Instant::now();

        let audit_permit = if class == AiRequestClass::Audit {
                    Some(
                        tokio::time::timeout(
                            Duration::from_secs(AI_QUEUE_WAIT_TIMEOUT_AUDIT_SECS),
                            self.audit_lane.clone().acquire_owned(),
                        )
                        .await
                        .context("AI audit lane queue timeout. Another audit is still in progress.")?
                        .context("AI audit lane queue is closed")?,
                    )
        } else {
            None
        };

        let global_timeout = if class == AiRequestClass::Guru {
            AI_QUEUE_WAIT_TIMEOUT_GURU_SECS
        } else {
            AI_QUEUE_WAIT_TIMEOUT_AUDIT_SECS
        };

        let global_permit = tokio::time::timeout(
            Duration::from_secs(global_timeout),
            self.global.clone().acquire_owned(),
        )
        .await
        .context("AI request queue timeout. Another request is still in progress.")?
        .context("AI request queue is closed")?;

        let queue_wait_ms = start.elapsed().as_millis() as u64;

        Ok(RequestSlot {
            _global: global_permit,
            _audit: audit_permit,
            queue_wait_ms,
        })
    }
}

static AI_QUEUE_MANAGERS: Lazy<Mutex<HashMap<String, Arc<QueueManager>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

static INVALID_ESCAPES_REPAIR_WARNED: AtomicBool = AtomicBool::new(false);
static INVALID_ESCAPES_REPAIR_BATCH_WARNED: AtomicBool = AtomicBool::new(false);

fn provider_effective_concurrency(provider_id: &str, _base_url: &str) -> usize {
    let is_local = provider_id == "mock"
        || provider_id == "ollama";

    if is_local {
        DEFAULT_AI_REQUEST_CONCURRENCY_LOCAL
    } else {
        DEFAULT_AI_REQUEST_CONCURRENCY_CLOUD
    }
}

fn configured_concurrency(provider_id: &str, base_url: &str) -> usize {
    std::env::var("GUARDIAN_AI_REQUEST_CONCURRENCY")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or_else(|| provider_effective_concurrency(provider_id, base_url))
}

fn queue_key(provider_id: &str, _base_url: &str) -> String {
    let locality = if provider_id == "mock" || provider_id == "ollama" {
        "local"
    } else {
        "cloud"
    };
    format!("{provider_id}::{locality}")
}

fn normalize_base_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

fn normalize_ollama_base_url(value: &str) -> String {
    let base = normalize_base_url(value);
    let Ok(mut url) = url::Url::parse(&base) else {
        return base;
    };
    let port = url.port_or_known_default();
    if url.scheme().starts_with("http") && url.host_str() == Some("127.0.0.1") && port == Some(11434) {
        let _ = url.set_host(Some("localhost"));
        return url.to_string().trim_end_matches('/').to_string();
    }
    base
}

impl AiClient {
    pub fn provider_id(&self) -> &str {
        &self.provider_id
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn model(&self) -> &str {
        &self.model
    }

    pub fn new(
        provider_id: String,
        base_url: String,
        model: String,
        api_key: SecretString,
    ) -> Result<Self> {
        let normalized = provider_id.trim().to_lowercase();
        let timeout_secs = config::provider_timeout_seconds(&normalized);

        let mut builder = Client::builder().timeout(Duration::from_secs(timeout_secs));

        if let Some(cert_path) = config::provider_pinned_cert_path(&normalized) {
            let cert_bytes = fs::read(&cert_path)
                .with_context(|| format!("Failed to read pinned cert: {}", cert_path))?;
            let cert =
                Certificate::from_pem(&cert_bytes).context("Failed to parse pinned certificate")?;
            builder = builder.add_root_certificate(cert);
        }

        let client = builder.build().context("Failed to build HTTP client")?;

        let base_url = if normalized == "ollama" {
            normalize_ollama_base_url(&base_url)
        } else {
            normalize_base_url(&base_url)
        };

        let key = queue_key(&normalized, &base_url);
        let concurrency = configured_concurrency(&normalized, &base_url);
        let queue = {
            let mut guard = AI_QUEUE_MANAGERS
                .lock()
                .map_err(|_| anyhow::anyhow!("AI queue manager lock poisoned"))?;
            guard
                .entry(key)
                .or_insert_with(|| Arc::new(QueueManager::new(concurrency)))
                .clone()
        };

        Ok(Self {
            provider_id: normalized,
            client,
            base_url,
            model,
            api_key,
            queue,
        })
    }

    fn ensure_valid_api_key(&self) -> Result<()> {
        if self.provider_id == "mock" || self.provider_id == "ollama" {
            return Ok(());
        }
        if config::is_placeholder_key(self.api_key.expose_secret()) && config::is_production() {
            anyhow::bail!("GUARDIAN_API_KEY is missing or still a placeholder");
        }
        Ok(())
    }

    async fn acquire_request_slot(&self, class: AiRequestClass) -> Result<RequestSlot> {
        if self.queue.global.available_permits() == 0 {
            debug!(
                target: "guardian::ai",
                "AI request queued (provider={}, model={}, class={:?})",
                self.provider_id,
                self.model,
                class
            );
        }
        self.queue.acquire(class).await
    }

    // Helper to strip Markdown code blocks
    fn sanitize_json_response(content: &str) -> &str {
        let start_brace = content.find('{');
        let start_bracket = content.find('[');

        let start = match (start_brace, start_bracket) {
            (Some(a), Some(b)) => std::cmp::min(a, b),
            (Some(a), None) => a,
            (None, Some(b)) => b,
            (None, None) => return content.trim(),
        };

        let end_brace = content.rfind('}');
        let end_bracket = content.rfind(']');

        let end = match (end_brace, end_bracket) {
            (Some(a), Some(b)) => std::cmp::max(a, b),
            (Some(a), None) => a,
            (None, Some(b)) => b,
            (None, None) => return content.trim(),
        };

        if start <= end {
            &content[start..=end]
        } else {
            content.trim()
        }
    }

    fn repair_invalid_json_escapes(content: &str) -> Option<String> {
        let mut output = String::with_capacity(content.len());
        let mut chars = content.chars().peekable();
        let mut in_string = false;
        let mut escaped = false;
        let mut changed = false;

        while let Some(ch) = chars.next() {
            if !in_string {
                if ch == '"' {
                    in_string = true;
                }
                output.push(ch);
                continue;
            }

            if escaped {
                output.push(ch);
                escaped = false;
                continue;
            }

            if ch == '\\' {
                let next = chars.peek().copied();
                let valid_escape = match next {
                    Some('"' | '\\' | '/' | 'b' | 'f' | 'n' | 'r' | 't') => true,
                    Some('u') => {
                        let mut lookahead = chars.clone();
                        lookahead.next();
                        let mut ok = true;
                        for _ in 0..4 {
                            match lookahead.next() {
                                Some(hex) if hex.is_ascii_hexdigit() => {}
                                _ => {
                                    ok = false;
                                    break;
                                }
                            }
                        }
                        ok
                    }
                    Some(_) | None => false,
                };

                if valid_escape {
                    output.push(ch);
                    escaped = true;
                } else {
                    output.push('\\');
                    output.push('\\');
                    changed = true;
                }
                continue;
            }

            if ch == '\r' || ch == '\n' || ch == '\t' {
                output.push('\\');
                output.push(match ch {
                    '\r' => 'r',
                    '\n' => 'n',
                    _ => 't',
                });
                changed = true;
                continue;
            }

            if ch == '"' {
                in_string = false;
            }
            output.push(ch);
        }

        if changed {
            Some(output)
        } else {
            None
        }
    }

    async fn send_chat(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        json_mode: bool,
        class: AiRequestClass,
    ) -> Result<AiCall<String>> {
        let request_slot = self.acquire_request_slot(class).await?;
        let queue_wait_ms = request_slot.queue_wait_ms;
        let safe_user_prompt = crate::redaction::gate::mask_inline_secrets(user_prompt);
        let provider = self.provider_id.as_str();
        match provider {
            "mock" => {
                if json_mode {
                    let is_batch = system_prompt.contains("JSON ARRAY MODE")
                        || safe_user_prompt.starts_with("Batch Analysis Request");
                    if is_batch {
                        return Ok(AiCall {
                            value: "[]".to_string(),
                            queue_wait_ms,
                        });
                    }
                    return Ok(AiCall {
                        value: r#"{"file_path":"src/mock.ts","severity":"Info","message":"LGTM","suggestion":null,"chat_message":null,"suggested_diff":null}"#
                            .to_string(),
                        queue_wait_ms,
                    });
                }

                Ok(AiCall {
                    value: "MOCK: OK".to_string(),
                    queue_wait_ms,
                })
            }
            "ollama" => {
                let mut payload = json!({
                    "model": self.model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": safe_user_prompt }
                    ],
                    "stream": false
                });
                if json_mode {
                    payload["format"] = json!("json");
                }
                let token = self.api_key.expose_secret().trim();
                let url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));
                let mut request = self.client.post(&url);
                if !config::is_placeholder_key(token) {
                    request = request.bearer_auth(token);
                }

                let response = request
                    .json(&payload)
                    .send()
                    .await
                    .with_context(|| format!("Failed to send request to AI provider (url={})", url))?;

                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("AI Request Failed: {}", error_text);
                }

                let response_json: serde_json::Value = response.json().await?;
                let content_str = response_json["message"]["content"]
                    .as_str()
                    .context("Invalid response format from AI")?;

                Ok(AiCall {
                    value: content_str.to_string(),
                    queue_wait_ms,
                })
            }
            "openai" => {
                let mut payload = json!({
                    "model": self.model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": safe_user_prompt }
                    ],
                    "temperature": 0.2
                });
                if json_mode {
                    payload["response_format"] = json!({ "type": "json_object" });
                }
                let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
                let response = self
                    .client
                    .post(&url)
                    .bearer_auth(self.api_key.expose_secret())
                    .json(&payload)
                    .send()
                    .await
                    .context("Failed to send OpenAI request")?;
                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("OpenAI request failed: {}", error_text);
                }
                let response_json: serde_json::Value = response.json().await?;
                let content_str = response_json["choices"][0]["message"]["content"]
                    .as_str()
                    .context("Invalid OpenAI response format")?;
                Ok(AiCall {
                    value: content_str.to_string(),
                    queue_wait_ms,
                })
            }
            "anthropic" => {
                let payload = json!({
                    "model": self.model,
                    "max_tokens": 2048,
                    "system": system_prompt,
                    "messages": [
                        { "role": "user", "content": safe_user_prompt }
                    ]
                });
                let url = format!("{}/messages", self.base_url.trim_end_matches('/'));
                let response = self
                    .client
                    .post(&url)
                    .header("x-api-key", self.api_key.expose_secret())
                    .header("anthropic-version", "2023-06-01")
                    .json(&payload)
                    .send()
                    .await
                    .context("Failed to send Anthropic request")?;
                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("Anthropic request failed: {}", error_text);
                }
                let response_json: serde_json::Value = response.json().await?;
                let content = response_json["content"]
                    .as_array()
                    .context("Invalid Anthropic response format")?;
                let mut collected = String::new();
                for block in content {
                    if let Some(text) = block["text"].as_str() {
                        collected.push_str(text);
                    }
                }
                Ok(AiCall {
                    value: collected,
                    queue_wait_ms,
                })
            }
            "gemini" => {
                let model_path = if self.model.starts_with("models/") {
                    self.model.clone()
                } else {
                    format!("models/{}", self.model)
                };
                let payload = json!({
                    "systemInstruction": {
                        "parts": [{ "text": system_prompt }]
                    },
                    "contents": [
                        { "role": "user", "parts": [{ "text": safe_user_prompt }] }
                    ]
                });
                let url = format!(
                    "{}/{}:generateContent",
                    self.base_url.trim_end_matches('/'),
                    model_path
                );
                let response = self
                    .client
                    .post(&url)
                    .header("x-goog-api-key", self.api_key.expose_secret())
                    .json(&payload)
                    .send()
                    .await
                    .context("Failed to send Gemini request")?;
                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("Gemini request failed: {}", error_text);
                }
                let response_json: serde_json::Value = response.json().await?;
                let candidates = response_json["candidates"]
                    .as_array()
                    .context("Invalid Gemini response format")?;
                let mut collected = String::new();
                if let Some(first) = candidates.first() {
                    if let Some(parts) = first["content"]["parts"].as_array() {
                        for part in parts {
                            if let Some(text) = part["text"].as_str() {
                                collected.push_str(text);
                            }
                        }
                    }
                }
                Ok(AiCall {
                    value: collected,
                    queue_wait_ms,
                })
            }
            "github-models" => {
                let mut payload = json!({
                    "model": self.model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": safe_user_prompt }
                    ]
                });
                if json_mode {
                    payload["response_format"] = json!({ "type": "json_object" });
                }
                let url = format!(
                    "{}/inference/chat/completions",
                    self.base_url.trim_end_matches('/')
                );
                let response = self
                    .client
                    .post(&url)
                    .header("accept", "application/vnd.github+json")
                    .header("x-github-api-version", "2022-11-28")
                    .bearer_auth(self.api_key.expose_secret())
                    .json(&payload)
                    .send()
                    .await
                    .context("Failed to send GitHub Models request")?;
                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("GitHub Models request failed: {}", error_text);
                }
                let response_json: serde_json::Value = response.json().await?;
                let content_str = response_json["choices"][0]["message"]["content"]
                    .as_str()
                    .context("Invalid GitHub Models response format")?;
                Ok(AiCall {
                    value: content_str.to_string(),
                    queue_wait_ms,
                })
            }
            other => anyhow::bail!("Provider '{}' is not supported.", other),
        }
    }

    pub async fn analyze_diff(&self, file_path: &str, diff: &str) -> Result<AiCall<Critique>> {
        self.ensure_valid_api_key()?;
        let system_prompt = r#"You are 'Guardian', a high-authority Senior Software Architect & Security Auditor.
Your mission is to find 'AI Smell' and critical architectural flaws in real-time.

GUIDELINES:
1. FOCUS on: Memory safety, logic flow, security vulnerabilities, and "AI Hallucinations" (using non-existent libraries or nonsensical patterns).
2. BE STRICT: Catch even subtle architectural violations of SPAP v2.2 (Sessiz hata yok, DRY, Separation of Concerns).
3. EXPLAIN THE 'WHY': The 'message' field MUST include a short WHY statement (risk/impact).
4. CHAT BRIDGE: If the code is dangerously wrong, use 'chat_message' to send a direct, urgent warning to the user.
5. FACT CHECKING: If you see a suspicious import or pattern that might be deprecated (e.g., 'moment.js' in 2026), you can request verify by outputting: "[WEB_SEARCH: requires verification for moment.js status]".
6. LGTM: Only if the code is truly production-ready by 2026 standards.

JSON MODE:
{
  "file_path": "string",
  "severity": "Info" | "Warning" | "Critical",
  "message": "Direct, punchy critique + 'Why'.",
  "suggestion": "Pragmatic fix.",
  "chat_message": "Crucial context for the human (Socratic guidance).",
  "suggested_diff": "FULL file content only (no diff markers, no markdown)."
}"#;

        let user_prompt = format!("File: {}\n\nDiff:\n{}\n\nNOTE: If you detect a logical violation of the current task/plan, call it out in 'message' and explain why in 'chat_message'.", file_path, diff);

        let response = self
            .send_chat(system_prompt, &user_prompt, true, AiRequestClass::Audit)
            .await?;
        let queue_wait_ms = response.queue_wait_ms;
        let content_str = response.value;

        // SANITIZATION: Remove markdown code blocks and any leading/trailing garbage
        let clean_json = Self::sanitize_json_response(&content_str);

        debug!(target: "guardian::ai", "AI response received (len={})", clean_json.len());

        let mut repaired_json: Option<String> = None;
        if let Err(validation_errors) = crate::validation::validate_critique(clean_json) {
            if validation_errors.iter().any(|e| e.contains("Invalid JSON syntax")) {
                if let Some(repaired) = Self::repair_invalid_json_escapes(clean_json) {
                    if crate::validation::validate_critique(&repaired).is_ok() {
                        if !INVALID_ESCAPES_REPAIR_WARNED.swap(true, AtomicOrdering::Relaxed) {
                            warn!(
                                target: "guardian::ai",
                                "AI JSON had invalid escapes; repaired for parsing."
                            );
                        } else {
                            debug!(
                                target: "guardian::ai",
                                "AI JSON had invalid escapes; repaired for parsing."
                            );
                        }
                        repaired_json = Some(repaired);
                    }
                }
            }

            if repaired_json.is_none() {
                error!(target: "guardian::ai", "JSON Schema validation failed for critique: {:?}", validation_errors);
                anyhow::bail!(
                    "AI response failed security validation: {}. Raw content: {}",
                    validation_errors.join("; "),
                    &clean_json[..clean_json.len().min(500)]
                );
            }
        }

        // SECURITY: Validate file_path content for injection attacks
        if let Err(e) = crate::validation::sanitize_string_content(file_path, "file_path") {
            error!(target: "guardian::ai", "File path sanitization failed: {}", e);
            anyhow::bail!("File path contains potentially dangerous content: {}", e);
        }

        let parse_target = repaired_json.as_deref().unwrap_or(clean_json);
        let mut critique: Critique = serde_json::from_str(parse_target).with_context(|| {
            format!(
                "Failed to parse AI JSON response. Raw content: {}",
                clean_json
            )
        })?;

        // SECURITY: Validate and sanitize string fields from AI response
        if let Err(e) = crate::validation::sanitize_string_content(&critique.message, "message") {
            error!(target: "guardian::ai", "Message field sanitization failed: {}", e);
            anyhow::bail!("AI response message contains dangerous content: {}", e);
        }

        if let Some(ref suggestion) = critique.suggestion {
            if let Err(e) = crate::validation::sanitize_string_content(suggestion, "suggestion") {
                error!(target: "guardian::ai", "Suggestion field sanitization failed: {}", e);
                critique.suggestion = None; // Clear dangerous suggestion rather than fail
            }
        }

        if let Some(ref chat_msg) = critique.chat_message {
            if let Err(e) = crate::validation::sanitize_string_content(chat_msg, "chat_message") {
                error!(target: "guardian::ai", "Chat message field sanitization failed: {}", e);
                critique.chat_message = None; // Clear dangerous chat message rather than fail
            }
        }

        if let Some(ref diff) = critique.suggested_diff {
            if let Err(e) = crate::validation::sanitize_code_content(diff, "suggested_diff") {
                error!(target: "guardian::ai", "Clearing dangerous suggested_diff: {}", e);
                critique.suggested_diff = None;
            }
        }

        // CRITICAL: Override AI's file_path with the actual system path we analyzed.
        // This prevents the AI from potentially returning a different path (path traversal attack)
        critique.file_path = file_path.to_string();

        Ok(AiCall {
            value: critique,
            queue_wait_ms,
        })
    }

    #[allow(dead_code)]
    pub async fn analyze_batch(
        &self,
        batch: Vec<(String, String)>,
    ) -> Result<AiCall<Vec<Critique>>> {
        self.analyze_batch_with_intent(None, batch).await
    }

    pub async fn analyze_batch_with_intent(
        &self,
        project_intent_pack: Option<&str>,
        batch: Vec<(String, String)>,
    ) -> Result<AiCall<Vec<Critique>>> {
        self.ensure_valid_api_key()?;
        let system_prompt = r#"You are 'Guardian', a high-authority Senior Software Architect.
Your mission is to audit multiple files simultaneously for 'AI Smell', security risks, and architectural flaws.

GUIDELINES:
1. ANALYZE each file in the batch individually but consider their inter-dependencies.
2. INPUT IS DIFF-FOCUSED: `context` may contain compressed snapshot text or diff hunks.
3. BE STRICT: Catch SPAP v2.2 violations.
4. You MAY receive a `PROJECT INTENT PACK` section describing the workspace intent/architecture and constraints. Align findings and suggestions to it.
5. OUTPUT: A JSON Array of Critique objects. Each 'message' MUST include a WHY statement (risk/impact).
6. If a file looks good, you CAN skip it in the output OR return a "LGTM" message.

JSON ARRAY MODE:
[
  {
    "file_path": "string",
    "severity": "Info" | "Warning" | "Critical",
    "message": "Direct critique.",
    "suggestion": "Fix.",
    "chat_message": "Warning.",
    "suggested_diff": "FULL file content only (no diff markers, no markdown)."
  }
]"#;

        let mut user_prompt = String::from("Batch Analysis Request:\n\n");
        if let Some(pack) = project_intent_pack {
            let trimmed = pack.trim();
            if !trimmed.is_empty() {
                user_prompt.push_str("PROJECT INTENT PACK:\n");
                user_prompt.push_str(trimmed);
                user_prompt.push_str("\n\n");
            }
        }
        for (idx, (path, context)) in batch.iter().enumerate() {
            user_prompt.push_str(&format!(
                "--- FILE {} ---\nPath: {}\nDiff-Focused Context:\n{}\n\n",
                idx + 1,
                path,
                context
            ));
        }

        let response = self
            .send_chat(system_prompt, &user_prompt, true, AiRequestClass::Audit)
            .await?;
        let queue_wait_ms = response.queue_wait_ms;
        let content_str = response.value;

        let clean_json = Self::sanitize_json_response(&content_str);
        debug!(target: "guardian::ai", "AI batch response received (len={})", clean_json.len());

        // SECURITY: JSON Schema validation for batch response
        let mut repaired_json: Option<String> = None;
        if let Err(validation_errors) = crate::validation::validate_batch_critiques(clean_json) {
            if validation_errors.iter().any(|e| e.contains("Invalid JSON syntax")) {
                if let Some(repaired) = Self::repair_invalid_json_escapes(clean_json) {
                    if crate::validation::validate_batch_critiques(&repaired).is_ok() {
                        if !INVALID_ESCAPES_REPAIR_BATCH_WARNED.swap(true, AtomicOrdering::Relaxed) {
                            warn!(
                                target: "guardian::ai",
                                "AI batch JSON had invalid escapes; repaired for parsing."
                            );
                        } else {
                            debug!(
                                target: "guardian::ai",
                                "AI batch JSON had invalid escapes; repaired for parsing."
                            );
                        }
                        repaired_json = Some(repaired);
                    }
                }
            }

            if repaired_json.is_none() {
                error!(target: "guardian::ai", "JSON Schema validation failed for batch: {:?}", validation_errors);
                anyhow::bail!(
                    "AI batch response failed security validation: {}. Raw content preview: {}",
                    validation_errors.join("; "),
                    &clean_json[..clean_json.len().min(500)]
                );
            }
        }

        let parse_target = repaired_json.as_deref().unwrap_or(clean_json);
        let critiques = parse_batch_json(&content_str, parse_target)
            .with_context(|| format!("Failed to parse Batch JSON. Raw: {}", clean_json))?;

        // SECURITY: Sanitize all critiques in the batch
        let sanitized_critiques: Vec<Critique> = critiques
            .into_iter()
            .filter_map(|mut critique| {
                // Validate message field
                if let Err(e) = crate::validation::sanitize_string_content(&critique.message, "message") {
                    error!(target: "guardian::ai", "Dropping critique with dangerous message: {}", e);
                    return None;
                }

                // Sanitize optional fields
                if let Some(ref suggestion) = critique.suggestion {
                    if let Err(e) = crate::validation::sanitize_string_content(suggestion, "suggestion") {
                        error!(target: "guardian::ai", "Clearing dangerous suggestion: {}", e);
                        critique.suggestion = None;
                    }
                }

                if let Some(ref chat_msg) = critique.chat_message {
                    if let Err(e) = crate::validation::sanitize_string_content(chat_msg, "chat_message") {
                        error!(target: "guardian::ai", "Clearing dangerous chat_message: {}", e);
                        critique.chat_message = None;
                    }
                }

                if let Some(ref diff) = critique.suggested_diff {
                    if let Err(e) = crate::validation::sanitize_code_content(diff, "suggested_diff") {
                        error!(target: "guardian::ai", "Clearing dangerous suggested_diff: {}", e);
                        critique.suggested_diff = None;
                    }
                }

                Some(critique)
            })
            .collect();

        Ok(AiCall {
            value: sanitized_critiques,
            queue_wait_ms,
        })
    }

    pub async fn ask_question(&self, context: &str, query: &str) -> Result<AiCall<String>> {
        self.ensure_valid_api_key()?;
        let system_prompt = "You are 'Guardian Guru', the Senior Software Architect for the Guardian desktop agent + cloud control panel.\n\
    Your goal is to deliver high-leverage, actionable guidance using ONLY the provided project context.\n\
    \n\
    PROJECT CONSTRAINTS:\n\
    - Desktop-first. Web is preview-only.\n\
    - Offline-first. Avoid internet calls for health checks; prefer local Tauri invokes.\n\
    - Metadata-only analysis (path + hash + severity). Do not propose reading file contents from the cloud.\n\
    - Security: Never expose or print secrets/tokens/keys. Prefer OS keychain/stronghold.\n\
    \n\
    CORE DIRECTIVES:\n\
    1. FORMATTING: Use Markdown. Use code blocks (```rs, ```ts, etc.) for examples.\n\
    2. CONTEXT: If AGENTS.md / PLAN* / CODEBASE / MODE / ARCHITECTURE are present, align with them.\n\
    3. TONE: Pragmatic, direct, authoritative but helpful. 'Staff Engineer' level communication.\n\
    4. ACCURACY: Do not invent file contents. If the file is outside the provided workspace or not present, say so explicitly and ask the user to select the correct workspace or provide the file.\n\
       If using general knowledge, prefix with: 'Based on general best practices...'.\n\
    5. ACTIONABILITY: When proposing a code change, include a minimal patch/diff. If the user explicitly asks for FULL updated file content only, comply with that format.\n\
    6. BREVITY: Be concise. Focus on the fix and the rationale.";

        let user_prompt = format!("Context:\n{}\n\nQuestion: {}", context, query);

        self.send_chat(system_prompt, &user_prompt, false, AiRequestClass::Guru)
            .await
    }
}

fn parse_batch_json(raw: &str, cleaned: &str) -> Result<Vec<Critique>> {
    if let Ok(items) = serde_json::from_str::<Vec<Critique>>(cleaned) {
        return Ok(items);
    }
    if let Ok(item) = serde_json::from_str::<Critique>(cleaned) {
        return Ok(vec![item]);
    }
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(cleaned) {
        if let Some(items) = critiques_from_value(&value) {
            return Ok(items);
        }
    }

    if let Some(window) = extract_json_window(raw, '[', ']') {
        if let Ok(items) = serde_json::from_str::<Vec<Critique>>(window) {
            return Ok(items);
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(window) {
            if let Some(items) = critiques_from_value(&value) {
                return Ok(items);
            }
        }
    }

    if let Some(window) = extract_json_window(raw, '{', '}') {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(window) {
            if let Some(items) = critiques_from_value(&value) {
                return Ok(items);
            }
        }
    }

    anyhow::bail!("AI response JSON is malformed or incomplete.")
}

fn critiques_from_value(value: &serde_json::Value) -> Option<Vec<Critique>> {
    if let Some(arr) = value.as_array() {
        let mut items = Vec::new();
        for entry in arr {
            if let Ok(c) = serde_json::from_value::<Critique>(entry.clone()) {
                items.push(c);
            }
        }
        if !items.is_empty() {
            return Some(items);
        }
    }

    if let Some(obj) = value.as_object() {
        if let Some(arr) = obj.get("critique").and_then(|v| v.as_array()) {
            let mut items = Vec::new();
            for entry in arr {
                if let Ok(c) = serde_json::from_value::<Critique>(entry.clone()) {
                    items.push(c);
                }
            }
            if !items.is_empty() {
                return Some(items);
            }
        }
        if let Some(arr) = obj.get("critiques").and_then(|v| v.as_array()) {
            let mut items = Vec::new();
            for entry in arr {
                if let Ok(c) = serde_json::from_value::<Critique>(entry.clone()) {
                    items.push(c);
                }
            }
            if !items.is_empty() {
                return Some(items);
            }
        }
    }

    None
}

fn extract_json_window(content: &str, open: char, close: char) -> Option<&str> {
    let start = content.find(open)?;
    let end = content.rfind(close)?;
    if start <= end {
        Some(&content[start..=end])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::AiClient;
    use super::{AiRequestClass, QueueManager};
    use std::time::Duration;

    #[test]
    fn test_repair_invalid_escape_sequence() {
        let raw = r#"{"message":"bad \q escape"}"#;
        assert!(serde_json::from_str::<serde_json::Value>(raw).is_err());

        let repaired = AiClient::repair_invalid_json_escapes(raw)
            .expect("Repair should return a corrected string");
        let parsed = serde_json::from_str::<serde_json::Value>(&repaired)
            .expect("Repaired JSON should parse");
        assert_eq!(parsed["message"].as_str(), Some("bad \\q escape"));
    }

    #[test]
    fn test_repair_unescaped_newline() {
        let raw = "{\"message\":\"line1\nline2\"}";
        assert!(serde_json::from_str::<serde_json::Value>(raw).is_err());

        let repaired = AiClient::repair_invalid_json_escapes(raw)
            .expect("Repair should return a corrected string");
        let parsed = serde_json::from_str::<serde_json::Value>(&repaired)
            .expect("Repaired JSON should parse");
        assert_eq!(parsed["message"].as_str(), Some("line1\nline2"));
    }

    #[tokio::test]
    async fn audit_lane_serializes_audits_and_allows_guru_parallel_on_local_concurrency() {
        let queue = QueueManager::new(2);
        let slot1 = queue.acquire(AiRequestClass::Audit).await.unwrap();

        // Guru can still proceed because global has a second permit and Guru does not use the audit lane.
        let guru = tokio::time::timeout(Duration::from_millis(200), queue.acquire(AiRequestClass::Guru)).await;
        assert!(guru.is_ok(), "Guru should not be blocked by an audit on local concurrency=2");

        // A second audit should be blocked by the audit lane.
        let audit2 =
            tokio::time::timeout(Duration::from_millis(200), queue.acquire(AiRequestClass::Audit)).await;
        assert!(audit2.is_err(), "Second audit must wait for audit lane permit");

        drop(slot1);
        let audit2 =
            tokio::time::timeout(Duration::from_millis(200), queue.acquire(AiRequestClass::Audit)).await;
        assert!(audit2.is_ok(), "Audit should proceed after first audit slot is released");
    }

    #[tokio::test]
    async fn cloud_concurrency_one_blocks_guru_until_audit_releases() {
        let queue = QueueManager::new(1);
        let slot1 = queue.acquire(AiRequestClass::Audit).await.unwrap();

        let guru =
            tokio::time::timeout(Duration::from_millis(200), queue.acquire(AiRequestClass::Guru)).await;
        assert!(
            guru.is_err(),
            "Guru must wait when global concurrency=1 and an audit is in flight"
        );

        drop(slot1);
        let guru =
            tokio::time::timeout(Duration::from_millis(200), queue.acquire(AiRequestClass::Guru)).await;
        assert!(
            guru.is_ok(),
            "Guru should proceed once the audit releases the global permit"
        );
    }
}
