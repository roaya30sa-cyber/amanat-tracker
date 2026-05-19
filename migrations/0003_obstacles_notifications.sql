-- =====================================================================
-- migrations/0003_obstacles_notifications.sql
-- Phase 2: العوائق التشغيلية (operational obstacles) + in-app notifications.
--
-- - New `obstacles` table — a two-party request/ticket between admin and a region manager.
--   Status flow:
--     pending_approval  → admin reviews proposed due date
--     approved          → due date confirmed, awaiting action
--     in_progress       → recipient is working on it
--     resolved          → done
--     rejected          → admin rejected
--   "Overdue" is computed at read time (approved_due_date < now AND status NOT IN ('resolved','rejected')).
--
-- - New `notifications` table — user-scoped in-app notifications.
--
-- - The old `weekly_reports` table is left in place so historical data is preserved,
--   but it's removed from the sidebar (page becomes archived/read-only path is unused).
--
-- Safe to re-run: uses IF NOT EXISTS / INSERT OR IGNORE.
-- =====================================================================

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------
-- 1. obstacles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS obstacles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id   INTEGER NOT NULL REFERENCES projects(id),
  region_id    INTEGER REFERENCES regions(id),       -- region of the non-admin party (for filters/labels)
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id   INTEGER NOT NULL REFERENCES users(id),
  statement    TEXT NOT NULL,                         -- البيان
  request      TEXT,                                  -- الطلب
  notes        TEXT,                                  -- الملاحظة
  status       TEXT NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN ('pending_approval','approved','in_progress','resolved','rejected')),
  proposed_due_date TEXT,                             -- YYYY-MM-DD, set by sender on create
  approved_due_date TEXT,                             -- YYYY-MM-DD, set by admin on approval (may differ from proposed)
  approved_by  INTEGER REFERENCES users(id),
  approved_at  INTEGER,
  resolved_at  INTEGER,
  rejected_reason TEXT,
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
  updated_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

CREATE INDEX IF NOT EXISTS idx_obstacles_project ON obstacles(project_id);
CREATE INDEX IF NOT EXISTS idx_obstacles_from    ON obstacles(from_user_id);
CREATE INDEX IF NOT EXISTS idx_obstacles_to      ON obstacles(to_user_id);
CREATE INDEX IF NOT EXISTS idx_obstacles_status  ON obstacles(status);
CREATE INDEX IF NOT EXISTS idx_obstacles_due     ON obstacles(approved_due_date);

-- ---------------------------------------------------------------------
-- 2. notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL,
  obstacle_id INTEGER REFERENCES obstacles(id),
  title       TEXT NOT NULL,
  body        TEXT,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_obstacle    ON notifications(obstacle_id);

PRAGMA foreign_keys = ON;
