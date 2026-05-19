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
    const url = new URL(req.url);
    const { where, binds } = buildScopeClause({
      regionScope:  regionScope(session),
      projectScope: projectScope(session),
      qRegionId:  url.searchParams.get('regionId'),
      qProjectId: url.searchParams.get('projectId'),
      prefix: 'w',
    });

    const db = getDB();
    const rs = await db.prepare(`
      SELECT w.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM weekly_reports w
        JOIN regions r ON r.id = w.region_id
        LEFT JOIN projects p ON p.id = w.project_id
        ${where}
        ORDER BY w.report_date DESC
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

    if (!body.current_task?.trim() || !body.report_date) throw NextResponse.json({ error: 'مطلوب: المهمة الحالية والتاريخ' }, { status: 400 });
    const db = getDB();
    const ins = await db.prepare(`
      INSERT INTO weekly_reports (region_id, project_id, report_date, current_task, priority, obstacles, solution_plan, required_resources, follow_up_date, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id
    `).bind(
      regionId, projectId, body.report_date, body.current_task.trim(), body.priority ?? null,
      body.obstacles ?? null, body.solution_plan ?? null, body.required_resources ?? null,
      body.follow_up_date ?? null, Date.now(),
    ).first();
    const full = await db.prepare(`
      SELECT w.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM weekly_reports w
        JOIN regions r ON r.id = w.region_id
        LEFT JOIN projects p ON p.id = w.project_id
       WHERE w.id = ?
    `).bind((ins as any).id).first();
    return NextResponse.json(full);
  });
}
