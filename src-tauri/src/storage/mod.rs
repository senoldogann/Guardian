use anyhow::Context;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use serde_json;
use std::path::Path;

pub struct StorageManager {
    conn: Connection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatAction {
    pub status: String,
    pub file_path: String,
    pub diff: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<String>,
    pub action: Option<ChatAction>,
}

impl StorageManager {
    pub fn init(base_path: &str) -> anyhow::Result<Self> {
        let db_path = Path::new(base_path).join(".guardian/memory.db");

        // Ensure dir exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path).context("Failed to open SQLite connection")?;

        // Initialize Schema
        conn.execute(
            "CREATE TABLE IF NOT EXISTS issues (
                id INTEGER PRIMARY KEY,
                file_path TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                content_hash TEXT,
                rules_hash TEXT,
                status TEXT DEFAULT 'Open', -- Open, Fixed, Ignored
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY,
                action TEXT NOT NULL,
                details TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // NEW: Incremental Audit Fingerprints
        conn.execute(
            "CREATE TABLE IF NOT EXISTS file_fingerprints (
                path TEXT PRIMARY KEY,
                sha256 TEXT NOT NULL,
                last_audit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                risk_score INTEGER DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS telemetry_queue (
                id INTEGER PRIMARY KEY,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY,
                workspace TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT,
                action_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_workspace_id ON chat_messages (workspace, id)",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn save_issue(
        &self,
        path: &str,
        severity: &str,
        message: &str,
        content_hash: &str,
        rules_hash: &str,
    ) -> Result<()> {
        // Upsert logic (simplified replace for now)
        self.conn.execute(
            "INSERT INTO issues (file_path, severity, message, content_hash, rules_hash, status) 
             VALUES (?1, ?2, ?3, ?4, ?5, 'Open')",
            params![path, severity, message, content_hash, rules_hash],
        )?;
        Ok(())
    }

    pub fn check_file_hash(&self, path: &str, current_hash: &str) -> Result<bool> {
        let mut stmt = self
            .conn
            .prepare("SELECT sha256 FROM file_fingerprints WHERE path = ?1")?;

        let stored_hash: Option<String> =
            stmt.query_row(params![path], |row| row.get(0)).optional()?;

        match stored_hash {
            Some(hash) => Ok(hash == current_hash),
            None => Ok(false), // New file -> audit needed
        }
    }

    pub fn update_file_hash(&self, path: &str, new_hash: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO file_fingerprints (path, sha256, last_audit_time) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
            params![path, new_hash],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_active_issues(&self) -> Result<Vec<(String, String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT file_path, severity, message FROM issues WHERE status = 'Open'")?;

        let issue_iter = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;

        let mut issues = Vec::new();
        for issue in issue_iter {
            issues.push(issue?);
        }
        Ok(issues)
    }

    pub fn check_cache(&self, path: &str, content_hash: &str, rules_hash: &str) -> Result<bool> {
        let mut stmt = self.conn.prepare(
            "SELECT COUNT(*) FROM issues 
             WHERE file_path = ?1 AND content_hash = ?2 AND rules_hash = ?3",
        )?;
        let count: i64 =
            stmt.query_row(params![path, content_hash, rules_hash], |row| row.get(0))?;
        Ok(count > 0)
    }

    #[allow(dead_code)]
    pub fn mark_fixed(&self, path: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE issues SET status = 'Fixed' WHERE file_path = ?1",
            params![path],
        )?;
        Ok(())
    }

    pub fn enqueue_telemetry(&self, event_type: &str, payload: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO telemetry_queue (event_type, payload, status) VALUES (?1, ?2, 'pending')",
            params![event_type, payload],
        )?;
        Ok(())
    }

    pub fn save_chat_message(&self, workspace: &str, message: &ChatMessage) -> Result<()> {
        let action_json = match &message.action {
            Some(action) => serde_json::to_string(action).ok(),
            None => None,
        };

        self.conn.execute(
            "INSERT INTO chat_messages (workspace, role, content, timestamp, action_json)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                workspace,
                message.role,
                message.content,
                message.timestamp,
                action_json
            ],
        )?;
        Ok(())
    }

    pub fn load_chat_messages(
        &self,
        workspace: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<ChatMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT role, content, timestamp, action_json
             FROM chat_messages
             WHERE workspace = ?1
             ORDER BY id ASC
             LIMIT ?2 OFFSET ?3",
        )?;

        let rows = stmt.query_map(params![workspace, limit as i64, offset as i64], |row| {
            let action_json: Option<String> = row.get(3)?;
            let action = match action_json {
                Some(json) => serde_json::from_str::<ChatAction>(&json).ok(),
                None => None,
            };
            Ok(ChatMessage {
                role: row.get(0)?,
                content: row.get(1)?,
                timestamp: row.get(2)?,
                action,
            })
        })?;

        let mut messages = Vec::new();
        for msg in rows {
            messages.push(msg?);
        }
        Ok(messages)
    }

    pub fn clear_chat_messages(&self, workspace: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM chat_messages WHERE workspace = ?1",
            params![workspace],
        )?;
        Ok(())
    }
}
