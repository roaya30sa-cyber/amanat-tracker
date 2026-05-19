// GET /api/notifications  — list current user's notifications (newest first).
//   Query: ?unread=1 to filter to unread; ?limit=N (default 50).
// Returns { items, unread_count }.

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get('unread') === '1';
    const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') ?? '50')));

    const db = getDB();
    const where = unreadOnly ? 'WHERE user_id = ? AND is_read = 0' : 'WHERE user_id = ?';

    const [itemsRes, countRes] = await Promise.all([
      db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ?`).bind(session.user.id, limit).all(),
      db.prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`).bind(session.user.id).first<{ c: number }>(),
    ]);

    return NextResponse.json({
      items: itemsRes.results ?? [],
      unread_count: countRes?.c ?? 0,
    });
  });
}
