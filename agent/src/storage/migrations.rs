use rusqlite::Connection;

/// Run all database migrations
pub fn run_migrations(conn: &Connection) -> anyhow::Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS config (
            key     TEXT PRIMARY KEY,
            value   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rules (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            version     INTEGER NOT NULL DEFAULT 1,
            category    TEXT NOT NULL,
            target      TEXT NOT NULL,
            condition   TEXT NOT NULL,  -- JSON
            action      TEXT NOT NULL,  -- JSON
            priority    INTEGER NOT NULL DEFAULT 0,
            enabled     INTEGER NOT NULL DEFAULT 1,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS event_queue (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type      TEXT NOT NULL,
            platform        TEXT,
            domain          TEXT,
            content_hash    TEXT,
            prompt_excerpt  TEXT,
            response_excerpt TEXT,
            rule_id         TEXT,
            severity        TEXT,
            metadata        TEXT,  -- JSON
            occurred_at     TEXT NOT NULL,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            synced          INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_event_queue_synced
            ON event_queue(synced, created_at);

        CREATE TABLE IF NOT EXISTS monitored_domains (
            domain      TEXT PRIMARY KEY,
            platform    TEXT,
            is_blocked  INTEGER NOT NULL DEFAULT 0
        );
        "
    )?;

    Ok(())
}
