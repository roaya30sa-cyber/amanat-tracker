import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireAdmin, handleAccess } from '@/lib/access';

export const runtime = 'edge';

const SAFE_USER_COLUMNS = `id, username, email, full_name, role, region_id, must_change_password, last_login_at, is_active, created_at`;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    await requireAdmin();
    const id = parseInt(params.id);
    const body = await req.json();
    const updates: string[] = []; const binds: any[] = [];
    if ('full_name' in body) { updates.push('full_name = ?'); binds.push(body.full_name); }
    if ('email' in body)     { updates.push('email = ?');     binds.push(body.email ? String(body.email).toLowerCase() : null); }
    if ('role' in body) {
      if (!['admin','regional_manager','viewer'].includes(body.role)) throw NextResponse.json({ error: 'role غير صحيح' }, { status: 400 });
      updates.push('role = ?'); binds.push(body.role);
      // Admin role => clear region_id automatically (unless explicitly set)
      if (body.role === 'admin' && !('region_id' in body)) { updates.push('region_id = NULL'); }
    }
    if ('region_id' in body) { updates.push('region_id = ?'); binds.push(body.region_id); }
    if ('is_active' in body) { updates.push('is_active = ?'); binds.push(body.is_active ? 1 : 0); }
    if (!updates.length) throw NextResponse.json({ error: 'no changes' }, { status: 400 });
    binds.push(id);
    const db = getDB();
    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
    const row = await db.prepare(`SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first();
    return NextResponse.json(row);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireAdmin();
    const id = parseInt(params.id);
    if (id === session.user.id) throw NextResponse.json({ error: 'لا يمكن حذف نفسك' }, { status: 400 });
    await getDB().prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
    return NextResponse.json({ ok: true });
  });
}
