CREATE TABLE IF NOT EXISTS services (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'up',
  uptime     REAL NOT NULL DEFAULT 100.0,
  protocols  TEXT NOT NULL DEFAULT '[]',
  history         TEXT NOT NULL DEFAULT '[]',
  last_checked_at INTEGER DEFAULT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS incidents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  svc        TEXT NOT NULL DEFAULT 'All services',
  message    TEXT NOT NULL DEFAULT '',
  resolved   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS maintenance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  svc        TEXT NOT NULL DEFAULT 'All services',
  start_at   TEXT NOT NULL,
  end_at     TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  attempted_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
