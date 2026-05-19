import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import {
  requireSession, assertRegionAccess, regionScope, projectScope, writeProjectId,
  buildScopeClause, handleAccess,
} from '@/lib/access';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const db = getDB();
    const url = new URL(req.url);

    const { where, binds } = buildScopeClause({
      regionScope:  regionScope(session),
      projectScope: projectScope(session),
      qRegionId:  url.searchParams.get('regionId'),
      qProjectId: url.searchParams.get('projectId'),
      prefix: 't',
    });

    const rs = await db.prepare(`
      SELECT t.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM tasks t
        JOIN regions  r ON r.id = t.region_id
        LEFT JOIN projects p ON p.id = t.project_id
        ${where}
        ORDER BY t.id
    `).bind(...binds).all();
    return NextResponse.json(rs.results ?? []);
  });
}

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });
    const body = await req.json();

    const regionId  = parseInt(body.region_id);
    assertRegionAccess(session, regionId);
    const projectId = writeProjectId(session, body.project_id ? parseInt(body.project_id) : null);

    if (!body.task_name?.trim()) throw NextResponse.json({ error: 'task_name مطلوب' }, { status: 400 });
    const now = Date.now();
    const db = getDB();
    const ins = await db.prepare(`
      INSERT INTO tasks (region_id, project_id, task_name, phase, deadline, responsible_person, status, priority, completion_percent, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      RETURNING id
    `).bind(
      regionId, projectId, body.task_name.trim(), body.phase ?? null, body.deadline ?? null,
      body.responsible_person ?? null, body.status, body.priority ?? null,
      Math.max(0, Math.min(100, parseInt(body.completion_percent) || 0)),
      body.notes ?? null, now, now,
    ).first();
    if (!ins) throw NextResponse.json({ error: 'insert failed' }, { status: 500 });

    // Re-fetch with region + project info to match Task shape
    const full = await db.prepare(`
      SELECT t.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM tasks t
        JOIN regions  r ON r.id = t.region_id
        LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.id = ?
    `).bind((ins as any).id).first();
    return NextResponse.json(full);
  });
}
