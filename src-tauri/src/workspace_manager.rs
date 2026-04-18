use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;
use tracing::info;

use crate::watcher;

/// Per-workspace supervisor that owns an independent watcher task.
struct WorkspaceEntry {
    shutdown: Arc<AtomicBool>,
    handle: Option<tauri::async_runtime::JoinHandle<()>>,
    path: String,
}

impl WorkspaceEntry {
    fn is_running(&self) -> bool {
        // If the shutdown flag has not been set and we still hold a handle,
        // the watcher task is considered active.
        self.handle.is_some() && !self.shutdown.load(Ordering::Relaxed)
    }
}

/// Serialisable snapshot returned to the frontend.
#[derive(Serialize, Clone)]
pub struct WorkspaceInfo {
    pub id: String,
    pub path: String,
    pub running: bool,
}

/// Manages multiple independent `WatcherSupervisor`-style entries keyed by
/// workspace id (normalised absolute path).
pub struct WorkspaceManager {
    workspaces: RwLock<HashMap<String, WorkspaceEntry>>,
}

impl WorkspaceManager {
    pub fn new() -> Self {
        Self {
            workspaces: RwLock::new(HashMap::new()),
        }
    }

    /// Derives a stable workspace id from a path (canonicalised, forward-slash).
    fn workspace_id(path: &str) -> String {
        std::path::Path::new(path)
            .canonicalize()
            .unwrap_or_else(|_| std::path::PathBuf::from(path))
            .to_string_lossy()
            .replace('\\', "/")
    }

    /// Add (or restart) a workspace.  Returns the workspace id.
    pub async fn add_workspace(
        &self,
        app: AppHandle,
        config: watcher::WatcherRuntimeConfig,
    ) -> String {
        let id = Self::workspace_id(&config.target_path);
        let path = config.target_path.clone();

        // Stop any previous watcher for this workspace.
        self.remove_workspace_inner(&id).await;

        let shutdown = Arc::new(AtomicBool::new(false));
        let shutdown_clone = shutdown.clone();

        let handle = tauri::async_runtime::spawn(async move {
            watcher::start_watching(app, config, shutdown_clone).await;
        });

        let entry = WorkspaceEntry {
            shutdown,
            handle: Some(handle),
            path,
        };

        let mut map = self.workspaces.write().await;
        map.insert(id.clone(), entry);

        info!(target: "guardian::workspace_manager", "Workspace added: {}", id);
        id
    }

    /// Remove a workspace and stop its watcher.
    pub async fn remove_workspace(&self, workspace_id: &str) -> bool {
        self.remove_workspace_inner(workspace_id).await
    }

    async fn remove_workspace_inner(&self, workspace_id: &str) -> bool {
        let mut map = self.workspaces.write().await;
        if let Some(mut entry) = map.remove(workspace_id) {
            entry.shutdown.store(true, Ordering::Relaxed);
            if let Some(handle) = entry.handle.take() {
                handle.abort();
            }
            info!(target: "guardian::workspace_manager", "Workspace removed: {}", workspace_id);
            true
        } else {
            false
        }
    }

    /// List all registered workspaces.
    pub async fn list_workspaces(&self) -> Vec<WorkspaceInfo> {
        let map = self.workspaces.read().await;
        map.iter()
            .map(|(id, entry)| WorkspaceInfo {
                id: id.clone(),
                path: entry.path.clone(),
                running: entry.is_running(),
            })
            .collect()
    }

    /// Get status of a single workspace.  Returns `None` when the id is unknown.
    pub async fn get_workspace_status(&self, workspace_id: &str) -> Option<WorkspaceInfo> {
        let map = self.workspaces.read().await;
        map.get(workspace_id).map(|entry| WorkspaceInfo {
            id: workspace_id.to_string(),
            path: entry.path.clone(),
            running: entry.is_running(),
        })
    }

    /// Stop all workspaces (used during app shutdown / legacy stop).
    #[allow(dead_code)]
    pub async fn stop_all(&self) {
        let mut map = self.workspaces.write().await;
        for (id, entry) in map.iter_mut() {
            entry.shutdown.store(true, Ordering::Relaxed);
            if let Some(handle) = entry.handle.take() {
                handle.abort();
            }
            info!(target: "guardian::workspace_manager", "Workspace stopped (stop_all): {}", id);
        }
        map.clear();
    }
}
