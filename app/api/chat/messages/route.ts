// GET  /api/chat/messages?with=<user_id>[&since=<ts>]  — messages between me and <with>.
// POST /api/chat/messages  body: { to_user_id, body }                 — send a message.

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const me = session.user.id;
    const url = new URL(req.url);
    const withId = parseInt(url.searchParams.get('with') ?? '');
    if (!withId) throw NextResponse.json({ error: 'with parameter required' }, { status: 400 });
    const sinceMs = parseInt(url.searchParams.get('since') ?? '');
    const useSince = Number.isFinite(sinceMs) && sinceMs > 0;

    const db = getDB();
    const sinceClause = useSince ? 'AND created_at > ?' : '';
    const binds: any[] = [me, withId, withId, me];
    if (useSince) binds.push(sinceMs);

    const rs = await db.prepare(`
      SELECT * FROM chat_messages
       WHERE ((from_user_id = ? AND to_user_id = ?)
           OR (from_user_id = ? AND to_user_id = ?))
       ${sinceClause}
       ORDER BY created_at ASC, id ASC
       LIMIT 500
    `).bind(...binds).all();

    return NextResponse.json(rs.results ?? []);
  });
}

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    const session = await requireSession();
    const me = session.user.id;
    const body = await req.json();
    const toUserId = parseInt(body.to_user_id);
    const text     = String(body.body ?? '').trim();
    if (!toUserId || toUserId === me) throw NextResponse.json({ error: 'recipient invalid' }, { status: 400 });
    if (!text) throw NextResponse.json({ error: 'الرسالة فارغة' }, { status: 400 });
    if (text.length > 4000) throw NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 });

    const db = getDB();
    // Validate recipient exists + active
    const r = await db.prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1`).bind(toUserId).first();
    if (!r) throw NextResponse.json({ error: 'المستلم غير موجود' }, { status: 400 });

    const ins = await db.prepare(`
      INSERT INTO chat_messages (from_user_id, to_user_id, body, is_read, created_at)
      VALUES (?,?,?,0,?)
      RETURNING *
    `).bind(me, toUserId, text, Date.now()).first();
    return NextResponse.json(ins);
  });
}
