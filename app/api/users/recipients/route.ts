// GET /api/users/recipients  — list of users eligible to receive an obstacle from the current user.
// - If current user is admin: returns regional_managers in the active project.
// - If current user is regional_manager: returns admins.

import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, projectScope, handleAccess } from '@/lib/access';

export const runtime = 'edge';

export async function GET() {
  return handleAccess(async () => {
    const session = await requireSession();
    const db = getDB();

    if (session.user.role === 'admin') {
      // Pick region managers; if a specific project is active, scope to it.
      const pScope = projectScope(session);
      const where = pScope ? 'WHERE role = ? AND is_active = 1 AND project_id = ?' : 'WHERE role = ? AND is_active = 1';
      const binds = pScope ? ['regional_manager', pScope] : ['regional_manager'];
      const rs = await db.prepare(`
        SELECT id, username, full_name, role, region_id, project_id
          FROM users
          ${where}
          ORDER BY full_name, username
      `).bind(...binds).all();
      return NextResponse.json(rs.results ?? []);
    }

    if (session.user.role === 'regional_manager') {
      const rs = await db.prepare(`
        SELECT id, username, full_name, role, region_id, project_id
          FROM users
          WHERE role = 'admin' AND is_active = 1
          ORDER BY full_name, username
      `).all();
      return NextResponse.json(rs.results ?? []);
    }

    return NextResponse.json([]);
  });
}
