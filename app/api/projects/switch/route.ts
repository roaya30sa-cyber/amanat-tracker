// POST /api/projects/switch  — admin sets the active project for their session.
// Stores the choice in the `amanat_active_project` cookie which projectScope() reads.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, handleAccess, PROJECT_COOKIE } from '@/lib/access';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  return handleAccess(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const raw = body.project_id;
    let cookieValue = 'all';
    if (raw && raw !== 'all') {
      const n = parseInt(String(raw), 10);
      if (Number.isFinite(n) && n > 0) cookieValue = String(n);
    }
    const res = NextResponse.json({ ok: true, project_id: cookieValue });
    res.cookies.set(PROJECT_COOKIE, cookieValue, {
      path: '/',
      httpOnly: false,           // also readable client-side for UI sync
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  });
}
