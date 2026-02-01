use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GuardianEvent {
    // ... (Keep existing variants)
    FileModified { path: String },
    RequestScan { root: String },
    AnalysisComplete { file_path: String, result: Option<String> },
    RequestFix { file_path: String, diff: String },
    RequestReview { file_path: String, diff: String },
    ChatQuery { context: String, query: String },
    StallRequested { file_path: String, reason: String },
    StallReleased { file_path: String },
    Startup,
    Shutdown,
}

#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<GuardianEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        // Increase capacity for broadcast 
        let (tx, _rx) = broadcast::channel(1024);
        Self { tx }
    }

    pub async fn publish(&self, event: GuardianEvent) {
        if let Err(e) = self.tx.send(event) {
            eprintln!("EventBus Error: Failed to broadcast event: {}", e);
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<GuardianEvent> {
        self.tx.subscribe()
    }
}
