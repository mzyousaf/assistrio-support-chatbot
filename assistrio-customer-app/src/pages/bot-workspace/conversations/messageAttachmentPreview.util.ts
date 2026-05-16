import type { CustomerConversationMessageAttachment } from '@/api/types';

export type AttachmentLike = CustomerConversationMessageAttachment & Record<string, unknown>;

/** First http(s) URL among common attachment field names. */
export function pickSafeHttpUrlFromAttachmentFields(a: AttachmentLike): string {
  const candidates = [a.url, a.downloadUrl, a.publicUrl, a.href].filter((x): x is string => typeof x === 'string');
  for (const c of candidates) {
    const t = c.trim();
    if (!t) continue;
    try {
      const u = new URL(t);
      if (u.protocol === 'http:' || u.protocol === 'https:') return t;
    } catch {
      /* ignore */
    }
  }
  return '';
}

export function normalizeCustomerMessageAttachment(a: AttachmentLike) {
  const name =
    String(a.name ?? a.filename ?? a.fileName ?? a.originalName ?? 'File attached').trim() || 'File attached';
  const mimeType = String(a.mimeType ?? a.mime ?? a.contentType ?? a.type ?? '').trim();
  let size: number | undefined;
  if (typeof a.size === 'number' && Number.isFinite(a.size)) size = a.size;
  else if (typeof a.bytes === 'number' && Number.isFinite(a.bytes)) size = a.bytes;
  else if (typeof a.sizeBytes === 'number' && Number.isFinite(a.sizeBytes)) size = a.sizeBytes;
  const safeUrl = pickSafeHttpUrlFromAttachmentFields(a);
  return { name, mimeType, size, safeUrl };
}
