import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const id = parseInt(params.id);
    await getDB()
      .prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
      .bind(id, session.user.id)
      .run();
    return NextResponse.json({ ok: true });
  });
}
