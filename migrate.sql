-- Run this against the existing bedrock D1 database to apply schema changes

CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

ALTER TABLE services ADD COLUMN last_checked_at INTEGER DEFAULT NULL;
