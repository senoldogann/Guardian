use anyhow::Context;
use rusqlite::{params, params_from_iter, types::Value, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::{Once, OnceLock};
use tracing::warn;

pub struct StorageManager {
    conn: Connection,
    semantic_ann_enabled: AtomicBool,
}

const SQLITE_VEC_EMBED_DIM: usize = 256;
const SQLITE_VEC_KNN_MULTIPLIER: usize = 4;
const SQLITE_VEC_KNN_MIN: usize = 12;
const SQLITE_VEC_KNN_MAX: usize = 256;
const COSINE_SCAN_LIMIT: usize = 500;

static SQLITE_VEC_REGISTER: Once = Once::new();
static SQLITE_VEC_REGISTER_RESULT: OnceLock<std::result::Result<(), String>> = OnceLock::new();

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticVectorRecord {
    pub workspace: String,
    pub file_path: String,
    pub content_hash: String,
    pub critique_id: String,
    pub severity: String,
    pub embedding: Vec<f32>,
    pub source_mode: String,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMatch {
    pub file_path: String,
    pub content_hash: String,
    pub critique_id: String,
    pub severity: String,
    pub similarity: f32,
    pub source_mode: String,
    pub preview: String,
}

fn register_sqlite_vec_auto_extension() -> std::result::Result<(), String> {
    SQLITE_VEC_REGISTER.call_once(|| {
        let result = unsafe {
            let entry = std::mem::transmute(sqlite_vec::sqlite3_vec_init as *const ());
            let rc = rusqlite::ffi::sqlite3_auto_extension(Some(entry));
            if rc == rusqlite::ffi::SQLITE_OK {
                Ok(())
            } else {
                Err(format!(
                    "sqlite3_auto_extension failed for sqlite-vec (rc={})",
                    rc
                ))
            }
        };
        let _ = SQLITE_VEC_REGISTER_RESULT.set(result);
    });

    SQLITE_VEC_REGISTER_RESULT
        .get()
        .cloned()
        .unwrap_or_else(|| Err("sqlite-vec registration state unavailable".to_string()))
}

fn ann_candidate_count(limit: usize) -> usize {
    limit
        .saturating_mul(SQLITE_VEC_KNN_MULTIPLIER)
        .clamp(SQLITE_VEC_KNN_MIN, SQLITE_VEC_KNN_MAX)
}

impl StorageManager {
    pub fn init(base_path: &str) -> anyhow::Result<Self> {
        let db_path = Path::new(base_path).join(".guardian/memory.db");

        // Ensure dir exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        // sqlite3_auto_extension only affects connections opened *after* registration.
        // Register first so the current connection sees vec0 (when supported).
        let sqlite_vec_register = register_sqlite_vec_auto_extension();

        let conn = Connection::open(&db_path).context("Failed to open SQLite connection")?;
        let mut semantic_ann_enabled = false;

        match sqlite_vec_register {
            Ok(()) => {
                if let Err(err) = conn.execute(
                    &format!(
                        "CREATE VIRTUAL TABLE IF NOT EXISTS semantic_vectors_ann USING vec0(embedding float[{}])",
                        SQLITE_VEC_EMBED_DIM
                    ),
                    [],
                ) {
                    warn!(
                        target: "guardian::semantic",
                        "sqlite-vec ANN table init failed, falling back to cosine scan. This is expected in dev builds without vec0 support: {}",
                        err
                    );
                } else {
                    semantic_ann_enabled = true;
                }
            }
            Err(err) => {
                warn!(
                    target: "guardian::semantic",
                    "sqlite-vec extension registration failed, ANN disabled: {}",
                    err
                );
            }
        }

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

        conn.execute(
            "CREATE TABLE IF NOT EXISTS semantic_vectors (
                id INTEGER PRIMARY KEY,
                workspace TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                critique_id TEXT NOT NULL DEFAULT '',
                severity TEXT NOT NULL,
                embedding_json TEXT NOT NULL,
                embedding_dim INTEGER NOT NULL,
                source_mode TEXT NOT NULL,
                preview TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(workspace, file_path, content_hash, critique_id)
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_semantic_workspace_severity
             ON semantic_vectors (workspace, severity, created_at DESC)",
            [],
        )?;

        Ok(Self {
            conn,
            semantic_ann_enabled: AtomicBool::new(semantic_ann_enabled),
        })
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

    pub fn remove_file_hash(&self, path: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM file_fingerprints WHERE path = ?1",
            params![path],
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

    pub fn upsert_semantic_vector(&self, record: &SemanticVectorRecord) -> Result<()> {
        let embedding_json = serde_json::to_string(&record.embedding)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        self.conn.execute(
            "INSERT INTO semantic_vectors (
                workspace, file_path, content_hash, critique_id, severity,
                embedding_json, embedding_dim, source_mode, preview
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(workspace, file_path, content_hash, critique_id)
            DO UPDATE SET
                severity = excluded.severity,
                embedding_json = excluded.embedding_json,
                embedding_dim = excluded.embedding_dim,
                source_mode = excluded.source_mode,
                preview = excluded.preview,
                created_at = CURRENT_TIMESTAMP",
            params![
                record.workspace,
                record.file_path,
                record.content_hash,
                record.critique_id,
                record.severity,
                embedding_json,
                record.embedding.len() as i64,
                record.source_mode,
                record.preview
            ],
        )?;

        let row_id: i64 = self.conn.query_row(
            "SELECT id FROM semantic_vectors
             WHERE workspace = ?1 AND file_path = ?2 AND content_hash = ?3 AND critique_id = ?4",
            params![
                record.workspace,
                record.file_path,
                record.content_hash,
                record.critique_id
            ],
            |row| row.get(0),
        )?;

        self.sync_semantic_ann_row(row_id, record.embedding.len(), &embedding_json);
        Ok(())
    }

    fn sync_semantic_ann_row(&self, row_id: i64, embedding_dim: usize, embedding_json: &str) {
        if !self.semantic_ann_enabled.load(AtomicOrdering::Relaxed) {
            return;
        }
        if embedding_dim != SQLITE_VEC_EMBED_DIM {
            return;
        }
        if let Err(err) = self.conn.execute(
            "INSERT OR REPLACE INTO semantic_vectors_ann (rowid, embedding) VALUES (?1, ?2)",
            params![row_id, embedding_json],
        ) {
            warn!(
                target: "guardian::semantic",
                "sqlite-vec ANN upsert failed, disabling ANN for this session: {}",
                err
            );
            self.semantic_ann_enabled
                .store(false, AtomicOrdering::Relaxed);
        }
    }

    pub fn search_semantic_vectors(
        &self,
        workspace: &str,
        query_embedding: &[f32],
        limit: usize,
        severity_filter: Option<&str>,
        exclude_content_hash: Option<&str>,
        exclude_critique_id: Option<&str>,
    ) -> Result<Vec<SemanticMatch>> {
        if query_embedding.is_empty() || limit == 0 {
            return Ok(Vec::new());
        }

        if self.semantic_ann_enabled.load(AtomicOrdering::Relaxed)
            && query_embedding.len() == SQLITE_VEC_EMBED_DIM
        {
            match self.search_semantic_vectors_ann(
                workspace,
                query_embedding,
                limit,
                severity_filter,
                exclude_content_hash,
                exclude_critique_id,
            ) {
                Ok(matches) if !matches.is_empty() => return Ok(matches),
                Ok(_) => {}
                Err(err) => {
                    warn!(
                        target: "guardian::semantic",
                        "sqlite-vec ANN search failed, falling back to cosine scan: {}",
                        err
                    );
                    self.semantic_ann_enabled
                        .store(false, AtomicOrdering::Relaxed);
                }
            }
        }

        self.search_semantic_vectors_cosine(
            workspace,
            query_embedding,
            limit,
            severity_filter,
            exclude_content_hash,
            exclude_critique_id,
        )
    }

    fn search_semantic_vectors_ann(
        &self,
        workspace: &str,
        query_embedding: &[f32],
        limit: usize,
        severity_filter: Option<&str>,
        exclude_content_hash: Option<&str>,
        exclude_critique_id: Option<&str>,
    ) -> Result<Vec<SemanticMatch>> {
        let query_embedding_json = serde_json::to_string(query_embedding)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let mut sql = String::from(
            "SELECT
                sv.file_path,
                sv.content_hash,
                sv.critique_id,
                sv.severity,
                sv.source_mode,
                COALESCE(sv.preview, ''),
                ann.distance
             FROM semantic_vectors_ann ann
             JOIN semantic_vectors sv ON sv.id = ann.rowid
             WHERE ann.embedding MATCH ?1
               AND k = ?2
               AND sv.workspace = ?3",
        );
        let mut bind_values = vec![
            Value::Text(query_embedding_json),
            Value::Integer(ann_candidate_count(limit) as i64),
            Value::Text(workspace.to_string()),
        ];

        if let Some(severity) = severity_filter {
            sql.push_str(&format!(
                " AND lower(sv.severity) = lower(?{})",
                bind_values.len() + 1
            ));
            bind_values.push(Value::Text(severity.to_string()));
        }
        if let Some(exclude_hash) = exclude_content_hash {
            sql.push_str(&format!(
                " AND sv.content_hash <> ?{}",
                bind_values.len() + 1
            ));
            bind_values.push(Value::Text(exclude_hash.to_string()));
        }
        if let Some(exclude_id) = exclude_critique_id {
            if !exclude_id.is_empty() {
                sql.push_str(&format!(
                    " AND sv.critique_id <> ?{}",
                    bind_values.len() + 1
                ));
                bind_values.push(Value::Text(exclude_id.to_string()));
            }
        }

        sql.push_str(&format!(
            " ORDER BY ann.distance ASC LIMIT ?{}",
            bind_values.len() + 1
        ));
        bind_values.push(Value::Integer(limit as i64));

        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(bind_values), |row| {
            let distance = row.get::<_, f64>(6)? as f32;
            Ok(SemanticMatch {
                file_path: row.get(0)?,
                content_hash: row.get(1)?,
                critique_id: row.get(2)?,
                severity: row.get(3)?,
                source_mode: row.get(4)?,
                preview: row.get(5)?,
                similarity: ann_distance_to_similarity(distance),
            })
        })?;

        let mut matches = Vec::new();
        for row in rows {
            matches.push(row?);
        }
        Ok(matches)
    }

    fn search_semantic_vectors_cosine(
        &self,
        workspace: &str,
        query_embedding: &[f32],
        limit: usize,
        severity_filter: Option<&str>,
        exclude_content_hash: Option<&str>,
        exclude_critique_id: Option<&str>,
    ) -> Result<Vec<SemanticMatch>> {
        let query = if let Some(severity) = severity_filter {
            let sql = format!(
                "SELECT file_path, content_hash, critique_id, severity, embedding_json, source_mode, COALESCE(preview, '')
                 FROM semantic_vectors
                 WHERE workspace = ?1 AND severity = ?2
                 ORDER BY id DESC
                 LIMIT {}",
                COSINE_SCAN_LIMIT
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let rows = stmt.query_map(params![workspace, severity], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })?;
            rows.collect::<Result<Vec<_>>>()?
        } else {
            let sql = format!(
                "SELECT file_path, content_hash, critique_id, severity, embedding_json, source_mode, COALESCE(preview, '')
                 FROM semantic_vectors
                 WHERE workspace = ?1
                 ORDER BY id DESC
                 LIMIT {}",
                COSINE_SCAN_LIMIT
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let rows = stmt.query_map(params![workspace], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            })?;
            rows.collect::<Result<Vec<_>>>()?
        };

        let mut scored: Vec<SemanticMatch> = Vec::new();
        for (
            file_path,
            content_hash,
            critique_id,
            severity,
            embedding_json,
            source_mode,
            preview,
        ) in query
        {
            if let Some(exclude_hash) = exclude_content_hash {
                if content_hash == exclude_hash {
                    continue;
                }
            }
            if let Some(exclude_id) = exclude_critique_id {
                if !exclude_id.is_empty() && critique_id == exclude_id {
                    continue;
                }
            }

            let Ok(embedding) = serde_json::from_str::<Vec<f32>>(&embedding_json) else {
                continue;
            };
            if embedding.len() != query_embedding.len() {
                continue;
            }
            let similarity = cosine_similarity(query_embedding, &embedding);
            if !similarity.is_finite() {
                continue;
            }
            scored.push(SemanticMatch {
                file_path,
                content_hash,
                critique_id,
                severity,
                similarity,
                source_mode,
                preview,
            });
        }

        scored.sort_by(|a, b| {
            b.similarity
                .partial_cmp(&a.similarity)
                .unwrap_or(Ordering::Equal)
        });
        scored.truncate(limit);
        Ok(scored)
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;
    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    if norm_a <= f32::EPSILON || norm_b <= f32::EPSILON {
        return 0.0;
    }
    dot / (norm_a.sqrt() * norm_b.sqrt())
}

fn ann_distance_to_similarity(distance: f32) -> f32 {
    if !distance.is_finite() {
        return 0.0;
    }
    1.0 / (1.0 + distance.max(0.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn semantic_vector_search_returns_similar_matches() {
        let temp = TempDir::new().unwrap();
        let storage = StorageManager::init(temp.path().to_string_lossy().as_ref()).unwrap();

        storage
            .upsert_semantic_vector(&SemanticVectorRecord {
                workspace: "/tmp/workspace".to_string(),
                file_path: "src/a.rs".to_string(),
                content_hash: "hash-a".to_string(),
                critique_id: "id-a".to_string(),
                severity: "Critical".to_string(),
                embedding: vec![1.0, 0.0, 0.0],
                source_mode: "test".to_string(),
                preview: "a".to_string(),
            })
            .unwrap();

        storage
            .upsert_semantic_vector(&SemanticVectorRecord {
                workspace: "/tmp/workspace".to_string(),
                file_path: "src/b.rs".to_string(),
                content_hash: "hash-b".to_string(),
                critique_id: "id-b".to_string(),
                severity: "Critical".to_string(),
                embedding: vec![0.9, 0.1, 0.0],
                source_mode: "test".to_string(),
                preview: "b".to_string(),
            })
            .unwrap();

        let matches = storage
            .search_semantic_vectors(
                "/tmp/workspace",
                &[1.0, 0.0, 0.0],
                5,
                Some("Critical"),
                Some("hash-a"),
                Some("id-a"),
            )
            .unwrap();

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].file_path, "src/b.rs");
        assert!(matches[0].similarity > 0.9);
    }

    #[test]
    fn semantic_vector_ann_path_handles_256d_embeddings() {
        let temp = TempDir::new().unwrap();
        let storage = StorageManager::init(temp.path().to_string_lossy().as_ref()).unwrap();

        let mut embedding_a = vec![0.0f32; SQLITE_VEC_EMBED_DIM];
        embedding_a[0] = 1.0;
        let mut embedding_b = vec![0.0f32; SQLITE_VEC_EMBED_DIM];
        embedding_b[0] = 0.96;
        embedding_b[1] = 0.04;

        storage
            .upsert_semantic_vector(&SemanticVectorRecord {
                workspace: "/tmp/workspace".to_string(),
                file_path: "src/security_a.rs".to_string(),
                content_hash: "hash-256-a".to_string(),
                critique_id: "id-256-a".to_string(),
                severity: "Critical".to_string(),
                embedding: embedding_a.clone(),
                source_mode: "test".to_string(),
                preview: "ann-a".to_string(),
            })
            .unwrap();

        storage
            .upsert_semantic_vector(&SemanticVectorRecord {
                workspace: "/tmp/workspace".to_string(),
                file_path: "src/security_b.rs".to_string(),
                content_hash: "hash-256-b".to_string(),
                critique_id: "id-256-b".to_string(),
                severity: "Critical".to_string(),
                embedding: embedding_b,
                source_mode: "test".to_string(),
                preview: "ann-b".to_string(),
            })
            .unwrap();

        let matches = storage
            .search_semantic_vectors(
                "/tmp/workspace",
                &embedding_a,
                3,
                Some("Critical"),
                Some("hash-256-a"),
                Some("id-256-a"),
            )
            .unwrap();

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].file_path, "src/security_b.rs");
        assert!(matches[0].similarity > 0.6);
    }
}
