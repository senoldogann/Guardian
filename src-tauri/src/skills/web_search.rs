use reqwest::Client;
use serde_json::json;
use secrecy::ExposeSecret;
use crate::config;
use tracing::{debug, warn};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::time::{Instant, Duration};

pub struct WebSearch {
    client: Client,
    rate_limiter: Arc<RateLimiter>,
}

struct RateLimiter {
    last_request: AtomicU64,
    min_interval_ms: u64,
}

impl RateLimiter {
    fn new(min_interval_ms: u64) -> Self {
        Self {
            last_request: AtomicU64::new(0),
            min_interval_ms,
        }
    }

    async fn check_and_wait(&self) {
        let now = Instant::now();
        let now_ms = now.elapsed().as_millis() as u64;
        let last = self.last_request.load(Ordering::Relaxed);
        
        if last > 0 {
            let elapsed = now_ms.saturating_sub(last);
            if elapsed < self.min_interval_ms {
                let wait_ms = self.min_interval_ms - elapsed;
                tokio::time::sleep(Duration::from_millis(wait_ms)).await;
            }
        }
        
        self.last_request.store(now_ms, Ordering::Relaxed);
    }
}

impl WebSearch {
    pub fn new() -> Result<Self, String> {
        let timeout_secs = config::provider_timeout_seconds("tavily");
        let mut builder = Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs));

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

        // Rate limit: max 1 request per second per key
        let rate_limiter = Arc::new(RateLimiter::new(1000));

        Ok(Self { client, rate_limiter })
    }

    pub async fn search(&self, query: &str) -> Result<String, String> {
        let url = "https://api.tavily.com/search";

        let keys = config::tavily_keys().map_err(|e| e.to_string())?;
        if keys.is_empty() {
            return Err("No valid Tavily API keys found.".to_string());
        }

        for (i, key) in keys.iter().enumerate() {
            debug!(target: "guardian::search", "Attempting search with key #{}", i + 1);

            // Apply rate limiting before each request
            self.rate_limiter.check_and_wait().await;

            let payload = json!({
                "api_key": key.expose_secret(),
                "query": query,
                "search_depth": "basic",
                "include_answer": true,
                "max_results": 5
            });

            let response = self.client.post(url)
                .json(&payload)
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                        
                        // Extract "answer" or summarize results
                        if let Some(answer) = json.get("answer").and_then(|a| a.as_str()) {
                             return Ok(answer.to_string());
                        }

                        // Fallback to concatenating snippets
                        let mut summary = String::new();
                        if let Some(results) = json.get("results").and_then(|r| r.as_array()) {
                            for res in results {
                                let title = res.get("title").and_then(|s| s.as_str()).unwrap_or("No Title");
                                let content = res.get("content").and_then(|s| s.as_str()).unwrap_or("");
                                let url = res.get("url").and_then(|s| s.as_str()).unwrap_or("");
                                summary.push_str(&format!("- [{}]({}): {}\n", title, url, content));
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
                },
                Err(e) => {
                    warn!(target: "guardian::search", "Connection error with key #{}: {}", i + 1, e);
                }
            }
        }

        Err("All Tavily API keys exhausted. Search failed.".to_string())
    }
}
