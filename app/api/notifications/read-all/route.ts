import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function POST() {
  return handleAccess(async () => {
    const session = await requireSession();
    await getDB()
      .prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`)
      .bind(session.user.id)
      .run();
    return NextResponse.json({ ok: true });
  });
}
