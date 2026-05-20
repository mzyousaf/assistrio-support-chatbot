import { adminFetch } from './client';
import type { ApiResult } from './types';
import type {
  AdminAgentTrainingStatusResponse,
  AdminDocumentDownloadUrlResponse,
  AdminDocumentUploadResponse,
  AdminDocumentsResponse,
  AdminKnowledgeItemManualRetryResponse,
  AdminKnowledgeOverviewResponse,
  AdminKnowledgeStatusResponse,
  AdminPendingTrainingItemsResponse,
  AdminWorkspaceDocument,
} from './types';

const knowledgePath = (botId: string) => `/api/admin/bots/${encodeURIComponent(botId)}/knowledge`;
const documentsPath = (botId: string) => `/api/admin/bots/${encodeURIComponent(botId)}/documents`;

export function getAdminBotAgentTrainingStatus(botId: string) {
  return adminFetch<AdminAgentTrainingStatusResponse>(`${knowledgePath(botId)}/training/status`);
}

export function getAdminBotKnowledgePendingTrainingItems(botId: string) {
  return adminFetch<AdminPendingTrainingItemsResponse>(`${knowledgePath(botId)}/training/pending-items`);
}

export function postAdminBotRetrainAgent(
  botId: string,
  body?: { includeFailed?: boolean; forceRetrain?: boolean },
) {
  return adminFetch<AdminAgentTrainingStatusResponse>(`${knowledgePath(botId)}/training/retrain-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? { includeFailed: true }),
  });
}

export function patchAdminBotKnowledgeTrainingSettings(
  botId: string,
  body: { autoTrainEnabled?: boolean; trainingDelayMinutes?: number },
) {
  return adminFetch<AdminKnowledgeOverviewResponse>(`${knowledgePath(botId)}/training-settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchAdminBotKnowledgeReplyPriority(
  botId: string,
  body: {
    knowledgeReplyPriority: {
      mode: 'default' | 'priority';
      sourceOrder: Array<'faq' | 'note' | 'table' | 'document' | 'suggestion'>;
    };
  },
) {
  return adminFetch<unknown>(`/api/admin/bots/${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postAdminBotKnowledgeItemRetry(botId: string, itemId: string) {
  return adminFetch<AdminKnowledgeItemManualRetryResponse>(
    `${knowledgePath(botId)}/items/${encodeURIComponent(itemId)}/retry`,
    { method: 'POST' },
  );
}

export function postAdminBotKnowledgeItemsBulkDelete(botId: string, itemIds: string[]) {
  return adminFetch<{ ok: true; deleted: number }>(`${knowledgePath(botId)}/items/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemIds }),
  });
}

export function deleteAdminBotKnowledgeItem(botId: string, itemId: string) {
  return postAdminBotKnowledgeItemsBulkDelete(botId, [itemId]);
}

export function getAdminBotKnowledgeStatus(
  botId: string,
  params?: {
    type?: 'faq' | 'note' | 'table' | 'document' | 'suggestion' | 'all';
    itemId?: string;
  },
) {
  const sp = new URLSearchParams();
  if (params?.type && params.type !== 'all') sp.set('type', params.type);
  if (params?.itemId?.trim()) sp.set('itemId', params.itemId.trim());
  const q = sp.toString() ? `?${sp}` : '';
  return adminFetch<AdminKnowledgeStatusResponse>(`${knowledgePath(botId)}/status${q}`);
}

export function postAdminKnowledgeFaq(botId: string, body: Record<string, unknown>) {
  return adminFetch<{ ok: true; index: number }>(`${knowledgePath(botId)}/faqs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchAdminKnowledgeFaq(botId: string, faqIndex: number, body: Record<string, unknown>) {
  return adminFetch<{ ok: true }>(`${knowledgePath(botId)}/faqs/${faqIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postAdminKnowledgeSnippet(botId: string, body: Record<string, unknown>) {
  return adminFetch<{ ok: true; index: number }>(`${knowledgePath(botId)}/snippets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchAdminKnowledgeSnippet(botId: string, snippetIndex: number, body: Record<string, unknown>) {
  return adminFetch<{ ok: true }>(`${knowledgePath(botId)}/snippets/${snippetIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchAdminKnowledgeItemUseInReplies(
  botId: string,
  itemId: string,
  body: { useInReplies: boolean },
) {
  return adminFetch<{ ok: boolean }>(
    `${knowledgePath(botId)}/items/${encodeURIComponent(itemId)}/use-in-replies`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function getAdminBotDocument(botId: string, documentId: string) {
  return adminFetch<{ document: AdminWorkspaceDocument }>(
    `${documentsPath(botId)}/${encodeURIComponent(documentId)}`,
  );
}

export function getAdminBotDocumentDownloadUrl(botId: string, documentId: string) {
  return adminFetch<AdminDocumentDownloadUrlResponse>(
    `${documentsPath(botId)}/${encodeURIComponent(documentId)}/download-url`,
  );
}

export function patchAdminBotDocument(
  botId: string,
  documentId: string,
  body: { active?: boolean; title?: string; text?: string },
) {
  return adminFetch<{ ok: boolean }>(`${documentsPath(botId)}/${encodeURIComponent(documentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteAdminBotDocument(botId: string, documentId: string) {
  return adminFetch<unknown>(`${documentsPath(botId)}/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
}

export function postAdminBotDocumentsBulkDelete(botId: string, docIds: string[]) {
  return adminFetch<{ ok: boolean; deleted: number }>(`${documentsPath(botId)}/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docIds }),
  });
}

/** Multipart upload: one or more `file` parts (same as customer documents POST). */
export function postAdminBotDocumentUpload(botId: string, formData: FormData) {
  return adminFetch<AdminDocumentUploadResponse>(`${documentsPath(botId)}`, {
    method: 'POST',
    body: formData,
  });
}

export function postAdminBotDocumentEmbed(botId: string, documentId: string) {
  return adminFetch<{ ok: true }>(
    `${documentsPath(botId)}/${encodeURIComponent(documentId)}/embed`,
    { method: 'POST' },
  );
}

export function getAdminBotDocuments(botId: string, params?: { page?: number; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.limit != null) q.set('limit', String(params.limit));
  const qs = q.toString();
  return adminFetch<AdminDocumentsResponse>(`${documentsPath(botId)}${qs ? `?${qs}` : ''}`);
}

export function getAdminBotKnowledgeOverview(botId: string) {
  return adminFetch<AdminKnowledgeOverviewResponse>(`${knowledgePath(botId)}/overview`);
}

/** TODO Phase 6+: admin CSV import mirrors — stubs keep list pages buildable. */
export function getAdminKnowledgeFaqImportCsvSample(
  _botId: string,
): Promise<
  ApiResult<{ content: string; fileName: string; csv?: string; filename?: string }>
> {
  return Promise.resolve({
    ok: false,
    status: 501,
    error: 'CSV import is not available in the admin app yet.',
    body: null,
  });
}

export function postAdminKnowledgeFaqImportCsv(
  _botId: string,
  _formData: FormData,
): Promise<ApiResult<{ imported: number; skippedDueToCapacity?: number }>> {
  return Promise.resolve({
    ok: false,
    status: 501,
    error: 'CSV import is not available in the admin app yet.',
    body: null,
  });
}

export function getAdminKnowledgeSnippetImportCsvSample(_botId: string) {
  return getAdminKnowledgeFaqImportCsvSample(_botId);
}

export function postAdminKnowledgeSnippetImportCsv(_botId: string, _formData: FormData) {
  return postAdminKnowledgeFaqImportCsv(_botId, _formData);
}
