use reqwest::{Certificate, Client};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use std::fs;
use anyhow::{Result, Context};
use tracing::{debug, error};
use secrecy::{SecretString, ExposeSecret};
use crate::config;

#[derive(Debug, Clone)]
pub struct AiClient {
    provider_id: String,
    client: Client,
    base_url: String,
    model: String,
    api_key: SecretString,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Critique {
    pub file_path: String,
    pub severity: String, // "Info", "Warning", "Critical"
    pub message: String,
    pub suggestion: Option<String>,
    pub chat_message: Option<String>,
    pub suggested_diff: Option<String>,
}

impl AiClient {
    pub fn new(provider_id: String, base_url: String, model: String, api_key: SecretString) -> Result<Self> {
        let normalized = provider_id.trim().to_lowercase();
        let timeout_secs = config::provider_timeout_seconds(&normalized);

        let mut builder = Client::builder()
            .timeout(Duration::from_secs(timeout_secs));

        if let Some(cert_path) = config::provider_pinned_cert_path(&normalized) {
            let cert_bytes = fs::read(&cert_path)
                .with_context(|| format!("Failed to read pinned cert: {}", cert_path))?;
            let cert = Certificate::from_pem(&cert_bytes)
                .context("Failed to parse pinned certificate")?;
            builder = builder.add_root_certificate(cert);
        }

        let client = builder
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            provider_id: normalized,
            client,
            base_url,
            model,
            api_key,
        })
    }

    fn ensure_valid_api_key(&self) -> Result<()> {
        if config::is_placeholder_key(self.api_key.expose_secret()) && config::is_production() {
            anyhow::bail!("GUARDIAN_API_KEY is missing or still a placeholder");
        }
        Ok(())
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

    async fn send_chat(&self, system_prompt: &str, user_prompt: &str, json_mode: bool) -> Result<String> {
        let provider = self.provider_id.as_str();
        match provider {
            "ollama" => {
                let mut payload = json!({
                    "model": self.model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": user_prompt }
                    ],
                    "stream": false
                });
                if json_mode {
                    payload["format"] = json!("json");
                }
                let url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));
                let response = self.client.post(&url)
                    .header("Authorization", format!("Bearer {}", self.api_key.expose_secret()))
                    .json(&payload)
                    .send()
                    .await
                    .context("Failed to send request to AI provider")?;
                if !response.status().is_success() {
                    let error_text = response.text().await.unwrap_or_default();
                    anyhow::bail!("AI Request Failed: {}", error_text);
                }
                let response_json: serde_json::Value = response.json().await?;
                let content_str = response_json["message"]["content"]
                    .as_str()
                    .context("Invalid response format from AI")?;
                Ok(content_str.to_string())
            }
            "openai" => {
                let mut payload = json!({
                    "model": self.model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": user_prompt }
                    ],
                    "temperature": 0.2
                });
                if json_mode {
                    payload["response_format"] = json!({ "type": "json_object" });
                }
                let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
                let response = self.client.post(&url)
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
                Ok(content_str.to_string())
            }
            "anthropic" => {
                let payload = json!({
                    "model": self.model,
                    "max_tokens": 2048,
                    "system": system_prompt,
                    "messages": [
                        { "role": "user", "content": user_prompt }
                    ]
                });
                let url = format!("{}/messages", self.base_url.trim_end_matches('/'));
                let response = self.client.post(&url)
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
                Ok(collected)
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
                        { "role": "user", "parts": [{ "text": user_prompt }] }
                    ]
                });
                let url = format!("{}/{}:generateContent", self.base_url.trim_end_matches('/'), model_path);
                let response = self.client.post(&url)
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
                Ok(collected)
            }
            "github-models" => {
                let mut payload = json!({
                    "model": self.model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": user_prompt }
                    ]
                });
                if json_mode {
                    payload["response_format"] = json!({ "type": "json_object" });
                }
                let url = format!("{}/inference/chat/completions", self.base_url.trim_end_matches('/'));
                let response = self.client.post(&url)
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
                Ok(content_str.to_string())
            }
            other => anyhow::bail!("Provider '{}' is not supported.", other),
        }
    }

    pub async fn analyze_diff(&self, file_path: &str, diff: &str) -> Result<Critique> {
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

        let content_str = self.send_chat(system_prompt, &user_prompt, true).await?;

        // SANITIZATION: Remove markdown code blocks and any leading/trailing garbage
        let clean_json = Self::sanitize_json_response(&content_str);

        debug!(target: "guardian::ai", "AI response received (len={})", clean_json.len());

        // SECURITY: JSON Schema validation before deserialization
        if let Err(validation_errors) = crate::validation::validate_critique(clean_json) {
            error!(target: "guardian::ai", "JSON Schema validation failed for critique: {:?}", validation_errors);
            anyhow::bail!(
                "AI response failed security validation: {}. Raw content: {}",
                validation_errors.join("; "),
                &clean_json[..clean_json.len().min(500)]
            );
        }

        // SECURITY: Validate file_path content for injection attacks
        if let Err(e) = crate::validation::sanitize_string_content(file_path, "file_path") {
            error!(target: "guardian::ai", "File path sanitization failed: {}", e);
            anyhow::bail!("File path contains potentially dangerous content: {}", e);
        }

        let mut critique: Critique = serde_json::from_str(clean_json)
             .with_context(|| format!("Failed to parse AI JSON response. Raw content: {}", clean_json))?;

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

        // CRITICAL: Override AI's file_path with the actual system path we analyzed.
        // This prevents the AI from potentially returning a different path (path traversal attack)
        critique.file_path = file_path.to_string();
            
        Ok(critique)
    }

    pub async fn analyze_batch(&self, batch: Vec<(String, String)>) -> Result<Vec<Critique>> {
        self.ensure_valid_api_key()?;
        let system_prompt = r#"You are 'Guardian', a high-authority Senior Software Architect.
Your mission is to audit multiple files simultaneously for 'AI Smell', security risks, and architectural flaws.

GUIDELINES:
1. ANALYZE each file in the batch individually but consider their inter-dependencies.
2. BE STRICT: Catch SPAP v2.2 violations.
3. OUTPUT: A JSON Array of Critique objects. Each 'message' MUST include a WHY statement (risk/impact).
4. If a file looks good, you CAN skip it in the output OR return a "LGTM" message.

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
        for (idx, (path, diff)) in batch.iter().enumerate() {
            user_prompt.push_str(&format!("--- FILE {} ---\nPath: {}\nContent:\n{}\n\n", idx + 1, path, diff));
        }

        let content_str = self.send_chat(system_prompt, &user_prompt, true).await?;

        let clean_json = Self::sanitize_json_response(&content_str);
        debug!(target: "guardian::ai", "AI batch response received (len={})", clean_json.len());

        // SECURITY: JSON Schema validation for batch response
        if let Err(validation_errors) = crate::validation::validate_batch_critiques(clean_json) {
            error!(target: "guardian::ai", "JSON Schema validation failed for batch: {:?}", validation_errors);
            anyhow::bail!(
                "AI batch response failed security validation: {}. Raw content preview: {}",
                validation_errors.join("; "),
                &clean_json[..clean_json.len().min(500)]
            );
        }

        let critiques = parse_batch_json(&content_str, clean_json)
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
                    if let Err(e) = crate::validation::sanitize_string_content(diff, "suggested_diff") {
                        error!(target: "guardian::ai", "Clearing dangerous suggested_diff: {}", e);
                        critique.suggested_diff = None;
                    }
                }

                Some(critique)
            })
            .collect();

        Ok(sanitized_critiques)
    }

    pub async fn ask_question(&self, context: &str, query: &str) -> Result<String> {
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
    4. ACCURACY: Do not invent file contents. If missing, say so and ask for the specific file/lines.\n\
       If using general knowledge, prefix with: 'Based on general best practices...'.\n\
    5. ACTIONABILITY: When proposing a code change, include a minimal patch/diff.\n\
    6. BREVITY: Be concise. Focus on the fix and the rationale.";

        let user_prompt = format!("Context:\n{}\n\nQuestion: {}", context, query);

        let content = self.send_chat(system_prompt, &user_prompt, false).await?;
        Ok(content)
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

fn extract_json_window<'a>(content: &'a str, open: char, close: char) -> Option<&'a str> {
    let start = content.find(open)?;
    let end = content.rfind(close)?;
    if start <= end {
        Some(&content[start..=end])
    } else {
        None
    }
}
