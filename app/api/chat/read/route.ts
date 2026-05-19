// POST /api/chat/read  body: { from_user_id }
// Marks all messages from <from_user_id> to me as read.

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const body = await req.json();
    const fromId = parseInt(body.from_user_id);
    if (!fromId) throw NextResponse.json({ error: 'from_user_id required' }, { status: 400 });
    await getDB()
      .prepare(`UPDATE chat_messages SET is_read = 1 WHERE to_user_id = ? AND from_user_id = ? AND is_read = 0`)
      .bind(session.user.id, fromId)
      .run();
    return NextResponse.json({ ok: true });
  });
}
