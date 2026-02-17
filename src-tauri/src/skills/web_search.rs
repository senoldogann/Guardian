use crate::config;
use once_cell::sync::Lazy;
use reqwest::Client;
use secrecy::ExposeSecret;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, Instant};
use tracing::{debug, warn};
use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchDepth {
    Auto,
    Basic,
    Advanced,
    Fast,
    UltraFast,
}

impl Default for SearchDepth {
    fn default() -> Self {
        Self::Basic
    }
}

impl SearchDepth {
    pub fn from_user_value(value: Option<&str>) -> Self {
        let raw = value.unwrap_or("").trim().to_lowercase();
        match raw.as_str() {
            "auto" => Self::Auto,
            "advanced" => Self::Advanced,
            "fast" => Self::Fast,
            "ultra-fast" | "ultrafast" | "ultra_fast" => Self::UltraFast,
            _ => Self::Basic,
        }
    }

    fn as_api_value(self, query: &str) -> &'static str {
        match self {
            Self::Auto => {
                if should_use_advanced_depth(query) {
                    "advanced"
                } else {
                    "basic"
                }
            }
            Self::Basic => "basic",
            Self::Advanced => "advanced",
            Self::Fast => "fast",
            Self::UltraFast => "ultra-fast",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct WebSearchOptions {
    pub depth: SearchDepth,
}

impl Default for WebSearchOptions {
    fn default() -> Self {
        Self {
            depth: SearchDepth::default(),
        }
    }
}

pub struct WebSearch {
    client: Client,
    rate_limiter: Arc<RateLimiter>,
}

struct RateLimiter {
    min_interval_ms: u64,
    start: Instant,
    last_request_ms: Mutex<u64>,
}

static GLOBAL_TAVILY_RATE_LIMITER: Lazy<Arc<RateLimiter>> = Lazy::new(|| {
    // Conservative global limiter: avoids 429 bursts when multiple Guru requests overlap.
    Arc::new(RateLimiter::new(1000))
});

impl RateLimiter {
    fn new(min_interval_ms: u64) -> Self {
        Self {
            min_interval_ms,
            start: Instant::now(),
            last_request_ms: Mutex::new(0),
        }
    }

    async fn check_and_wait(&self) {
        // Serialize callers so we don't violate rate limits under concurrent Guru requests.
        let mut last = self.last_request_ms.lock().await;
        let now_ms = self.start.elapsed().as_millis() as u64;

        if *last > 0 {
            let next_allowed = last.saturating_add(self.min_interval_ms);
            if now_ms < next_allowed {
                tokio::time::sleep(Duration::from_millis(next_allowed - now_ms)).await;
                *last = next_allowed;
                return;
            }
        }

        *last = now_ms;
    }
}

impl WebSearch {
    pub fn new() -> Result<Self, String> {
        let timeout_secs = config::provider_timeout_seconds("tavily");
        let mut builder = Client::builder().timeout(std::time::Duration::from_secs(timeout_secs));

        if let Some(cert_path) = config::provider_pinned_cert_path("tavily") {
            let cert_bytes = std::fs::read(&cert_path)
                .map_err(|e| format!("Failed to read pinned cert: {}", e))?;
            let cert = reqwest::Certificate::from_pem(&cert_bytes)
                .map_err(|e| format!("Failed to parse pinned certificate: {}", e))?;
            builder = builder.add_root_certificate(cert);
        }

        let client = builder
            .build()
            .map_err(|e| format!("Failed to build web search client: {}", e))?;

        let rate_limiter = GLOBAL_TAVILY_RATE_LIMITER.clone();

        Ok(Self {
            client,
            rate_limiter,
        })
    }

    pub async fn search(&self, query: &str) -> Result<String, String> {
        self.search_with_options(query, WebSearchOptions::default()).await
    }

    pub async fn search_with_options(
        &self,
        query: &str,
        options: WebSearchOptions,
    ) -> Result<String, String> {
        let search_url = "https://api.tavily.com/search";
        let extract_url = "https://api.tavily.com/extract";

        let keys = config::tavily_keys().map_err(|e| e.to_string())?;
        if keys.is_empty() {
            return Err("No valid Tavily API keys found.".to_string());
        }

        let (clean_query, truncated) = normalize_search_query(query, 400);
        if truncated {
            debug!(
                target: "guardian::search",
                "Tavily query truncated to 400 chars (original_len={})",
                query.chars().count()
            );
        }

        let urls = extract_urls(&clean_query);
        if !urls.is_empty() {
            let mut extract_query = strip_urls(&clean_query);
            if extract_query.is_empty() {
                extract_query = "Summarize the page and extract the key points.".to_string();
            }

            for (i, key) in keys.iter().enumerate() {
                debug!(
                    target: "guardian::search",
                    "Attempting extract with key #{} (urls={})",
                    i + 1,
                    urls.len()
                );

                self.rate_limiter.check_and_wait().await;

                let payload = json!({
                    "urls": urls,
                    "query": extract_query,
                    "extract_depth": "basic",
                    "chunks_per_source": 3,
                    "include_images": false,
                    "include_favicon": false,
                    "format": "markdown"
                });

                let response = self
                    .client
                    .post(extract_url)
                    .header(
                        reqwest::header::AUTHORIZATION,
                        format!("Bearer {}", key.expose_secret()),
                    )
                    .json(&payload)
                    .send()
                    .await;

                match response {
                    Ok(resp) => {
                        if resp.status().is_success() {
                            let json: serde_json::Value =
                                resp.json().await.map_err(|e| e.to_string())?;
                            let extracted = render_extract_results(&json, 6000);
                            if extracted.is_empty() {
                                return Ok("No relevant extracted content found.".to_string());
                            }
                            return Ok(extracted);
                        } else if resp.status().as_u16() == 429 {
                            warn!(
                                target: "guardian::search",
                                "Key #{} rate limited on extract, switching",
                                i + 1
                            );
                            continue;
                        } else {
                            warn!(
                                target: "guardian::search",
                                "Key #{} extract failed ({}), switching",
                                i + 1,
                                resp.status()
                            );
                        }
                    }
                    Err(e) => {
                        warn!(
                            target: "guardian::search",
                            "Connection error with key #{} (extract): {}",
                            i + 1,
                            e
                        );
                    }
                }
            }

            return Err("All Tavily API keys exhausted. Extract failed.".to_string());
        }

        let include_domains = extract_include_domains(&clean_query);
        let search_depth = options.depth.as_api_value(&clean_query);

        for (i, key) in keys.iter().enumerate() {
            debug!(target: "guardian::search", "Attempting search with key #{}", i + 1);

            // Apply rate limiting before each request
            self.rate_limiter.check_and_wait().await;

            let mut payload = json!({
                "query": clean_query,
                "search_depth": search_depth,
                "include_answer": true,
                "max_results": 5
            });

            if let Some(obj) = payload.as_object_mut() {
                if !include_domains.is_empty() {
                    obj.insert("include_domains".to_string(), json!(include_domains));
                }
                if search_depth == "advanced" {
                    obj.insert("chunks_per_source".to_string(), json!(3));
                }
            }

            // Tavily docs: auth via Bearer token header. Keep key out of request body/logs.
            let response = self
                .client
                .post(search_url)
                .header(
                    reqwest::header::AUTHORIZATION,
                    format!("Bearer {}", key.expose_secret()),
                )
                .json(&payload)
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let json: serde_json::Value =
                            resp.json().await.map_err(|e| e.to_string())?;

                        // Extract "answer" or summarize results
                        if let Some(answer) = json.get("answer").and_then(|a| a.as_str()) {
                            let sources = render_sources(&json, 3);
                            if sources.is_empty() {
                                return Ok(answer.to_string());
                            }
                            return Ok(format!("{answer}\n\nSources:\n{sources}"));
                        }

                        // Fallback to concatenating snippets
                        let mut summary = String::new();
                        if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                            let mut scored: Vec<(&serde_json::Value, f64)> = results
                                .iter()
                                .map(|res| {
                                    let score = res
                                        .get("score")
                                        .and_then(|s| s.as_f64())
                                        .unwrap_or(0.0);
                                    (res, score)
                                })
                                .collect();
                            scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

                            let filtered: Vec<&serde_json::Value> = scored
                                .iter()
                                .filter(|(_, score)| *score >= 0.35)
                                .map(|(res, _)| *res)
                                .collect();
                            let picked = if filtered.is_empty() {
                                scored.iter().map(|(res, _)| *res).collect::<Vec<_>>()
                            } else {
                                filtered
                            };

                            for res in picked.into_iter().take(5) {
                                let title = res
                                    .get("title")
                                    .and_then(|s| s.as_str())
                                    .unwrap_or("No Title");
                                let content =
                                    res.get("content").and_then(|s| s.as_str()).unwrap_or("");
                                let url = res.get("url").and_then(|s| s.as_str()).unwrap_or("");
                                summary.push_str(&format!("- [{title}]({url}): {content}\n"));
                            }
                        }

                        if summary.is_empty() {
                            return Ok("No relevant results found.".to_string());
                        }

                        return Ok(summary);
                    } else if resp.status().as_u16() == 429 {
                        // Rate limited - try next key
                        warn!(target: "guardian::search", "Key #{} rate limited, switching", i + 1);
                        continue;
                    } else {
                        // Specific Error Handling for Failover
                        warn!(target: "guardian::search", "Key #{} failed ({}), switching", i + 1, resp.status());
                    }
                }
                Err(e) => {
                    warn!(target: "guardian::search", "Connection error with key #{}: {}", i + 1, e);
                }
            }
        }

        Err("All Tavily API keys exhausted. Search failed.".to_string())
    }
}

