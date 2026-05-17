// POST /api/account/password — user changes their own password (must know current one).
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';
import { verifyPassword, hashPassword } from '@/lib/password';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const { current_password, new_password } = await req.json();
    if (!current_password || !new_password) throw NextResponse.json({ error: 'الحقول مطلوبة' }, { status: 400 });
    if (String(new_password).length < 8) throw NextResponse.json({ error: 'كلمة المرور الجديدة قصيرة (8 أحرف على الأقل)' }, { status: 400 });

    const db = getDB();
    const row = await db.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(session.user.id).first<{ password_hash: string }>();
    if (!row) throw NextResponse.json({ error: 'user not found' }, { status: 404 });

    const ok = await verifyPassword(String(current_password), row.password_hash);
    if (!ok) throw NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 });

    const newHash = await hashPassword(String(new_password));
    await db.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`)
      .bind(newHash, session.user.id).run();
    return NextResponse.json({ ok: true });
  });
}
