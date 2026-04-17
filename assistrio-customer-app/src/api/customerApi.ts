import { customerFetch } from './client';
import type {
  ChatResponse,
  CreateDraftResponse,
  CustomerBotDetailResponse,
  CustomerBotInsightsResponse,
  CustomerBotListItem,
  CustomerDocumentDownloadUrlResponse,
  CustomerDocumentUploadResponse,
  CustomerDocumentsResponse,
  CustomerMe,
} from './types';

const P = '/api/customer';

export function getCustomerMe() {
  return customerFetch<CustomerMe>(`${P}/me`);
}

export function postCustomerLogout() {
  return customerFetch<{ success: boolean }>(
    `${P}/auth/logout`,
    { method: 'POST' },
    { skipSessionUnauthorizedHandling: true },
  );
}

export function getCustomerBots(params?: { status?: 'draft' | 'published' | 'all' }) {
  const q = params?.status && params.status !== 'all' ? `?status=${encodeURIComponent(params.status)}` : '';
  return customerFetch<CustomerBotListItem[]>(`${P}/bots${q}`);
}

export function getCustomerBot(id: string) {
  return customerFetch<CustomerBotDetailResponse>(`${P}/bots/${encodeURIComponent(id)}`);
}

export function getCustomerBotInsights(id: string) {
  return customerFetch<CustomerBotInsightsResponse>(
    `${P}/bots/${encodeURIComponent(id)}/insights`,
  );
}

export function postCustomerBotDraft(body: { clientDraftId: string }) {
  return customerFetch<CreateDraftResponse>(`${P}/bots/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postCustomerBotDraftFinalize(body: { clientDraftId: string; payload: Record<string, unknown> }) {
  return customerFetch<CreateDraftResponse>(`${P}/bots/draft/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerBot(id: string, body: Record<string, unknown>) {
  return customerFetch<unknown>(`${P}/bots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postCustomerBotChat(botId: string, body: { message: string }, debug?: boolean) {
  const q = debug ? '?debug=true' : '';
  return customerFetch<ChatResponse>(`${P}/bots/${encodeURIComponent(botId)}/chat${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getCustomerBotDocuments(botId: string, params?: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const q = sp.toString() ? `?${sp}` : '';
  return customerFetch<CustomerDocumentsResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/documents${q}`,
  );
}

/** Short-lived signed URL (or HTTPS file URL) for a ready, active uploaded document. */
export function getCustomerBotDocumentDownloadUrl(botId: string, documentId: string) {
  return customerFetch<CustomerDocumentDownloadUrlResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
}

export function patchCustomerBotDocument(botId: string, documentId: string, body: { active?: boolean }) {
  return customerFetch<{ ok: boolean }>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function deleteCustomerBotDocument(botId: string, documentId: string) {
  return customerFetch<unknown>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

/**
 * Multipart upload: field `file` (required), optional `title`.
 * Do not set Content-Type; the browser sets the boundary.
 */
export function postCustomerBotDocumentUpload(botId: string, formData: FormData) {
  return customerFetch<CustomerDocumentUploadResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/documents`,
    { method: 'POST', body: formData },
  );
}

export function patchCustomerBotAccessSettings(
  id: string,
  body: {
    visibility: 'public' | 'private';
    messageLimitMode: 'none' | 'fixed_total';
    messageLimitTotal?: number | null;
    messageLimitUpgradeMessage?: string | null;
    visitorMultiChatEnabled?: boolean;
    visitorMultiChatMax?: number | null;
  },
) {
  return customerFetch<unknown>(`${P}/bots/${encodeURIComponent(id)}/access-settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function postCustomerBotRotateAccessKey(id: string) {
  return customerFetch<{ ok: true; botId: string; accessKey: string }>(
    `${P}/bots/${encodeURIComponent(id)}/rotate-access-key`,
    { method: 'POST' },
  );
}

export function postCustomerBotRotateSecretKey(id: string) {
  return customerFetch<{ ok: true; botId: string; secretKey: string }>(
    `${P}/bots/${encodeURIComponent(id)}/rotate-secret-key`,
    { method: 'POST' },
  );
}

export function deleteCustomerBot(id: string) {
  return customerFetch<{ ok: true; deleted: string }>(
    `${P}/bots/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
