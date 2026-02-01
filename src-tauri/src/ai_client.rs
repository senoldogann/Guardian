use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use anyhow::{Result, Context};
use crate::config;

#[derive(Debug, Clone)]
pub struct OllamaClient {
    client: Client,
    base_url: String,
    model: String,
    api_key: String,
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

impl OllamaClient {
    pub fn new(base_url: String, model: String, api_key: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_default();
            
        Self {
            client,
            base_url,
            model,
            api_key,
        }
    }

    fn ensure_valid_api_key(&self) -> Result<()> {
        if config::is_placeholder_key(&self.api_key) && config::is_production() {
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

    pub async fn analyze_diff(&self, file_path: &str, diff: &str) -> Result<Critique> {
        self.ensure_valid_api_key()?;
        let system_prompt = r#"You are 'Guardian', a high-authority Senior Software Architect & Security Auditor.
Your mission is to find 'AI Smell' and critical architectural flaws in real-time.

GUIDELINES:
1. FOCUS on: Memory safety, logic flow, security vulnerabilities, and "AI Hallucinations" (using non-existent libraries or nonsensical patterns).
2. BE STRICT: Catch even subtle architectural violations of SPAP v2.2 (Sessiz hata yok, DRY, Separation of Concerns).
3. EXPLAIN THE 'WHY': In the 'message' field, don't just say what is wrong, briefly explain WHY it is a risk.
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
  "suggested_diff": "Replacement code blocks."
}"#;

        let user_prompt = format!("File: {}\n\nDiff:\n{}\n\nNOTE: If you detect a logical violation of the current task/plan, call it out in 'message' and explain why in 'chat_message'.", file_path, diff);

        let payload = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": false,
            "format": "json" // Force JSON mode
        });

        let url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));
        
        let response = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&payload)
            .send()
            .await
            .context("Failed to send request to AI provider")?;

        if !response.status().is_success() {
             let error_text = response.text().await.unwrap_or_default();
             anyhow::bail!("AI Request Failed: {}", error_text);
        }

        let response_json: serde_json::Value = response.json().await?;
        
        // Extract content from Ollama response structure
        let content_str = response_json["message"]["content"]
            .as_str()
            .context("Invalid response format from AI")?;

        // SANITIZATION: Remove markdown code blocks and any leading/trailing garbage
        let clean_json = Self::sanitize_json_response(content_str);

        eprintln!("[DEBUG] AI Response JSON: {}", clean_json);

        let mut critique: Critique = serde_json::from_str(clean_json)
             .with_context(|| format!("Failed to parse AI JSON response. Raw content: {}", clean_json))?;

        // CRITICAL: Override AI's file_path with the actual system path we analyzed.
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
3. OUTPUT: A JSON Array of Critique objects.
4. If a file looks good, you CAN skip it in the output OR return a "LGTM" message.

JSON ARRAY MODE:
[
  {
    "file_path": "string",
    "severity": "Info" | "Warning" | "Critical",
    "message": "Direct critique.",
    "suggestion": "Fix.",
    "chat_message": "Warning.",
    "suggested_diff": "Diff."
  }
]"#;

        let mut user_prompt = String::from("Batch Analysis Request:\n\n");
        for (idx, (path, diff)) in batch.iter().enumerate() {
            user_prompt.push_str(&format!("--- FILE {} ---\nPath: {}\nContent:\n{}\n\n", idx + 1, path, diff));
        }

        let payload = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": false,
            "format": "json"
        });

        let url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));
        
        // Retry logic for batching to be robust
        let response = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&payload)
            .send()
            .await
            .context("Failed to send batch request")?;

        if !response.status().is_success() {
             anyhow::bail!("Batch AI Request Failed: {}", response.status());
        }

        let response_json: serde_json::Value = response.json().await?;
        let content_str = response_json["message"]["content"]
            .as_str()
            .context("Invalid response format")?;

        let clean_json = Self::sanitize_json_response(content_str);
        eprintln!("[DEBUG] AI Batch Response JSON: {}", clean_json);

        // Parse as Array
        let critiques: Vec<Critique> = serde_json::from_str(clean_json)
             .or_else(|_| {
                 // Fallback: Try parsing as single object and wrapping in vec
                 serde_json::from_str::<Critique>(clean_json).map(|c| vec![c])
             })
             .with_context(|| format!("Failed to parse Batch JSON. Raw: {}", clean_json))?;

        Ok(critiques)
    }

    pub async fn ask_question(&self, context: &str, query: &str) -> Result<String> {
        self.ensure_valid_api_key()?;
        let system_prompt = "You are 'Guardian Guru', a concise senior software architect.\n\
    Answer the user's question based STRICTLY on the provided context.\n\
    If the answer is not in the context, say so briefly and offer general advice.\n\
    Style rules:\n\
    - No greetings or sign-offs.\n\
    - Plain text only (no Markdown, no headings, no bold, no code blocks).\n\
    - Use short sentences.\n\
    - Use '-' bullets only when listing items.\n\
    - Keep the response under 120 words unless the user explicitly asks for detail.";

        let user_prompt = format!("Context:\n{}\n\nQuestion: {}", context, query);

        let payload = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": false
        });

        let url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));

        let response = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&payload)
            .send()
            .await
            .context("Failed to send request to AI provider")?;

        if !response.status().is_success() {
             let error_text = response.text().await.unwrap_or_default();
             return Ok(format!("Guru is having trouble: {}", error_text));
        }

        let resp_json: serde_json::Value = response.json().await.unwrap_or_default();

        let answer = resp_json["message"]["content"]
            .as_str()
            .unwrap_or("No response from Guru.")
            .to_string();

        Ok(answer)
    }

}
