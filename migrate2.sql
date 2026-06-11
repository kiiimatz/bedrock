-- Add sort_order to groups and services for manual ordering

ALTER TABLE groups   ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE services ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
