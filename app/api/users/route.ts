import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireAdmin, handleAccess } from '@/lib/access';
import { hashPassword } from '@/lib/password';

export const runtime = 'edge';

const SAFE_USER_COLUMNS = `id, username, email, full_name, role, region_id, project_id, must_change_password, last_login_at, is_active, created_at`;

export async function GET() {
  return handleAccess(async () => {
    await requireAdmin();
    const rs = await getDB().prepare(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.region_id, u.project_id,
             u.must_change_password, u.last_login_at, u.is_active, u.created_at,
             r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM users u
        LEFT JOIN regions  r ON r.id = u.region_id
        LEFT JOIN projects p ON p.id = u.project_id
       ORDER BY u.id`).all();
    return NextResponse.json(rs.results ?? []);
  });
}

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    await requireAdmin();
    const body = await req.json();

    const username = String(body.username ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const role     = body.role;
    if (!username) throw NextResponse.json({ error: 'username مطلوب' }, { status: 400 });
    if (!/^[a-z0-9_.-]{3,32}$/i.test(username)) throw NextResponse.json({ error: 'username: 3-32 حرف، إنجليزي/أرقام/_.-' }, { status: 400 });
    if (!role) throw NextResponse.json({ error: 'role مطلوب' }, { status: 400 });
    if (!['admin','regional_manager','viewer'].includes(role)) throw NextResponse.json({ error: 'role غير صحيح' }, { status: 400 });
    if (password.length < 8) throw NextResponse.json({ error: 'كلمة المرور 8 أحرف على الأقل' }, { status: 400 });

    const regionId  = role === 'admin' ? null : (body.region_id  ? parseInt(body.region_id)  : null);
    const projectId = role === 'admin' ? null : (body.project_id ? parseInt(body.project_id) : null);
    if (role !== 'admin' && !regionId)  throw NextResponse.json({ error: 'region_id مطلوب للأدوار غير الإدارية' }, { status: 400 });
    if (role !== 'admin' && !projectId) throw NextResponse.json({ error: 'project_id مطلوب للأدوار غير الإدارية' }, { status: 400 });

    const db = getDB();
    const existing = await db.prepare(`SELECT id FROM users WHERE LOWER(username) = ?`).bind(username).first();
    if (existing) throw NextResponse.json({ error: 'اسم المستخدم مسجل مسبقاً' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const ins = await db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, role, region_id, project_id, must_change_password, is_active, created_at)
      VALUES (?,?,?,?,?,?,?,1,1,?)
      RETURNING ${SAFE_USER_COLUMNS}
    `).bind(
      username,
      body.email ? String(body.email).trim().toLowerCase() : null,
      passwordHash,
      body.full_name ?? null,
      role,
      regionId,
      projectId,
      Date.now(),
    ).first();
    return NextResponse.json(ins);
  });
}
