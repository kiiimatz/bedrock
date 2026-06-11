-- Daily uptime records: one row per (service, day)
CREATE TABLE IF NOT EXISTS service_days (
  service_id INTEGER NOT NULL,
  day        TEXT    NOT NULL,  -- 'YYYY-MM-DD' UTC
  pct        REAL    NOT NULL DEFAULT 100,
  has_down   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service_id, day)
);

-- In-progress day counters on services (current day accumulator)
ALTER TABLE services ADD COLUMN check_day   TEXT    DEFAULT NULL;
ALTER TABLE services ADD COLUMN check_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN check_up    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN check_down  INTEGER NOT NULL DEFAULT 0;
