import { customerFetch } from './client';
import type {
  ChatResponse,
  CreateDraftResponse,
  CustomerBotDetailResponse,
  CustomerBotInsightsResponse,
  CustomerBotLifecycleResponse,
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

/**
 * PATCH `/api/customer/bots/:id` with a **sparse** body: only send keys you want to change.
 * The backend applies partial updates and does not default or overwrite omitted fields.
 */
export function patchCustomerBot(id: string, body: Record<string, unknown>) {
  return customerFetch<unknown>(`${P}/bots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Dedicated publish/draft lifecycle (not sparse PATCH). */
export function postCustomerBotLifecycleAction(botId: string, action: 'publish' | 'draft') {
  return customerFetch<CustomerBotLifecycleResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/lifecycle-action`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    },
  );
}

/** Multipart: field `file` (PNG/JPEG/WebP, max 2MB). Returns public `url` for PATCH `imageUrl` + `avatarSource: 'upload'`. */
export function postCustomerBotAvatar(botId: string, formData: FormData) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  const path = `${P}/bots/${encodeURIComponent(botId)}/avatar`;
  return customerFetch<{ ok: true; url: string }>(path, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer);
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

/** Re-queue ingestion for a document (same as admin “retry processing”). */
export function postCustomerBotDocumentRequeue(botId: string, documentId: string) {
  return customerFetch<{ ok: boolean }>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}/embed`,
    { method: 'POST' },
  );
}

export function postCustomerBotDocumentsBulkDelete(botId: string, docIds: string[]) {
  return customerFetch<{ ok: boolean; deleted: number }>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/bulk-delete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docIds }),
    },
  );
}

/**
 * Multipart upload: one or more parts named `file` (max 5 per request), optional `title` (only when a single file).
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
