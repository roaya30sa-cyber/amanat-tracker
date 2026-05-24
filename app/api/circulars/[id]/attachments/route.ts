// GET  /api/circulars/[id]/attachments  — list attachments (admin or recipient)
// POST /api/circulars/[id]/attachments  — upload a file (admin who owns the circular only)
//
// Files are stored in R2 under key  `circulars/{id}/{uuid}.{ext}`. Metadata lives in D1
// so the access-control checks can stay fast (no R2 round-trip required for listing).

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, requireAdmin, handleAccess } from '@/lib/access';
import { getR2, makeAttachmentObjectKey, ALLOWED_CONTENT_TYPES, MAX_ATTACHMENT_BYTES } from '@/lib/r2';

export const runtime = 'edge';

/** True if the user is the admin who created the circular OR a listed recipient. */
async function canViewCircular(circularId: number, userId: number, role: string): Promise<boolean> {
  if (role === 'admin') return true;
  const db = getDB();
  const r = await db.prepare(`SELECT 1 AS x FROM circular_recipients WHERE circular_id = ? AND user_id = ?`)
    .bind(circularId, userId).first<{ x: number }>();
  return !!r;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireSession();
    const circularId = parseInt(params.id);
    if (!await canViewCircular(circularId, session.user.id, session.user.role)) {
      throw NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const db = getDB();
    const rs = await db.prepare(`
      SELECT a.id, a.circular_id, a.file_name, a.file_size, a.content_type,
             a.object_key, a.uploaded_by, a.uploaded_at,
             u.username AS uploaded_by_name
        FROM circular_attachments a
        LEFT JOIN users u ON u.id = a.uploaded_by
       WHERE a.circular_id = ?
       ORDER BY a.uploaded_at
    `).bind(circularId).all();
    return NextResponse.json(rs.results ?? []);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return handleAccess(async () => {
    const session = await requireAdmin();
    const circularId = parseInt(params.id);

    const db = getDB();
    // Confirm the circular exists + the admin opening it is authorised to touch it.
    const circ = await db.prepare(`SELECT id, created_by, status FROM circulars WHERE id = ?`)
      .bind(circularId).first<{ id: number; created_by: number; status: string }>();
    if (!circ) throw NextResponse.json({ error: 'not found' }, { status: 404 });
    if (circ.status !== 'active') throw NextResponse.json({ error: 'لا يمكن إضافة مرفقات لتعميم مؤرشف' }, { status: 400 });
    // Only the original creator can attach. Future: allow any admin if desired.
    if (circ.created_by !== session.user.id) {
      throw NextResponse.json({ error: 'forbidden: لست منشئ هذا التعميم' }, { status: 403 });
    }

    // Parse multipart form-data
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) throw NextResponse.json({ error: 'يجب إرفاق ملف باسم الحقل "file"' }, { status: 400 });
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw NextResponse.json({ error: `حجم الملف يتجاوز الحد الأقصى (${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB)` }, { status: 413 });
    }
    if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) {
      throw NextResponse.json({ error: `نوع الملف غير مسموح: ${file.type}` }, { status: 415 });
    }

    const r2 = getR2();
    const objectKey = makeAttachmentObjectKey(circularId, file.name);
    // Stream upload to R2.
    await r2.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
        contentDisposition: `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
      customMetadata: {
        circular_id: String(circularId),
        uploaded_by: String(session.user.id),
        original_name: file.name,
      },
    });

    // Record in D1 (R2 is now the source of truth for bytes; D1 tracks metadata + access).
    const ins = await db.prepare(`
      INSERT INTO circular_attachments (circular_id, file_name, file_size, content_type, object_key, uploaded_by, uploaded_at)
      VALUES (?,?,?,?,?,?,?)
      RETURNING id, circular_id, file_name, file_size, content_type, object_key, uploaded_by, uploaded_at
    `).bind(
      circularId, file.name, file.size, file.type || null, objectKey, session.user.id, Date.now(),
    ).first();
    return NextResponse.json(ins);
  });
}
