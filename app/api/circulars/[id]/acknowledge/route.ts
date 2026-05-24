// POST /api/circulars/[id]/acknowledge  — recipient confirms they read the circular.
//
// - 403 if the caller is not a listed recipient.
// - 409 if they have already acknowledged (acknowledgement is final by design).
// - On success: writes acknowledged_at + optional note; notifies admin if everyone has now acked.

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';
import { createNotification } from '@/lib/notifications';

export const runtime = 'edge';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const id = parseInt(params.id);
    const body = await req.json().catch(() => ({}));
    const note = body.note ? String(body.note).trim().slice(0, 1000) : null;

    const db = getDB();
    const myRow = await db.prepare(`
      SELECT acknowledged_at FROM circular_recipients WHERE circular_id = ? AND user_id = ?
    `).bind(id, session.user.id).first<{ acknowledged_at: number | null }>();
    if (!myRow) throw NextResponse.json({ error: 'لست ضمن مستلمي هذا التعميم' }, { status: 403 });
    if (myRow.acknowledged_at) throw NextResponse.json({ error: 'تم التأكيد مسبقاً' }, { status: 409 });

    const now = Date.now();
    await db.prepare(`
      UPDATE circular_recipients
         SET acknowledged_at = ?, acknowledged_note = ?
       WHERE circular_id = ? AND user_id = ?
    `).bind(now, note, id, session.user.id).run();

    // If this was the last pending recipient → tell the circular owner.
    const counts = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM circular_recipients WHERE circular_id = ?) AS total,
        (SELECT COUNT(*) FROM circular_recipients WHERE circular_id = ? AND acknowledged_at IS NOT NULL) AS acked,
        (SELECT title FROM circulars WHERE id = ?) AS title,
        (SELECT created_by FROM circulars WHERE id = ?) AS created_by
    `).bind(id, id, id, id).first<{ total: number; acked: number; title: string; created_by: number }>();

    if (counts && counts.acked === counts.total) {
      await createNotification({
        user_id: counts.created_by, kind: 'circular_all_acked', circular_id: id,
        title: 'اكتمل تأكيد التعميم',
        body: `جميع المستلمين أكدوا استلام "${String(counts.title).slice(0, 80)}".`,
      });
    }

    return NextResponse.json({ ok: true, acknowledged_at: now });
  });
}