fn normalize_search_query(raw: &str, max_chars: usize) -> (String, bool) {
    let mut q = raw.trim().replace('\r', " ").replace('\n', " ");
    q = q
        .split_whitespace()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    let count = q.chars().count();
    if count <= max_chars {
        return (q, false);
    }

    let truncated: String = q.chars().take(max_chars).collect();
    (truncated, true)
}

fn should_use_advanced_depth(query: &str) -> bool {
    let q = query.to_lowercase();
    let triggers = [
        "latest",
        "current",
        "today",
        "news",
        "release",
        "version",
        "changelog",
        "pricing",
        "terms",
        "policy",
        "compare",
        "benchmark",
        "cve",
        "security advisory",
        "vulnerability",
    ];
    triggers.iter().any(|t| q.contains(t))
}

fn extract_include_domains(query: &str) -> Vec<String> {
    let mut domains: Vec<String> = Vec::new();

    for token in query.split_whitespace() {
        if let Some(rest) = token.strip_prefix("site:") {
            let cleaned = rest
                .trim()
                .trim_matches(|c: char| matches!(c, '"' | '\'' | '(' | ')' | '[' | ']' | '{' | '}' | ','));
            let cleaned = cleaned.trim_end_matches('/');
            if !cleaned.is_empty() {
                domains.push(cleaned.to_string());
            }
        }
    }

    for token in query.split_whitespace() {
        let cleaned = token
            .trim_start_matches(|c: char| matches!(c, '(' | '[' | '{' | '"' | '\''))
            .trim_end_matches(|c: char| matches!(c, ')' | ']' | '}' | '.' | ',' | '"' | '\'' | ';' | ':'));
        if !(cleaned.starts_with("http://") || cleaned.starts_with("https://")) {
            continue;
        }

        if let Ok(url) = Url::parse(cleaned) {
            if let Some(host) = url.host_str() {
                domains.push(host.to_string());
            }
        }
    }

    domains.sort();
    domains.dedup();
    domains.truncate(4);
    domains
}

