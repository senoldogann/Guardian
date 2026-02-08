use crate::ai_client::AiClient;
use crate::config;
use crate::kernel::bus::{EventBus, GuardianEvent};
use crate::provider::ProviderConfig;
use crate::storage::StorageManager;
use anyhow::Result;
use std::sync::{Arc, Mutex};
use tracing::{error, info, warn};

#[allow(dead_code)]
pub struct AgentOrchestrator {
    bus: Arc<EventBus>,
    ai: Arc<AiClient>,
    storage: Arc<Mutex<StorageManager>>,
    app: tauri::AppHandle,
}

impl AgentOrchestrator {
    pub fn new(
        bus: Arc<EventBus>,
        storage: Arc<Mutex<StorageManager>>,
        app: tauri::AppHandle,
        provider: ProviderConfig,
    ) -> Result<Self> {
        let api_key = config::api_key_for_provider(&provider.provider_id)?;
        let ai = Arc::new(AiClient::new(
            provider.provider_id.clone(),
            provider.base_url,
            provider.model,
            api_key,
        )?);

        Ok(Self {
            bus,
            ai,
            storage,
            app,
        })
    }

    pub async fn run(&self) {
        let mut rx = self.bus.subscribe();
        info!(target: "guardian::orchestrator", "Online and listening");

        loop {
            match rx.recv().await {
                Ok(event) => match event {
                    GuardianEvent::FileModified { path } => {
                        self.handle_file_modification(path).await;
                    }
                    GuardianEvent::RequestReview { file_path, diff } => {
                        self.handle_fix_review(file_path, diff).await;
                    }
                    GuardianEvent::RequestScan { root } => {
                        info!(target: "guardian::orchestrator", "Executing Hunter Protocol on: {}", root);
                        let bus_clone = self.bus.clone();
                        let storage_clone = self.storage.clone();
                        let root_clone = root.clone();

                        tauri::async_runtime::spawn(async move {
                            let scanner = crate::skills::scanner::ProjectScanner::new(
                                root_clone,
                                bus_clone,
                                storage_clone,
                            );
                            scanner.scan().await;
                        });
                    }
                    _ => {}
                },
                Err(tokio::sync::broadcast::error::RecvError::Lagged(count)) => {
                    warn!(target: "guardian::orchestrator", "Event bus lagged by {} messages", count);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    info!(target: "guardian::orchestrator", "Event bus closed, shutting down");
                    break;
                }
            }
        }
    }

    async fn handle_fix_review(&self, path: String, diff: String) {
        info!(target: "guardian::orchestrator", "Reviewing fix for: {}", path);

        // DYNAMIC LOADING (Integrity Check Passed):
        // We pass the 'path' of the file being edited. The KnowledgeBase will walk UP the tree
        // to find the .agent folder, ensuring we get the correct rules for this specific workspace.
        let system_rules = crate::skills::knowledge::KnowledgeBase::load_system_rules(&path);
        let persona = crate::skills::knowledge::KnowledgeBase::get_specialist_persona(&path, &path);

        // 2. AI Verification
        let prompt = format!(
            "{}\n\nReview this fix for {}.\nDifference:\n{}\n\nStrictly audit against these System Rules:\n{}\n\nIf clean, say 'LGTM'. If changes are needed, return the FULL updated file content only (no diff markers, no markdown, no code fences).",
            persona, path, diff, system_rules
        );

        match self.ai.ask_question(&prompt, "Review this fix").await {
            Ok(verdict) => {
                if verdict.contains("LGTM") {
                    info!(target: "guardian::orchestrator", "Fix approved for: {}", path);

                    // Emit to UI for final confirmation
                    // We use a JSON payload to describe the state
                    use tauri::Emitter;
                    self.app
                        .emit(
                            "guardian:review-decision",
                            serde_json::json!({
                                "status": "APPROVED",
                                "file_path": path,
                                "diff": diff,
                                "message": "Guardian checks passed. Ready to apply?"
                            }),
                        )
                        .ok();
                } else {
                    info!(target: "guardian::orchestrator", "Fix polished for: {}", path);

                    use tauri::Emitter;
                    self.app
                        .emit(
                            "guardian:review-decision",
                            serde_json::json!({
                                "status": "MODIFIED",
                                "file_path": path,
                                "diff": verdict, // The polished diff from AI
                                "message": "Guardian enforced rules and polished this fix."
                            }),
                        )
                        .ok();
                }
            }
            Err(e) => error!(target: "guardian::orchestrator", "Review error: {}", e),
        }
    }

    async fn handle_file_modification(&self, path: String) {
        info!(target: "guardian::orchestrator", "Processing change: {}", path);

        if let Ok(content) = tokio::fs::read_to_string(&path).await {
            let diff_sim = format!(
                "File Content:\n{}",
                content.chars().take(10000).collect::<String>()
            );

            match self.ai.analyze_diff(&path, &diff_sim).await {
                Ok(critique) => {
                    info!(target: "guardian::orchestrator", "Analysis complete for: {}", path);

                    // 1. Persist to Memory (DB)
                    if critique.severity != "Info" || critique.message != "LGTM" {
                        match self.storage.lock() {
                            Ok(storage) => {
                                let content_hash =
                                    crate::skills::hasher::calculate_file_hash(&path);
                                // Get home to resolve base path for rules
                                let home = match dirs::home_dir() {
                                    Some(h) => h,
                                    None => {
                                        error!(target: "guardian::orchestrator", "Could not determine home directory");
                                        return;
                                    }
                                };
                                let rules_hash = crate::skills::hasher::get_rules_fingerprint(
                                    &home.to_string_lossy(),
                                );

                                if let Err(e) = storage.save_issue(
                                    &path,
                                    &critique.severity,
                                    &critique.message,
                                    &content_hash,
                                    &rules_hash,
                                ) {
                                    error!(target: "guardian::orchestrator", "Failed to save issue: {}", e);
                                } else {
                                    info!(target: "guardian::orchestrator", "Issue saved to database");
                                }
                            }
                            Err(e) => {
                                error!(target: "guardian::orchestrator", "Failed to lock storage mutex: {}", e);
                            }
                        }
                    }

                    // 2. Publish Result (Event)
                    let result = match serde_json::to_string(&critique) {
                        Ok(json) => Some(json),
                        Err(e) => {
                            error!(target: "guardian::orchestrator", "Failed to serialize critique: {}", e);
                            None
                        }
                    };

                    self.bus
                        .publish(GuardianEvent::AnalysisComplete {
                            file_path: path,
                            result,
                        })
                        .await;
                }
                Err(e) => {
                    error!(target: "guardian::orchestrator", "Analysis error: {}", e);
                }
            }
        }
    }
}
