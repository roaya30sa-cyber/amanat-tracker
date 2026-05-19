// PATCH /api/obstacles/[id]  — approve, reject, change status, resolve, edit fields.
// DELETE /api/obstacles/[id]  — delete (sender or admin only).

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';
import { createNotification, decorateObstacle } from '@/lib/notifications';
import type { ObstacleStatus } from '@/lib/types';

export const runtime = 'edge';

const ALLOWED_TRANSITIONS: Record<ObstacleStatus, ObstacleStatus[]> = {
  pending_approval: ['approved', 'rejected'],
  approved:         ['in_progress', 'resolved', 'rejected'],
  in_progress:      ['resolved', 'rejected'],
  resolved:         [],
  rejected:         [],
};

async function loadObstacle(id: number) {
  return getDB().prepare(`SELECT * FROM obstacles WHERE id = ?`).bind(id).first<any>();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const id = parseInt(params.id);
    const existing = await loadObstacle(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });

    const isAdmin = session.user.role === 'admin';
    const isSender   = existing.from_user_id === session.user.id;
    const isRecipient = existing.to_user_id  === session.user.id;
    if (!isAdmin && !isSender && !isRecipient) {
      throw NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const updates: string[] = []; const binds: any[] = [];

    // Status transitions
    if ('status' in body) {
      const next = body.status as ObstacleStatus;
      if (!ALLOWED_TRANSITIONS[existing.status as ObstacleStatus]?.includes(next)) {
        throw NextResponse.json({ error: `لا يمكن الانتقال من ${existing.status} إلى ${next}` }, { status: 400 });
      }
      // Approval rules
      if (next === 'approved' || next === 'rejected') {
        if (!isAdmin) throw NextResponse.json({ error: 'الاعتماد/الرفض للمدير فقط' }, { status: 403 });
        updates.push('approved_by = ?', 'approved_at = ?');
        binds.push(session.user.id, Date.now());
        if (next === 'approved') {
          const due = body.approved_due_date ?? existing.proposed_due_date;
          if (!due) throw NextResponse.json({ error: 'تاريخ الاستحقاق المعتمد مطلوب' }, { status: 400 });
          updates.push('approved_due_date = ?');
          binds.push(due);
        }
        if (next === 'rejected' && body.rejected_reason) {
          updates.push('rejected_reason = ?');
          binds.push(String(body.rejected_reason));
        }
      }
      if (next === 'resolved') {
        updates.push('resolved_at = ?');
        binds.push(Date.now());
      }
      updates.push('status = ?');
      binds.push(next);
    }

    // Plain field edits (only sender or admin before approval; admin always)
    const editable = ['statement','request','notes','proposed_due_date','approved_due_date'];
    for (const k of editable) {
      if (k in body) {
        if (!isAdmin && existing.status !== 'pending_approval') {
          throw NextResponse.json({ error: 'لا يمكن تعديل البيانات بعد الاعتماد' }, { status: 403 });
        }
        if (k === 'approved_due_date' && !isAdmin) {
          throw NextResponse.json({ error: 'تعديل تاريخ الاستحقاق المعتمد للمدير فقط' }, { status: 403 });
        }
        updates.push(`${k} = ?`);
        binds.push(body[k]);
      }
    }

    if (!updates.length) return NextResponse.json(existing);
    updates.push('updated_at = ?');
    binds.push(Date.now());
    binds.push(id);

    const db = getDB();
    await db.prepare(`UPDATE obstacles SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

    // Fire notifications based on transitions
    if (body.status === 'approved')   {
      await createNotification({ user_id: existing.from_user_id, kind: 'obstacle_approved',   obstacle_id: id,
        title: 'تم اعتماد عائقك', body: existing.statement?.slice(0, 200) });
    }
    if (body.status === 'rejected')   {
      await createNotification({ user_id: existing.from_user_id, kind: 'obstacle_rejected',   obstacle_id: id,
        title: 'تم رفض عائقك', body: body.rejected_reason ?? null });
    }
    if (body.status === 'in_progress') {
      await createNotification({ user_id: existing.from_user_id, kind: 'obstacle_in_progress', obstacle_id: id,
        title: 'بدأ تنفيذ عائقك', body: existing.statement?.slice(0, 200) });
    }
    if (body.status === 'resolved')   {
      // Notify the other party
      const otherId = session.user.id === existing.from_user_id ? existing.to_user_id : existing.from_user_id;
      await createNotification({ user_id: otherId, kind: 'obstacle_resolved', obstacle_id: id,
        title: 'تم حل العائق', body: existing.statement?.slice(0, 200) });
    }

    const full = await db.prepare(`
      SELECT o.*, fu.username AS from_user_name, fu.role AS from_user_role,
             tu.username AS to_user_name, tu.role AS to_user_role,
             rg.name_ar AS region_name_ar, pj.name_ar AS project_name_ar
        FROM obstacles o
        JOIN users fu ON fu.id = o.from_user_id
        JOIN users tu ON tu.id = o.to_user_id
        LEFT JOIN regions  rg ON rg.id = o.region_id
        LEFT JOIN projects pj ON pj.id = o.project_id
       WHERE o.id = ?
    `).bind(id).first();
    return NextResponse.json(decorateObstacle(full));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const id = parseInt(params.id);
    const existing = await loadObstacle(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && existing.from_user_id !== session.user.id) {
      throw NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    await getDB().prepare(`DELETE FROM obstacles WHERE id = ?`).bind(id).run();
    return NextResponse.json({ ok: true });
  });
}
