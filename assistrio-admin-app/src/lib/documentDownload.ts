import { getAdminBotDocumentDownloadUrl } from '@/api/adminApi';
import type { AdminWorkspaceDocument } from '../api/types';

/** Canonical route id for downloads: KnowledgeBaseItem `_id` (preferred) or legacy `_id` form. */
export function canonicalDocumentKbId(
  doc: Pick<AdminWorkspaceDocument, '_id' | 'id' | 'knowledgeItemId'> | null | undefined,
): string {
  const k =
    typeof doc?.knowledgeItemId === 'string' && doc.knowledgeItemId.trim()
      ? doc.knowledgeItemId.trim()
      : typeof doc?.id === 'string' && doc.id.trim()
        ? doc.id.trim()
        : '';
  if (k) return k;
  const raw = doc?._id;
  if (raw && typeof raw === 'object' && raw !== null && 'toString' in raw)
    return String((raw as { toString(): string }).toString());
  return String(raw ?? '');
}

/**
 * Open the document file in a new tab using a server-issued URL (signed when private).
 * Uses `downloadUrl` from detail when present; otherwise calls the download-url endpoint with the KB item id.
 */
export async function openWorkspaceDocumentDownload(args: {
  botId: string;
  doc: Pick<
    AdminWorkspaceDocument,
    '_id' | 'id' | 'knowledgeItemId' | 'downloadUrl' | 'hasFile' | 'uploadStatus'
  >;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { botId, doc } = args;
  const direct = typeof doc.downloadUrl === 'string' ? doc.downloadUrl.trim() : '';
  if (direct && /^https?:\/\//i.test(direct)) {
    window.open(direct, '_blank', 'noopener,noreferrer');
    return { ok: true };
  }
  if (doc.hasFile === false) {
    return { ok: false, error: 'No downloadable file for this document.' };
  }
  const docId = canonicalDocumentKbId(doc);
  if (!docId) return { ok: false, error: 'Missing document id.' };
  const res = await getAdminBotDocumentDownloadUrl(botId, docId);
  if (!res.ok) return { ok: false, error: res.error };
  window.open(res.data.url, '_blank', 'noopener,noreferrer');
  return { ok: true };
}
