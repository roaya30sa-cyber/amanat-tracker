import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, assertRegionAccess, handleAccess } from '@/lib/access';

export const runtime = 'edge';

async function loadTask(id: number) {
  const db = getDB();
  return db.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first<any>();
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const t = await loadTask(parseInt(params.id));
    if (!t) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    assertRegionAccess(session, t.region_id);
    return NextResponse.json(t);
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });
    const id = parseInt(params.id);
    const existing = await loadTask(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    assertRegionAccess(session, existing.region_id);
    if (session.user.role !== 'admin') {
      // Non-admins cannot move a task to a different region
      const body0 = await req.clone().json().catch(() => ({}));
      if (body0.region_id && parseInt(body0.region_id) !== existing.region_id) {
        throw NextResponse.json({ error: 'forbidden: cannot change region' }, { status: 403 });
      }
    }
    const body = await req.json();

    const updates: string[] = [];
    const binds: any[] = [];
    const allowed = ['task_name','phase','deadline','responsible_person','status','priority','completion_percent','notes'];
    for (const k of allowed) {
      if (k in body) { updates.push(`${k} = ?`); binds.push(body[k]); }
    }
    if (session.user.role === 'admin' && 'region_id' in body) { updates.push('region_id = ?'); binds.push(parseInt(body.region_id)); }
    if (updates.length === 0) return NextResponse.json(existing);

    updates.push(`updated_at = ?`); binds.push(Date.now());
    binds.push(id);
    const db = getDB();
    await db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
    const full = await db.prepare(`
      SELECT t.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM tasks t JOIN regions r ON r.id = t.region_id WHERE t.id = ?
    `).bind(id).first();
    return NextResponse.json(full);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    if (session.user.role === 'viewer') throw NextResponse.json({ error: 'viewer cannot write' }, { status: 403 });
    const id = parseInt(params.id);
    const existing = await loadTask(id);
    if (!existing) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    assertRegionAccess(session, existing.region_id);
    const db = getDB();
    await db.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
    return NextResponse.json({ ok: true });
  });
}
