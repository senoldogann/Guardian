use ignore::WalkBuilder;
use std::sync::Arc;
use std::path::Path;
use crate::kernel::bus::{EventBus, GuardianEvent};
use crate::watcher::should_skip_path;
use tracing::{info, warn, debug};

#[allow(dead_code)]
pub struct ProjectScanner {
    root: String,
    bus: Arc<EventBus>,
    storage: Arc<std::sync::Mutex<crate::storage::StorageManager>>,
}

impl ProjectScanner {
    pub fn new(root: String, bus: Arc<EventBus>, storage: Arc<std::sync::Mutex<crate::storage::StorageManager>>) -> Self {
        Self { root, bus, storage }
    }

    pub async fn scan(&self) {
        info!(target: "guardian::scanner", "Starting deep scan of {}", self.root);
        
        // 1. Load Knowledge Base (Rules)
        let _rules = crate::skills::knowledge::KnowledgeBase::load_system_rules(&self.root);
        debug!(target: "guardian::scanner", "Loaded system rules");

        let walker = WalkBuilder::new(&self.root)
            .hidden(false)
            .git_ignore(true)
            .build();

        let mut count = 0;
        for result in walker {
            // SMART THROTTLE (SPAP v2.2):
            // 1. Limit to 1000 files to prevent endless loops or massive costs.
            // 2. Add an async sleep to be 'gentle' on the AI provider and system CPU.
            if count >= 1000 { 
                info!(target: "guardian::scanner", "Limit reached (1000 files)");
                break; 
            }

            if let Ok(entry) = result {
                if entry.file_type().map(|f| f.is_file()).unwrap_or(false) {
                    let path = entry.path().to_string_lossy().to_string();

                    if should_skip_path(Path::new(&path), false) {
                        continue;
                    }
                    if !path.ends_with(".rs") && !path.ends_with(".tsx") && !path.ends_with(".ts") {
                        continue;
                    }

                    debug!(target: "guardian::scanner", "Auditing {}", path);

                    // 1. CACHE CHECK (SPAP v2.2)
                    let current_file_hash = crate::skills::hasher::calculate_file_hash(&path);
                    let rules_hash = crate::skills::hasher::get_rules_fingerprint(&self.root);

                    let is_cached = if let Ok(storage) = self.storage.lock() {
                         storage.check_cache(&path, &current_file_hash, &rules_hash).unwrap_or(false)
                    } else {
                         warn!(target: "guardian::scanner", "Could not lock storage for cache check");
                         false
                    };

                    if is_cached {
                        debug!(target: "guardian::scanner", "Cache hit, skipping {}", path);
                        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                        continue;
                    }

                    // 2. Rate Limiting / System Gentleness:
                    tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

                    self.bus.publish(GuardianEvent::FileModified { path: path.clone() }).await;
                    count += 1;
                }
            }
        }
        
        info!(target: "guardian::scanner", "Scan complete");
    }
}
