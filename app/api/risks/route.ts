import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, assertRegionAccess, regionScope, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const url = new URL(req.url);
    const qRegionId = url.searchParams.get('regionId');
    const db = getDB();
    let where = ''; const binds: any[] = [];
    const scope = regionScope(session);
    if (scope !== null) { where = 'WHERE risks.region_id = ?'; binds.push(scope); }
    else if (qRegionId) { where = 'WHERE risks.region_id = ?'; binds.push(parseInt(qRegionId)); }
    const rs = await db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM risks JOIN regions r ON r.id = risks.region_id
        ${where} ORDER BY risks.id
    `).bind(...binds).all();
    return NextResponse.json(rs.results ?? []);
  });
}

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });
    const body = await req.json();
    const regionId = parseInt(body.region_id);
    assertRegionAccess(session, regionId);
    if (!body.risk_description?.trim()) throw NextResponse.json({ error: 'risk_description مطلوب' }, { status: 400 });
    const prob = Math.max(1, Math.min(5, parseInt(body.probability) || 1));
    const imp  = Math.max(1, Math.min(5, parseInt(body.impact) || 1));
    const now = Date.now();
    const db = getDB();
    const ins = await db.prepare(`
      INSERT INTO risks (region_id, risk_description, affected_project, category, probability, impact, response_plan, owner, status, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *
    `).bind(
      regionId, body.risk_description.trim(), body.affected_project ?? null, body.category ?? null,
      prob, imp, body.response_plan ?? null, body.owner ?? null,
      body.status ?? 'open', body.notes ?? null, now, now,
    ).first();
    const full = await db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM risks JOIN regions r ON r.id = risks.region_id WHERE risks.id = ?
    `).bind((ins as any).id).first();
    return NextResponse.json(full);
  });
}
