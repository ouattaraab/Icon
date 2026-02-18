use std::path::{Path, PathBuf};
use std::sync::Mutex;
use rusqlite::Connection;
use tracing::info;

use crate::rules::models::Rule;
use crate::storage::migrations;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Initialize the encrypted SQLite database
    pub fn init(data_dir: &Path, encryption_key: &str) -> anyhow::Result<Self> {
        std::fs::create_dir_all(data_dir)?;

        let db_path: PathBuf = data_dir.join("icon.db");
        let conn = Connection::open(&db_path)?;

        // Set SQLCipher encryption key
        conn.pragma_update(None, "key", encryption_key)?;

        // Performance pragmas
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;

        info!(path = %db_path.display(), "Database opened");

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Run database migrations
    pub fn run_migrations(&self) -> anyhow::Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        migrations::run_migrations(&conn)
    }

    /// Get all enabled rules from local storage
    pub fn get_all_rules(&self) -> anyhow::Result<Vec<Rule>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, version, category, target, condition, action, priority, enabled
             FROM rules WHERE enabled = 1 ORDER BY priority DESC"
        )?;

        let rules = stmt.query_map([], |row| {
            let condition_json: String = row.get(5)?;
            let action_json: String = row.get(6)?;

            Ok(Rule {
                id: row.get(0)?,
                name: row.get(1)?,
                version: row.get(2)?,
                category: serde_json::from_str(&row.get::<_, String>(3)?).unwrap_or(crate::rules::models::RuleCategory::Log),
                target: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or(crate::rules::models::RuleTarget::Prompt),
                condition: serde_json::from_str(&condition_json).unwrap_or(crate::rules::models::RuleCondition::Keyword {
                    keywords: vec![],
                    match_all: false,
                }),
                action: serde_json::from_str(&action_json).unwrap_or(crate::rules::models::RuleAction::Log),
                priority: row.get(7)?,
                enabled: row.get::<_, i32>(8)? == 1,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(rules)
    }

    /// Insert or update a rule
    pub fn upsert_rule(&self, rule: &Rule) -> anyhow::Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        conn.execute(
            "INSERT INTO rules (id, name, version, category, target, condition, action, priority, enabled, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                version = excluded.version,
                category = excluded.category,
                target = excluded.target,
                condition = excluded.condition,
                action = excluded.action,
                priority = excluded.priority,
                enabled = excluded.enabled,
                updated_at = datetime('now')",
            rusqlite::params![
                rule.id,
                rule.name,
                rule.version,
                serde_json::to_string(&rule.category)?,
                serde_json::to_string(&rule.target)?,
                serde_json::to_string(&rule.condition)?,
                serde_json::to_string(&rule.action)?,
                rule.priority,
                rule.enabled as i32,
            ],
        )?;
        Ok(())
    }

    /// Delete a rule by ID
    pub fn delete_rule(&self, rule_id: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        conn.execute("DELETE FROM rules WHERE id = ?1", [rule_id])?;
        Ok(())
    }

    /// Queue an event for later sync to server
    #[allow(clippy::too_many_arguments)]
    pub fn queue_event(
        &self,
        event_type: &str,
        platform: Option<&str>,
        domain: Option<&str>,
        content_hash: Option<&str>,
        prompt_excerpt: Option<&str>,
        response_excerpt: Option<&str>,
        rule_id: Option<&str>,
        severity: Option<&str>,
        metadata: Option<&str>,
    ) -> anyhow::Result<i64> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        conn.execute(
            "INSERT INTO event_queue (event_type, platform, domain, content_hash, prompt_excerpt,
             response_excerpt, rule_id, severity, metadata, occurred_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))",
            rusqlite::params![
                event_type, platform, domain, content_hash,
                prompt_excerpt, response_excerpt, rule_id, severity, metadata,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Get pending (unsynced) events, up to `limit`
    pub fn get_pending_events(&self, limit: usize) -> anyhow::Result<Vec<QueuedEvent>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, event_type, platform, domain, content_hash, prompt_excerpt,
                    response_excerpt, rule_id, severity, metadata, occurred_at
             FROM event_queue WHERE synced = 0
             ORDER BY created_at ASC LIMIT ?1"
        )?;

        let events = stmt.query_map([limit], |row| {
            Ok(QueuedEvent {
                id: row.get(0)?,
                event_type: row.get(1)?,
                platform: row.get(2)?,
                domain: row.get(3)?,
                content_hash: row.get(4)?,
                prompt_excerpt: row.get(5)?,
                response_excerpt: row.get(6)?,
                rule_id: row.get(7)?,
                severity: row.get(8)?,
                metadata: row.get(9)?,
                occurred_at: row.get(10)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(events)
    }

    /// Mark events as synced
    pub fn mark_events_synced(&self, event_ids: &[i64]) -> anyhow::Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        for id in event_ids {
            conn.execute("UPDATE event_queue SET synced = 1 WHERE id = ?1", [id])?;
        }
        Ok(())
    }

    /// Purge old synced events beyond retention period
    pub fn purge_old_events(&self, retention_days: u32) -> anyhow::Result<usize> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let deleted = conn.execute(
            "DELETE FROM event_queue WHERE synced = 1
             AND created_at < datetime('now', ?1)",
            [format!("-{} days", retention_days)],
        )?;
        Ok(deleted)
    }

    /// Get a config value
    pub fn get_config(&self, key: &str) -> anyhow::Result<Option<String>> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        let mut stmt = conn.prepare("SELECT value FROM config WHERE key = ?1")?;
        let result = stmt.query_row([key], |row| row.get(0)).ok();
        Ok(result)
    }

    /// Set a config value
    pub fn set_config(&self, key: &str, value: &str) -> anyhow::Result<()> {
        let conn = self.conn.lock().map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        conn.execute(
            "INSERT INTO config (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [key, value],
        )?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct QueuedEvent {
    pub id: i64,
    pub event_type: String,
    pub platform: Option<String>,
    pub domain: Option<String>,
    pub content_hash: Option<String>,
    pub prompt_excerpt: Option<String>,
    pub response_excerpt: Option<String>,
    pub rule_id: Option<String>,
    pub severity: Option<String>,
    pub metadata: Option<String>,
    pub occurred_at: String,
}
