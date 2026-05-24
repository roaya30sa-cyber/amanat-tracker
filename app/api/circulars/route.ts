// GET  /api/circulars  — list circulars visible to the current user.
// POST /api/circulars  — admin creates a new circular (one-way broadcast).
//
// Visibility:
//   admin            → every circular in the active project scope
//   regional_manager → circulars where they are listed as recipient

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, requireAdmin, projectScope, writeProjectId, handleAccess } from '@/lib/access';
import { createNotification, detectAndNotifyCircularDeadlinesFor } from '@/lib/notifications';

export const runtime = 'edge';

// Build the SELECT projection used everywhere a circular goes back to the client.
function selectClauseForUser(userId: number): string {
  return `
    c.*,
    cb.username AS created_by_name,
    pj.name_ar  AS project_name_ar,
    (SELECT COUNT(*) FROM circular_recipients WHERE circular_id = c.id) AS total_recipients,
    (SELECT COUNT(*) FROM circular_recipients WHERE circular_id = c.id AND acknowledged_at IS NOT NULL) AS acknowledged_count,
    (SELECT acknowledged_at FROM circular_recipients WHERE circular_id = c.id AND user_id = ${userId}) AS my_acknowledged_at,
    EXISTS(SELECT 1 FROM circular_recipients WHERE circular_id = c.id AND user_id = ${userId}) AS is_my_recipient
    FROM circulars c
    LEFT JOIN users    cb ON cb.id = c.created_by
    LEFT JOIN projects pj ON pj.id = c.project_id
  `;
}

function decorate(row: any) {
  if (!row) return row;
  const nowMs = Date.now();
  const deadlineMs = row.ack_deadline ? Date.parse(row.ack_deadline + 'T23:59:59Z') : NaN;
  const isOverdue = Number.isFinite(deadlineMs) && deadlineMs < nowMs
    && row.acknowledged_count < row.total_recipients;
  const isMyOverdue = Number.isFinite(deadlineMs) && deadlineMs < nowMs
    && row.is_my_recipient && !row.my_acknowledged_at;
  return {
    ...row,
    is_my_recipient: !!row.is_my_recipient,
    is_overdue:    isOverdue,
    is_my_overdue: isMyOverdue,
  };
}

export async function GET(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const db = getDB();
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter'); // 'inbox' | 'sent' | 'all'

    const conds: string[] = [];
    const binds: any[] = [];

    const pScope = projectScope(session);
    if (pScope !== null) {
      // Admin in single-project mode → restrict to that project (NULL project_id = cross-project; show those too).
      conds.push('(c.project_id = ? OR c.project_id IS NULL)');
      binds.push(pScope);
    }

    if (session.user.role !== 'admin') {
      // Non-admin only sees circulars where they're a recipient
      conds.push(`EXISTS(SELECT 1 FROM circular_recipients WHERE circular_id = c.id AND user_id = ${session.user.id})`);
    }
    if (filter === 'inbox') {
      conds.push(`EXISTS(SELECT 1 FROM circular_recipients WHERE circular_id = c.id AND user_id = ${session.user.id})`);
    }
    if (filter === 'sent') {
      conds.push('c.created_by = ?');
      binds.push(session.user.id);
    }
    // hide archived by default
    if (url.searchParams.get('include_archived') !== '1') {
      conds.push("c.status = 'active'");
    }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rs = await db.prepare(`
      SELECT ${selectClauseForUser(session.user.id)}
      ${where}
      ORDER BY c.created_at DESC, c.id DESC
    `).bind(...binds).all();

    const decorated = (rs.results ?? []).map(decorate);

    // Fire-and-forget: surface reminder/overdue notifications for circulars the user owes acks on.
    detectAndNotifyCircularDeadlinesFor(session.user.id).catch(() => {});
    return NextResponse.json(decorated);
  });
}

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireAdmin();
    const body = await req.json();

    const title = String(body.title ?? '').trim();
    const bodyText = String(body.body ?? '').trim();
    if (!title)    throw NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 });
    if (!bodyText) throw NextResponse.json({ error: 'نص التعميم مطلوب' }, { status: 400 });

    const audience: 'all_managers' | 'specific' =
      body.audience === 'specific' ? 'specific' : 'all_managers';
    const ackDeadline: string | null = body.ack_deadline || null;

    // project_id: admins in "all" mode must pick one (or NULL for cross-project)
    let projectId: number | null;
    if (body.project_id === null || body.project_id === 'null') {
      projectId = null;
    } else if (body.project_id) {
      projectId = parseInt(body.project_id);
    } else {
      // Default: active project from cookie. If admin is in "all" mode → NULL (cross-project).
      projectId = projectScope(session);
    }

    const db = getDB();
    const now = Date.now();

    // Compute recipient list
    let recipientIds: number[] = [];
    if (audience === 'specific') {
      const raw = Array.isArray(body.recipient_ids) ? body.recipient_ids : [];
      recipientIds = raw.map((v: any) => parseInt(v)).filter((n: number) => Number.isFinite(n) && n > 0);
      if (recipientIds.length === 0) throw NextResponse.json({ error: 'يجب اختيار مستلم واحد على الأقل' }, { status: 400 });
    } else {
      // all_managers within project (or all projects if projectId === null)
      const sql = projectId === null
        ? `SELECT id FROM users WHERE role = 'regional_manager' AND is_active = 1`
        : `SELECT id FROM users WHERE role = 'regional_manager' AND is_active = 1 AND project_id = ?`;
      const r = projectId === null
        ? await db.prepare(sql).all()
        : await db.prepare(sql).bind(projectId).all();
      recipientIds = (r.results ?? []).map((row: any) => row.id);
      if (recipientIds.length === 0) throw NextResponse.json({ error: 'لا يوجد مدراء مناطق في هذا المشروع' }, { status: 400 });
    }

    // Insert circular
    const ins = await db.prepare(`
      INSERT INTO circulars (project_id, created_by, title, body, audience, ack_deadline, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?, 'active', ?, ?)
      RETURNING id
    `).bind(projectId, session.user.id, title, bodyText, audience, ackDeadline, now, now)
      .first<{ id: number }>();
    if (!ins) throw NextResponse.json({ error: 'insert failed' }, { status: 500 });

    // Insert recipients in a single batch
    const stmts = recipientIds.map(uid =>
      db.prepare(`INSERT INTO circular_recipients (circular_id, user_id) VALUES (?,?)`).bind(ins.id, uid)
    );
    await db.batch(stmts);

    // Notify each recipient
    for (const uid of recipientIds) {
      await createNotification({
        user_id: uid,
        kind: 'circular_new',
        circular_id: ins.id,
        title: 'تعميم جديد من الإدارة',
        body: title.slice(0, 200),
      });
    }

    // Return decorated
    const full = await db.prepare(`SELECT ${selectClauseForUser(session.user.id)} WHERE c.id = ?`)
      .bind(ins.id).first();
    return NextResponse.json(decorate(full));
  });
}
