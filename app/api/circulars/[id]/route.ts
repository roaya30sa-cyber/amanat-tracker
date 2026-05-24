// GET    /api/circulars/[id]  — detail with full recipient list
// PATCH  /api/circulars/[id]  — admin edit (resets all acks + re-notifies if body/title changed)
// DELETE /api/circulars/[id]  — admin archive

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, requireAdmin, handleAccess } from '@/lib/access';
import { createNotification } from '@/lib/notifications';

export const runtime = 'edge';

async function loadCircular(id: number) {
  const db = getDB();
  return db.prepare(`SELECT * FROM circulars WHERE id = ?`).bind(id).first<any>();
}

async function isUserRecipient(circularId: number, userId: number): Promise<boolean> {
  const db = getDB();
  const row = await db.prepare(`SELECT 1 AS x FROM circular_recipients WHERE circular_id = ? AND user_id = ?`)
    .bind(circularId, userId).first<{ x: number }>();
  return !!row;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const id = parseInt(params.id);
    const circ = await loadCircular(id);
    if (!circ) throw NextResponse.json({ error: 'not found' }, { status: 404 });

    // Authorization: admin OR a listed recipient
    const allowed = session.user.role === 'admin' || (await isUserRecipient(id, session.user.id));
    if (!allowed) throw NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const db = getDB();
    const recipientsRs = await db.prepare(`
      SELECT cr.user_id, cr.acknowledged_at, cr.acknowledged_note,
             u.username AS user_username, u.full_name AS user_full_name,
             u.region_id AS user_region_id,
             r.name_ar  AS user_region_name_ar
        FROM circular_recipients cr
        JOIN users u   ON u.id = cr.user_id
        LEFT JOIN regions r ON r.id = u.region_id
       WHERE cr.circular_id = ?
       ORDER BY (cr.acknowledged_at IS NULL) DESC, cr.acknowledged_at ASC, u.username
    `).bind(id).all();

    const recipients = recipientsRs.results ?? [];
    const acknowledgedCount = recipients.filter((r: any) => r.acknowledged_at).length;
    const myAck = recipients.find((r: any) => r.user_id === session.user.id);

    return NextResponse.json({
      circular: { ...circ, acknowledged_count: acknowledgedCount, total_recipients: recipients.length },
      recipients,
      my_acknowledged_at: myAck?.acknowledged_at ?? null,
      is_my_recipient: !!myAck,
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireAdmin();
    const id = parseInt(params.id);
    const existing = await loadCircular(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    const body = await req.json();

    const updates: string[] = [];
    const binds: any[] = [];
    let contentChanged = false;
    if ('title'        in body) { updates.push('title = ?');        binds.push(String(body.title).trim());                    contentChanged = true; }
    if ('body'         in body) { updates.push('body = ?');         binds.push(String(body.body).trim());                     contentChanged = true; }
    if ('ack_deadline' in body) { updates.push('ack_deadline = ?'); binds.push(body.ack_deadline || null); }
    if ('status'       in body) {
      if (!['active','archived'].includes(body.status)) throw NextResponse.json({ error: 'invalid status' }, { status: 400 });
      updates.push('status = ?'); binds.push(body.status);
    }
    if (!updates.length) return NextResponse.json(existing);

    updates.push('updated_at = ?'); binds.push(Date.now());
    binds.push(id);
    const db = getDB();
    await db.prepare(`UPDATE circulars SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

    // If title or body changed → reset all acks and re-notify
    if (contentChanged) {
      await db.prepare(`
        UPDATE circular_recipients
           SET acknowledged_at = NULL, acknowledged_note = NULL,
               reminder_24h_sent = 0, overdue_sent = 0
         WHERE circular_id = ?
      `).bind(id).run();

      const recipientsRs = await db.prepare(`SELECT user_id FROM circular_recipients WHERE circular_id = ?`).bind(id).all();
      const title = String(body.title ?? existing.title).slice(0, 200);
      for (const r of (recipientsRs.results ?? []) as any[]) {
        await createNotification({
          user_id: r.user_id, kind: 'circular_updated', circular_id: id,
          title: 'تم تعديل تعميم — يلزم إعادة التأكيد',
          body: title,
        });
      }
    }

    const row = await db.prepare(`SELECT * FROM circulars WHERE id = ?`).bind(id).first();
    return NextResponse.json(row);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    await requireAdmin();
    const id = parseInt(params.id);
    const db = getDB();
    // Soft delete — archive so the audit trail is preserved.
    await db.prepare(`UPDATE circulars SET status = 'archived', updated_at = ? WHERE id = ?`)
      .bind(Date.now(), id).run();
    return NextResponse.json({ ok: true });
  });
}
