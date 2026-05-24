// GET    /api/circulars/[id]/attachments/[attachmentId]  — stream the file from R2 (admin or recipient)
// DELETE /api/circulars/[id]/attachments/[attachmentId]  — admin who owns the circular only

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, requireAdmin, handleAccess } from '@/lib/access';
import { getR2 } from '@/lib/r2';

export const runtime = 'edge';

async function isAuthorisedToView(circularId: number, userId: number, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const db = getDB();
  const r = await db.prepare(`SELECT 1 AS x FROM circular_recipients WHERE circular_id = ? AND user_id = ?`)
    .bind(circularId, userId).first<{ x: number }>();
  return !!r;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; attachmentId: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const circularId = parseInt(params.id);
    const attId = parseInt(params.attachmentId);

    const db = getDB();
    const a = await db.prepare(`
      SELECT object_key, file_name, content_type, file_size, circular_id
        FROM circular_attachments
       WHERE id = ? AND circular_id = ?
    `).bind(attId, circularId).first<{
      object_key: string; file_name: string; content_type: string | null; file_size: number; circular_id: number;
    }>();
    if (!a) throw NextResponse.json({ error: 'not found' }, { status: 404 });

    if (!await isAuthorisedToView(a.circular_id, session.user.id, session.user.role)) {
      throw NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const r2 = getR2();
    const obj = await r2.get(a.object_key);
    if (!obj) throw NextResponse.json({ error: 'الملف غير موجود في التخزين' }, { status: 404 });

    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type': a.content_type ?? 'application/octet-stream',
        'Content-Length': String(a.file_size),
        // Encoded so Arabic file names survive the round-trip.
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(a.file_name)}`,
        'Cache-Control': 'private, max-age=60',
      },
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; attachmentId: string } }) {
  return handleAccess(async () => {
    const session = await requireAdmin();
    const circularId = parseInt(params.id);
    const attId = parseInt(params.attachmentId);

    const db = getDB();
    const a = await db.prepare(`
      SELECT a.id, a.object_key, c.created_by
        FROM circular_attachments a
        JOIN circulars c ON c.id = a.circular_id
       WHERE a.id = ? AND a.circular_id = ?
    `).bind(attId, circularId).first<{ id: number; object_key: string; created_by: number }>();
    if (!a) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    if (a.created_by !== session.user.id) {
      throw NextResponse.json({ error: 'forbidden: لست منشئ هذا التعميم' }, { status: 403 });
    }

    // Best-effort delete from R2; metadata row is removed either way so the UI stays consistent.
    try {
      await getR2().delete(a.object_key);
    } catch (e) {
      console.error('R2 delete failed', e);
    }
    await db.prepare(`DELETE FROM circular_attachments WHERE id = ?`).bind(attId).run();
    return NextResponse.json({ ok: true });
  });
}
