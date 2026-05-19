import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireAdmin, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    await requireAdmin();
    const id = parseInt(params.id);
    const body = await req.json();
    const updates: string[] = []; const binds: any[] = [];
    if ('name_ar'   in body) { updates.push('name_ar = ?');   binds.push(String(body.name_ar).trim()); }
    if ('is_active' in body) { updates.push('is_active = ?'); binds.push(body.is_active ? 1 : 0); }
    if (!updates.length) throw NextResponse.json({ error: 'no changes' }, { status: 400 });
    binds.push(id);
    const db = getDB();
    await db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
    const row = await db.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
    return NextResponse.json(row);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    await requireAdmin();
    const id = parseInt(params.id);
    if (id === 1) throw NextResponse.json({ error: 'لا يمكن حذف المشروع الأصلي' }, { status: 400 });
    // Soft delete by setting is_active = 0 (preserves FK integrity for existing tasks/risks/users).
    const db = getDB();
    await db.prepare(`UPDATE projects SET is_active = 0 WHERE id = ?`).bind(id).run();
    return NextResponse.json({ ok: true });
  });
}
