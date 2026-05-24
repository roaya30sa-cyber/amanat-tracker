// Helpers for creating in-app notifications + detecting overdue obstacles.
//
// All callers run inside an edge-runtime API route with a live D1 binding.

import type { NotificationKind, Obstacle } from './types';
import { getDB } from './db';

interface CreateNotificationInput {
  user_id: number;
  kind: NotificationKind;
  obstacle_id?: number | null;
  circular_id?: number | null;
  title: string;
  body?: string | null;
}

/** Insert a notification. Best-effort: failures are swallowed (logged) so they never break the parent mutation. */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const db = getDB();
    await db.prepare(`
      INSERT INTO notifications (user_id, kind, obstacle_id, circular_id, title, body, is_read, created_at)
      VALUES (?,?,?,?,?,?,0,?)
    `).bind(
      input.user_id,
      input.kind,
      input.obstacle_id ?? null,
      input.circular_id ?? null,
      input.title,
      input.body ?? null,
      Date.now(),
    ).run();
  } catch (e) {
    console.error('createNotification failed', e);
  }
}

/**
 * Idempotent overdue notification: only inserts an `obstacle_overdue` notification
 * if one doesn't already exist for the same (user_id, obstacle_id).
 */
export async function notifyOverdueOnce(userId: number, obstacleId: number, title: string, body: string): Promise<void> {
  try {
    const db = getDB();
    const existing = await db.prepare(`
      SELECT id FROM notifications
       WHERE user_id = ? AND obstacle_id = ? AND kind = 'obstacle_overdue'
       LIMIT 1
    `).bind(userId, obstacleId).first();
    if (existing) return;
    await createNotification({
      user_id: userId, kind: 'obstacle_overdue', obstacle_id: obstacleId, title, body,
    });
  } catch (e) {
    console.error('notifyOverdueOnce failed', e);
  }
}

/** YYYY-MM-DD difference in days (positive = future). */
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr + 'T23:59:59Z');
  if (!Number.isFinite(t)) return null;
  const diffMs = t - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/** Decorate an obstacle row with is_overdue + days_remaining. */
export function decorateObstacle(o: any): Obstacle {
  const days = daysUntil(o.approved_due_date);
  const overdue = !!(o.approved_due_date && days !== null && days < 0 &&
                     o.status !== 'resolved' && o.status !== 'rejected');
  return { ...o, days_remaining: days, is_overdue: overdue };
}

/**
 * Run overdue detection for the current user's visible obstacles.
 * Creates one `obstacle_overdue` notification per (user, obstacle) the first time it crosses the line.
 * Returns the list of obstacles that were freshly flagged.
 */
export async function detectAndNotifyOverdueFor(userId: number, obstacles: Obstacle[]): Promise<number[]> {
  const overdueIds: number[] = [];
  for (const o of obstacles) {
    if (!o.is_overdue) continue;
    // Only notify the parties involved (from_user + to_user) — caller passes their own list.
    if (userId !== o.from_user_id && userId !== o.to_user_id) continue;
    const body = `العائق "${o.statement.slice(0, 80)}" تجاوز تاريخ الاستحقاق المعتمد.`;
    await notifyOverdueOnce(userId, o.id, 'عائق متأخر عن موعده', body);
    overdueIds.push(o.id);
  }
  return overdueIds;
}

// =====================================================================
// Circulars (Phase 6) — reminder/overdue detection
// =====================================================================

/**
 * Fire reminder + overdue notifications for circulars the given user is a recipient of.
 *
 * - 24h-reminder: when ack_deadline is within the next 24h AND user hasn't acked AND reminder_24h_sent=0
 * - overdue:      when ack_deadline < now           AND user hasn't acked AND overdue_sent=0
 *
 * Both branches set the corresponding idempotency flag on circular_recipients so each notification fires at most once.
 * Called from inside circular API reads so it never needs a background scheduler.
 */
export async function detectAndNotifyCircularDeadlinesFor(userId: number): Promise<void> {
  try {
    const db = getDB();
    const nowMs = Date.now();
    const in24hMs = nowMs + 24 * 60 * 60 * 1000;

    const rows = await db.prepare(`
      SELECT cr.circular_id, cr.reminder_24h_sent, cr.overdue_sent,
             c.title, c.ack_deadline, c.status
        FROM circular_recipients cr
        JOIN circulars c ON c.id = cr.circular_id
       WHERE cr.user_id = ?
         AND cr.acknowledged_at IS NULL
         AND c.status = 'active'
         AND c.ack_deadline IS NOT NULL
    `).bind(userId).all();

    for (const r of (rows.results ?? []) as any[]) {
      const deadlineMs = Date.parse(r.ack_deadline + 'T23:59:59Z');
      if (!Number.isFinite(deadlineMs)) continue;

      if (deadlineMs < nowMs && !r.overdue_sent) {
        await createNotification({
          user_id: userId, kind: 'circular_overdue', circular_id: r.circular_id,
          title: 'تعميم بدون تأكيد استلام',
          body: `التعميم "${String(r.title).slice(0, 80)}" تجاوز الموعد النهائي للتأكيد.`,
        });
        await db.prepare(`UPDATE circular_recipients SET overdue_sent = 1 WHERE circular_id = ? AND user_id = ?`)
          .bind(r.circular_id, userId).run();
        continue;
      }
      if (deadlineMs >= nowMs && deadlineMs <= in24hMs && !r.reminder_24h_sent) {
        await createNotification({
          user_id: userId, kind: 'circular_reminder', circular_id: r.circular_id,
          title: 'تذكير: تعميم بانتظار تأكيدك',
          body: `يتبقى أقل من 24 ساعة لتأكيد استلام "${String(r.title).slice(0, 80)}".`,
        });
        await db.prepare(`UPDATE circular_recipients SET reminder_24h_sent = 1 WHERE circular_id = ? AND user_id = ?`)
          .bind(r.circular_id, userId).run();
      }
    }
  } catch (e) {
    console.error('detectAndNotifyCircularDeadlinesFor failed', e);
  }
}
