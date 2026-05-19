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
    const db = getDB();

    const { where, binds } = buildScopeClause({
      regionScope:  regionScope(session),
      projectScope: projectScope(session),
      qRegionId:  url.searchParams.get('regionId'),
      qProjectId: url.searchParams.get('projectId'),
      prefix: 'risks',
    });

    const rs = await db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM risks
        JOIN regions r ON r.id = risks.region_id
        LEFT JOIN projects p ON p.id = risks.project_id
        ${where}
        ORDER BY risks.id
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

    if (!body.risk_description?.trim()) throw NextResponse.json({ error: 'risk_description مطلوب' }, { status: 400 });
    const prob = Math.max(1, Math.min(5, parseInt(body.probability) || 1));
    const imp  = Math.max(1, Math.min(5, parseInt(body.impact) || 1));
    const now = Date.now();
    const db = getDB();
    const ins = await db.prepare(`
      INSERT INTO risks (region_id, project_id, risk_description, affected_project, category, probability, impact, response_plan, owner, status, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
    `).bind(
      regionId, projectId, body.risk_description.trim(), body.affected_project ?? null, body.category ?? null,
      prob, imp, body.response_plan ?? null, body.owner ?? null,
      body.status ?? 'open', body.notes ?? null, now, now,
    ).first();
    const full = await db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM risks
        JOIN regions r ON r.id = risks.region_id
        LEFT JOIN projects p ON p.id = risks.project_id
       WHERE risks.id = ?
    `).bind((ins as any).id).first();
    return NextResponse.json(full);
  });
}
