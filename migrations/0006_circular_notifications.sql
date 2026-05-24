-- =====================================================================
-- migrations/0006_circular_notifications.sql
-- Add `circular_id` column to the existing notifications table so circular-related
-- notifications can carry a back-reference, just like obstacle_id does for obstacles.
-- =====================================================================

PRAGMA foreign_keys = OFF;

ALTER TABLE notifications ADD COLUMN circular_id INTEGER REFERENCES circulars(id);
CREATE INDEX IF NOT EXISTS idx_notifications_circular ON notifications(circular_id);

PRAGMA foreign_keys = ON;
