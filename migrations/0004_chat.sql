-- =====================================================================
-- migrations/0004_chat.sql
-- Phase 5: User-to-user chat. 1-to-1 messages, polled every ~10s.
-- =====================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS chat_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id  INTEGER NOT NULL REFERENCES users(id),
  to_user_id    INTEGER NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')*1000)
);

-- For loading a conversation between two users in time order:
CREATE INDEX IF NOT EXISTS idx_chat_pair_from ON chat_messages(from_user_id, to_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_pair_to   ON chat_messages(to_user_id,   from_user_id, created_at);
-- For unread-count + inbox listing:
CREATE INDEX IF NOT EXISTS idx_chat_unread    ON chat_messages(to_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_chat_created   ON chat_messages(created_at);

PRAGMA foreign_keys = ON;
