use std::sync::{Arc, Mutex};
use crate::kernel::bus::{EventBus, GuardianEvent};
use crate::ai_client::OllamaClient;
use crate::config;
use anyhow::Result;
use crate::storage::StorageManager;

#[allow(dead_code)]
pub struct AgentOrchestrator {
    bus: Arc<EventBus>,
    ai: Arc<OllamaClient>,
    storage: Arc<Mutex<StorageManager>>,
    app: tauri::AppHandle,
}

impl AgentOrchestrator {
    pub fn new(bus: Arc<EventBus>, storage: Arc<Mutex<StorageManager>>, app: tauri::AppHandle) -> Result<Self> {
        let api_key = config::api_key()?;
        let model = config::DEFAULT_MODEL.to_string();
        let host = config::DEFAULT_HOST.to_string();
        let ai = Arc::new(OllamaClient::new(host, model, api_key));
        
        Ok(Self { bus, ai, storage, app })
    }

    pub async fn run(&self) {
        let mut rx = self.bus.subscribe();
        println!("Agent Orchestrator: Online and Listening.");

        loop {
            match rx.recv().await {
                Ok(event) => {
                    match event {
                        GuardianEvent::FileModified { path } => {
                            self.handle_file_modification(path).await;
                        }
                        GuardianEvent::RequestReview { file_path, diff } => {
                            self.handle_fix_review(file_path, diff).await;
                        }
                        GuardianEvent::RequestScan { root } => {
                            println!("Orchestrator: Executing Hunter Protocol on: {}", root);
                            let bus_clone = self.bus.clone();
                            let storage_clone = self.storage.clone();
                            let root_clone = root.clone();
                            
                            tauri::async_runtime::spawn(async move {
                                let scanner = crate::skills::scanner::ProjectScanner::new(root_clone, bus_clone, storage_clone);
                                scanner.scan().await;
                            });
                        }
                        _ => {}
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(count)) => {
                    eprintln!("Orchestrator: Event bus lagged by {} messages. Some events may have been missed.", count);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    println!("Orchestrator: Event bus channel closed. Shutting down orchestrator.");
                    break;
                }
            }
        }
    }


    async fn handle_fix_review(&self, path: String, diff: String) {
        println!("Orchestrator: Reviewing Fix for -> {}", path);
        
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
                     println!("Orchestrator: Fix Approved. Requesting User Confirmation...");
                     
                     // Emit to UI for final confirmation
                     // We use a JSON payload to describe the state
                     use tauri::Emitter;
                     self.app.emit("guardian:review-decision", serde_json::json!({
                         "status": "APPROVED",
                         "file_path": path,
                         "diff": diff,
                         "message": "Guardian checks passed. Ready to apply?"
                     })).ok();

                } else {
                    println!("Orchestrator: Fix Rejected/Polished. Auto-correcting...");
                    
                    use tauri::Emitter;
                    self.app.emit("guardian:review-decision", serde_json::json!({
                         "status": "MODIFIED",
                         "file_path": path,
                         "diff": verdict, // The polished diff from AI
                         "message": "Guardian enforced rules and polished this fix."
                     })).ok();
                }
            }
            Err(e) => println!("Review Error: {}", e),
        }
    }

    async fn handle_file_modification(&self, path: String) {
        println!("Orchestrator: Processing Change -> {}", path);
        
        if let Ok(content) = std::fs::read_to_string(&path) {
            let diff_sim = format!("File Content:\n{}", content.chars().take(10000).collect::<String>());

            match self.ai.analyze_diff(&path, &diff_sim).await {
                Ok(critique) => {
                    println!("Orchestrator: Analysis Complete for {}", path);
                    
                    // 1. Persist to Memory (DB)
                    if critique.severity != "Info" || critique.message != "LGTM" {
                        match self.storage.lock() {
                            Ok(storage) => {
                                let content_hash = crate::skills::hasher::calculate_file_hash(&path);
                                // Get home to resolve base path for rules
                                let home = match dirs::home_dir() {
                                    Some(h) => h,
                                    None => {
                                        eprintln!("[ERROR] Could not determine home directory");
                                        return;
                                    }
                                };
                                let rules_hash = crate::skills::hasher::get_rules_fingerprint(&home.to_string_lossy());
                                
                                if let Err(e) = storage.save_issue(&path, &critique.severity, &critique.message, &content_hash, &rules_hash) {
                                    eprintln!("[ERROR] Failed to save issue to database: {}", e);
                                } else {
                                    eprintln!("[INFO] Memory: Issue saved to database with hash fingerprint.");
                                }
                            }
                            Err(e) => {
                                eprintln!("[ERROR] Failed to lock storage mutex: {}", e);
                            }
                        }
                    }

                    // 2. Publish Result (Event)
                        let result = match serde_json::to_string(&critique) {
                        Ok(json) => Some(json),
                        Err(e) => {
                            eprintln!("[ERROR] Failed to serialize critique: {}", e);
                            None
                        }
                    };
                    
                    self.bus.publish(GuardianEvent::AnalysisComplete { 
                        file_path: path, 
                        result 
                    }).await;
                }
                Err(e) => {
                    println!("Orchestrator Error: {}", e);
                }
            }
        }
    }
}
