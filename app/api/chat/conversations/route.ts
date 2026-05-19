// GET /api/chat/conversations
//   Returns: { items: ChatConversation[], total_unread: number }
//
// Includes every active user (other than me) so the user can start a fresh conversation,
// plus the latest message + unread count if a conversation already exists.

import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function GET() {
  return handleAccess(async () => {
    const session = await requireSession();
    const me = session.user.id;
    const db = getDB();

    // Strategy:
    //   1. Pull all active users (excluding self) — these are the contacts.
    //   2. For each, pull the latest chat message (if any) and the unread count.
    //   3. Sort: conversations with messages first (newest first); then everyone else by username.
    //
    // For < ~50 users, in-memory join is fine on the edge.

    const [usersRes, lastRes, unreadRes] = await Promise.all([
      db.prepare(`
        SELECT id, username, full_name, role
          FROM users
         WHERE id != ? AND is_active = 1
      `).bind(me).all(),

      // Latest message per other-user
      db.prepare(`
        SELECT
          CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END AS other_id,
          body,
          created_at,
          from_user_id
        FROM chat_messages
        WHERE from_user_id = ? OR to_user_id = ?
        ORDER BY created_at DESC
      `).bind(me, me, me).all(),

      // Unread counts per from-user
      db.prepare(`
        SELECT from_user_id AS other_id, COUNT(*) AS unread
          FROM chat_messages
         WHERE to_user_id = ? AND is_read = 0
         GROUP BY from_user_id
      `).bind(me).all(),
    ]);

    const users   = (usersRes.results   ?? []) as any[];
    const lastMsgs = (lastRes.results  ?? []) as any[];
    const unreads  = (unreadRes.results ?? []) as any[];

    // Build a map of other_id → first row in lastMsgs (already ordered DESC → first hit is latest).
    const latestByOther = new Map<number, any>();
    for (const m of lastMsgs) {
      if (!latestByOther.has(m.other_id)) latestByOther.set(m.other_id, m);
    }
    const unreadByOther = new Map<number, number>();
    for (const u of unreads) unreadByOther.set(u.other_id, u.unread);

    const items = users.map(u => {
      const last = latestByOther.get(u.id);
      return {
        other_user_id: u.id,
        other_username: u.username,
        other_full_name: u.full_name,
        other_role: u.role,
        last_message: last?.body ?? null,
        last_message_at: last?.created_at ?? null,
        last_message_from_me: last ? last.from_user_id === me : false,
        unread_count: unreadByOther.get(u.id) ?? 0,
      };
    });

    items.sort((a, b) => {
      // Conversations with messages first
      if (!!a.last_message_at !== !!b.last_message_at) return a.last_message_at ? -1 : 1;
      if (a.last_message_at && b.last_message_at) return b.last_message_at - a.last_message_at;
      return a.other_username.localeCompare(b.other_username);
    });

    const total_unread = items.reduce((s, c) => s + c.unread_count, 0);
    return NextResponse.json({ items, total_unread });
  });
}
