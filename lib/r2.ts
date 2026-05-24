// R2 object-storage access helper. Mirrors the lib/db.ts pattern.
//
// The binding name `ATTACHMENTS` is declared in wrangler.toml under [[r2_buckets]].
// All circular attachments live in this single bucket, namespaced by object key:
//   circulars/{circular_id}/{uuid}.{ext}

import { getRequestContext } from '@cloudflare/next-on-pages';

interface Env {
  ATTACHMENTS: R2Bucket;
}

/**
 * Returns the bound R2 bucket. Throws if the binding isn't present —
 * a clear signal that wrangler.toml is missing the `[[r2_buckets]]` block
 * or that the Cloudflare Pages project isn't yet wired to R2.
 */
export function getR2(): R2Bucket {
  const ctx = getRequestContext();
  const env = ctx.env as unknown as Env;
  if (!env?.ATTACHMENTS) {
    throw new Error(
      'R2 bucket binding "ATTACHMENTS" not found. Ensure wrangler.toml has [[r2_buckets]] ' +
      'with binding="ATTACHMENTS" and bucket_name="amanat-attachments".'
    );
  }
  return env.ATTACHMENTS;
}

/** Produce a circular-scoped object key. The uuid stops filename collisions; the extension is preserved for content sniffing. */
export function makeAttachmentObjectKey(circularId: number, originalFileName: string): string {
  const ext = originalFileName.includes('.')
    ? originalFileName.split('.').pop()!.toLowerCase().slice(0, 12)
    : 'bin';
  // Edge runtime gives us crypto.randomUUID().
  const uuid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `circulars/${circularId}/${uuid}.${ext}`;
}

/** Acceptable upload types. Keep this conservative — we expect PDFs, images, Office docs. */
export const ALLOWED_CONTENT_TYPES = new Set<string>([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain', 'text/csv',
]);

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB per file
