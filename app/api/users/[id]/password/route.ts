// POST /api/users/[id]/password — admin sets/resets a user's password.
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireAdmin, handleAccess } from '@/lib/access';
import { hashPassword } from '@/lib/password';

export const runtime = 'edge';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    await requireAdmin();
    const id = parseInt(params.id);
    const { password, must_change_password } = await req.json();
    if (!password || String(password).length < 8) throw NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });
    const hash = await hashPassword(String(password));
    const mustChange = must_change_password === false ? 0 : 1; // default: force change on next login
    const db = getDB();
    const r = await db.prepare(`UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?`)
      .bind(hash, mustChange, id).run();
    if (!r.success) throw NextResponse.json({ error: 'update failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  });
}
