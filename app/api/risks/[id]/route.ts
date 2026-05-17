import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, assertRegionAccess, handleAccess } from '@/lib/access';

export const runtime = 'edge';

async function loadRisk(id: number) {
  return getDB().prepare(`SELECT * FROM risks WHERE id = ?`).bind(id).first<any>();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });
    const id = parseInt(params.id);
    const existing = await loadRisk(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    assertRegionAccess(session, existing.region_id);
    const body = await req.json();
    if (session.user.role !== 'admin' && body.region_id && parseInt(body.region_id) !== existing.region_id) {
      throw NextResponse.json({ error: 'cannot change region' }, { status: 403 });
    }
    const updates: string[] = []; const binds: any[] = [];
    const allowed = ['risk_description','affected_project','category','probability','impact','response_plan','owner','status','notes'];
    for (const k of allowed) if (k in body) { updates.push(`${k} = ?`); binds.push(body[k]); }
    if (session.user.role === 'admin' && 'region_id' in body) { updates.push('region_id = ?'); binds.push(parseInt(body.region_id)); }
    if (!updates.length) return NextResponse.json(existing);
    updates.push('updated_at = ?'); binds.push(Date.now()); binds.push(id);
    const db = getDB();
    await db.prepare(`UPDATE risks SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
    const full = await db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM risks JOIN regions r ON r.id = risks.region_id WHERE risks.id = ?
    `).bind(id).first();
    return NextResponse.json(full);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });
    const id = parseInt(params.id);
    const existing = await loadRisk(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    assertRegionAccess(session, existing.region_id);
    await getDB().prepare(`DELETE FROM risks WHERE id = ?`).bind(id).run();
    return NextResponse.json({ ok: true });
  });
}
