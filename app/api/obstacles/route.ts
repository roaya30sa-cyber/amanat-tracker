// GET  /api/obstacles  — list obstacles visible to the current user (project- and party-scoped).
// POST /api/obstacles  — open a new obstacle. Region manager → pending_approval; admin → auto-approved.

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import {
  requireSession, projectScope, writeProjectId, handleAccess,
} from '@/lib/access';
import { createNotification, decorateObstacle, detectAndNotifyOverdueFor } from '@/lib/notifications';

export const runtime = 'edge';

// SELECT … FROM obstacles  with party + project labels
const OBSTACLE_SELECT = `
  o.*,
  fu.username AS from_user_name, fu.role AS from_user_role,
  tu.username AS to_user_name,   tu.role AS to_user_role,
  rg.name_ar   AS region_name_ar,
  pj.name_ar   AS project_name_ar
  FROM obstacles o
  JOIN users    fu ON fu.id = o.from_user_id
  JOIN users    tu ON tu.id = o.to_user_id
  LEFT JOIN regions  rg ON rg.id = o.region_id
  LEFT JOIN projects pj ON pj.id = o.project_id
`;

export async function GET(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const db = getDB();
    const url = new URL(req.url);
    const filter = url.searchParams.get('filter'); // 'inbox' | 'sent' | 'all'

    const conds: string[] = [];
    const binds: any[] = [];

    const pScope = projectScope(session);
    if (pScope !== null) { conds.push('o.project_id = ?'); binds.push(pScope); }

    if (session.user.role !== 'admin') {
      // Non-admins only see obstacles where they are sender or recipient.
      conds.push('(o.from_user_id = ? OR o.to_user_id = ?)');
      binds.push(session.user.id, session.user.id);
    }
    if (filter === 'inbox') { conds.push('o.to_user_id = ?');   binds.push(session.user.id); }
    if (filter === 'sent')  { conds.push('o.from_user_id = ?'); binds.push(session.user.id); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rs = await db.prepare(`
      SELECT ${OBSTACLE_SELECT}
      ${where}
      ORDER BY o.created_at DESC, o.id DESC
    `).bind(...binds).all();

    const decorated = (rs.results ?? []).map(decorateObstacle);
    // Fire-and-forget: turn any newly-overdue ones into bell notifications for this user.
    detectAndNotifyOverdueFor(session.user.id, decorated).catch(() => {});
    return NextResponse.json(decorated);
  });
}

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });

    const body = await req.json();
    const statement = String(body.statement ?? '').trim();
    if (!statement) throw NextResponse.json({ error: 'البيان مطلوب' }, { status: 400 });

    const toUserId = parseInt(body.to_user_id);
    if (!toUserId || toUserId === session.user.id) throw NextResponse.json({ error: 'المستلم غير صحيح' }, { status: 400 });

    const projectId = writeProjectId(session, body.project_id ? parseInt(body.project_id) : null);

    const db = getDB();
    // Validate recipient: must be admin or regional_manager within the same project (or any admin if sender is region manager).
    const recipient = await db.prepare(`
      SELECT id, role, project_id, region_id FROM users WHERE id = ? AND is_active = 1
    `).bind(toUserId).first<{ id: number; role: string; project_id: number | null; region_id: number | null }>();
    if (!recipient) throw NextResponse.json({ error: 'المستلم غير موجود' }, { status: 400 });

    // Restrict cycle: admin↔regional_manager only (the spec requires this).
    const senderRole = session.user.role;
    const recvRole   = recipient.role;
    const validCycle =
      (senderRole === 'admin' && recvRole === 'regional_manager') ||
      (senderRole === 'regional_manager' && recvRole === 'admin');
    if (!validCycle) throw NextResponse.json({ error: 'العلاقة بين المرسل والمستلم غير مسموح بها' }, { status: 403 });

    // Region: if recipient is a regional manager, use their region; otherwise sender's region.
    const regionId =
      (recipient.role === 'regional_manager' && recipient.region_id) ||
      session.user.regionId ||
      null;

    // Admin-opened obstacles are auto-approved (admin sets the due date).
    const adminOpening = senderRole === 'admin';
    const now = Date.now();
    const status = adminOpening ? 'approved' : 'pending_approval';
    const approvedDue = adminOpening ? (body.proposed_due_date ?? null) : null;
    const approvedBy  = adminOpening ? session.user.id : null;
    const approvedAt  = adminOpening ? now : null;

    const ins = await db.prepare(`
      INSERT INTO obstacles (project_id, region_id, from_user_id, to_user_id, statement, request, notes,
                             status, proposed_due_date, approved_due_date, approved_by, approved_at,
                             created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      RETURNING id
    `).bind(
      projectId, regionId, session.user.id, toUserId,
      statement, body.request ?? null, body.notes ?? null,
      status, body.proposed_due_date ?? null, approvedDue, approvedBy, approvedAt,
      now, now,
    ).first<{ id: number }>();
    if (!ins) throw NextResponse.json({ error: 'insert failed' }, { status: 500 });

    // Notify recipient.
    await createNotification({
      user_id: toUserId,
      kind: 'obstacle_new',
      obstacle_id: ins.id,
      title: adminOpening ? 'طلب جديد من الإدارة' : 'عائق جديد بانتظار الاعتماد',
      body: statement.slice(0, 200),
    });

    const full = await db.prepare(`SELECT ${OBSTACLE_SELECT} WHERE o.id = ?`).bind(ins.id).first();
    return NextResponse.json(decorateObstacle(full));
  });
}
