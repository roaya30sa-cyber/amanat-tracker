-- =====================================================================
-- migrations/0002_multi_project.sql
-- Phase 1: multi-project support.
--
-- - Adds the `projects` table.
-- - Adds `project_id` to regions, users, tasks, risks, weekly_reports.
-- - Seeds project #1 = "مشاريع الأمانة" (the original) and project #2 = "أمانة الرياض" (empty).
-- - Existing rows are tagged with project_id=1 so nothing is orphaned.
-- - Admin users (role='admin') get project_id=NULL → super-admin view (see all projects).
--
-- Safe to re-run thanks to IF NOT EXISTS / INSERT OR IGNORE.
-- D1 ALTER TABLE ADD COLUMN is idempotent only the first time — re-running this whole file
-- will fail the second ALTER. So this migration is run-once.
-- =====================================================================

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------
-- 1. projects table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name_ar     TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

INSERT OR IGNORE INTO projects (id, code, name_ar) VALUES (1, 'AMANAT_MAIN',   'مشاريع الأمانة');
INSERT OR IGNORE INTO projects (id, code, name_ar) VALUES (2, 'AMANAT_RIYADH', 'أمانة الرياض');

-- ---------------------------------------------------------------------
-- 2. Add project_id columns
-- ---------------------------------------------------------------------
ALTER TABLE regions          ADD COLUMN project_id INTEGER DEFAULT 1;
ALTER TABLE users            ADD COLUMN project_id INTEGER DEFAULT 1;
ALTER TABLE tasks            ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE risks            ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE weekly_reports   ADD COLUMN project_id INTEGER NOT NULL DEFAULT 1;

-- Admins become super-admins (no project scope)
UPDATE users SET project_id = NULL WHERE role = 'admin';

-- ---------------------------------------------------------------------
-- 3. Indexes for project filtering
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_project   ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_project  ON weekly_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_regions_project ON regions(project_id);
CREATE INDEX IF NOT EXISTS idx_users_project   ON users(project_id);

PRAGMA foreign_keys = ON;