fn extract_urls(query: &str) -> Vec<String> {
    let mut urls: Vec<String> = Vec::new();

    for token in query.split_whitespace() {
        let cleaned = token
            .trim_start_matches(|c: char| matches!(c, '(' | '[' | '{' | '"' | '\''))
            .trim_end_matches(|c: char| matches!(c, ')' | ']' | '}' | '.' | ',' | '"' | '\'' | ';' | ':'));

        if !(cleaned.starts_with("http://") || cleaned.starts_with("https://")) {
            continue;
        }

        if let Ok(url) = Url::parse(cleaned) {
            urls.push(url.to_string());
        }
    }

    urls.sort();
    urls.dedup();
    urls.truncate(3);
    urls
}

fn strip_urls(query: &str) -> String {
    query
        .split_whitespace()
        .filter(|token| {
            let trimmed = token.trim();
            if trimmed.starts_with("site:") {
                return false;
            }
            let cleaned = trimmed
                .trim_start_matches(|c: char| matches!(c, '(' | '[' | '{' | '"' | '\''))
                .trim_end_matches(|c: char| matches!(c, ')' | ']' | '}' | '.' | ',' | '"' | '\'' | ';' | ':'));
            !(cleaned.starts_with("http://") || cleaned.starts_with("https://"))
        })
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn render_sources(payload: &serde_json::Value, limit: usize) -> String {
    let Some(results) = payload.get("results").and_then(|r| r.as_array()) else {
        return String::new();
    };

    let mut scored: Vec<(&serde_json::Value, f64)> = results
        .iter()
        .map(|res| {
            let score = res.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
            (res, score)
        })
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut out = String::new();
    for (res, _) in scored.into_iter().take(limit) {
        let title = res
            .get("title")
            .and_then(|s| s.as_str())
            .unwrap_or("No Title");
        let url = res.get("url").and_then(|s| s.as_str()).unwrap_or("");
        if url.is_empty() {
            continue;
        }
        out.push_str(&format!("- {title}: {url}\n"));
    }
    out.trim_end().to_string()
}

fn render_extract_results(payload: &serde_json::Value, max_chars: usize) -> String {
    let Some(results) = payload.get("results").and_then(|r| r.as_array()) else {
        return String::new();
    };

    let mut out = String::new();
    for res in results.iter().take(3) {
        let url = res.get("url").and_then(|v| v.as_str()).unwrap_or("");
        let content = res
            .get("raw_content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();

        if url.is_empty() && content.is_empty() {
            continue;
        }

        if !out.is_empty() {
            out.push_str("\n\n---\n\n");
        }

        if !url.is_empty() {
            out.push_str(&format!("Source: {url}\n\n"));
        }

        if !content.is_empty() {
            out.push_str(content);
        }
    }

    truncate_chars(&out, max_chars)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut truncated: String = value.chars().take(max_chars).collect();
    truncated.push('…');
    truncated
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_search_query_compacts_whitespace_and_truncates() {
        let (q, truncated) = normalize_search_query("  hello \n world  ", 400);
        assert_eq!(q, "hello world");
        assert!(!truncated);

        let long = "a".repeat(500);
        let (q2, truncated2) = normalize_search_query(&long, 400);
        assert_eq!(q2.chars().count(), 400);
        assert!(truncated2);
    }

    #[test]
    fn extract_urls_detects_http_urls() {
        let urls = extract_urls("check https://example.com/docs and http://localhost:1234/test");
        assert_eq!(urls.len(), 2);
        assert!(urls[0].starts_with("http"));
    }

    #[test]
    fn strip_urls_removes_urls_and_site_filters() {
        let stripped = strip_urls("site:example.com summarize https://example.com/page please");
        assert_eq!(stripped, "summarize please");
    }

    #[test]
    fn search_depth_parses_user_values() {
        assert_eq!(SearchDepth::from_user_value(Some("basic")), SearchDepth::Basic);
        assert_eq!(SearchDepth::from_user_value(Some("advanced")), SearchDepth::Advanced);
        assert_eq!(SearchDepth::from_user_value(Some("fast")), SearchDepth::Fast);
        assert_eq!(
            SearchDepth::from_user_value(Some("ultra-fast")),
            SearchDepth::UltraFast
        );
        assert_eq!(SearchDepth::from_user_value(Some("auto")), SearchDepth::Auto);
        assert_eq!(SearchDepth::from_user_value(Some("invalid")), SearchDepth::Basic);
    }
}
