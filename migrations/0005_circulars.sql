-- =====================================================================
-- migrations/0005_circulars.sql
-- نظام التعاميم — admin → regional managers, one-way broadcast with per-recipient acknowledgement.
--
-- - `circulars` is the memo itself (one row).
-- - `circular_recipients` is the join — one row per recipient, carrying their ack status.
-- - `circular_attachments` is reserved for the R2-backed file uploads in a follow-up commit.
--   The table exists now so we don't have to migrate the database again for it.
--
-- Status flow:
--   create  → recipients seeded (acknowledged_at = NULL)
--   read    → notification 'circular_new' sent to each recipient
--   ack     → recipient sets acknowledged_at = now; notifies admin if 'all_acked' threshold met
--   edit    → optionally resets ALL recipient acknowledged_at to NULL + notification 'circular_updated'
--   archive → status = 'archived'; circular hidden from inbox but kept for audit
--
-- "Overdue" is computed at read time: ack_deadline < today AND acknowledged_at IS NULL.
-- =====================================================================

PRAGMA foreign_keys = OFF;

-- ---------------------------------------------------------------------
-- 1. circulars
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS circulars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id    INTEGER REFERENCES projects(id),
  created_by    INTEGER NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  audience      TEXT NOT NULL DEFAULT 'all_managers'
                  CHECK (audience IN ('all_managers','specific')),
  ack_deadline  TEXT,                              -- YYYY-MM-DD, optional
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived')),
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000),
  updated_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

CREATE INDEX IF NOT EXISTS idx_circulars_project   ON circulars(project_id);
CREATE INDEX IF NOT EXISTS idx_circulars_created_by ON circulars(created_by);
CREATE INDEX IF NOT EXISTS idx_circulars_status    ON circulars(status);
CREATE INDEX IF NOT EXISTS idx_circulars_deadline  ON circulars(ack_deadline);

-- ---------------------------------------------------------------------
-- 2. circular_recipients
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS circular_recipients (
  circular_id        INTEGER NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  acknowledged_at    INTEGER,                       -- NULL while pending; ms epoch on ack
  acknowledged_note  TEXT,                          -- optional comment from recipient on ack
  reminder_24h_sent  INTEGER NOT NULL DEFAULT 0,    -- idempotency flag (set when daily reminder fires)
  overdue_sent       INTEGER NOT NULL DEFAULT 0,    -- idempotency flag for overdue notification
  PRIMARY KEY (circular_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circular_recipients_user_ack ON circular_recipients(user_id, acknowledged_at);

-- ---------------------------------------------------------------------
-- 3. circular_attachments  (R2-backed; rows only exist once R2 is wired)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS circular_attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  circular_id   INTEGER NOT NULL REFERENCES circulars(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  content_type  TEXT,
  object_key    TEXT NOT NULL,                      -- R2 bucket object key
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  uploaded_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

CREATE INDEX IF NOT EXISTS idx_circular_attachments_circular ON circular_attachments(circular_id);

PRAGMA foreign_keys = ON;
