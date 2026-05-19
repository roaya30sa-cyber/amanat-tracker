import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireAdmin, requireSession, handleAccess } from '@/lib/access';

export const runtime = 'edge';

// GET /api/projects  — every authenticated user can read the project list.
// Region managers only see their own project; admins see all.
export async function GET() {
  return handleAccess(async () => {
    const session = await requireSession();
    const db = getDB();
    if (session.user.role === 'admin') {
      const rs = await db.prepare(`SELECT * FROM projects ORDER BY id`).all();
      return NextResponse.json(rs.results ?? []);
    }
    if (!session.user.projectId) return NextResponse.json([]);
    const row = await db.prepare(`SELECT * FROM projects WHERE id = ?`).bind(session.user.projectId).first();
    return NextResponse.json(row ? [row] : []);
  });
}

// POST /api/projects  — admin only.
export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    await requireAdmin();
    const body = await req.json();
    const code = String(body.code ?? '').trim().toUpperCase();
    const nameAr = String(body.name_ar ?? '').trim();
    if (!code || !/^[A-Z0-9_]{2,40}$/.test(code)) throw NextResponse.json({ error: 'code: حروف إنجليزية/أرقام/_ بين 2-40' }, { status: 400 });
    if (!nameAr) throw NextResponse.json({ error: 'name_ar مطلوب' }, { status: 400 });

    const db = getDB();
    const exists = await db.prepare(`SELECT id FROM projects WHERE code = ?`).bind(code).first();
    if (exists) throw NextResponse.json({ error: 'الرمز مسجل مسبقاً' }, { status: 409 });

    const ins = await db.prepare(`
      INSERT INTO projects (code, name_ar, is_active, created_at)
      VALUES (?,?,?,?)
      RETURNING *
    `).bind(code, nameAr, body.is_active === false ? 0 : 1, Date.now()).first();
    return NextResponse.json(ins);
  });
}
