import { adminFetch } from './client';
import type {
  AdminBotDetailResponse,
  AdminBotListItem,
  AdminCustomerBotsResponse,
  AdminCustomerDetailResponse,
  AdminCustomerWorkspacesResponse,
  AdminCustomersListParams,
  AdminCustomersListResponse,
  AdminWorkspaceBillingSummary,
  BillingAdminSyncResult,
  AdminLoginResponse,
  AdminLogoutResponse,
  AdminMe,
  AdminPlatformBotDetail,
  AdminPlatformBotListItem,
  ApiResult,
  PlatformBotType,
} from './types';

export {
  deleteAdminBotDocument,
  deleteAdminBotKnowledgeItem,
  getAdminBotAgentTrainingStatus,
  getAdminBotDocument,
  getAdminBotDocumentDownloadUrl,
  getAdminBotDocuments,
  getAdminBotKnowledgeOverview,
  getAdminKnowledgeFaqImportCsvSample,
  getAdminKnowledgeSnippetImportCsvSample,
  postAdminKnowledgeFaqImportCsv,
  postAdminKnowledgeSnippetImportCsv,
  getAdminBotKnowledgePendingTrainingItems,
  getAdminBotKnowledgeStatus,
  patchAdminBotDocument,
  patchAdminBotKnowledgeReplyPriority,
  patchAdminBotKnowledgeTrainingSettings,
  patchAdminKnowledgeFaq,
  patchAdminKnowledgeItemUseInReplies,
  patchAdminKnowledgeSnippet,
  postAdminBotDocumentEmbed,
  postAdminBotDocumentUpload,
  postAdminBotDocumentsBulkDelete,
  postAdminBotKnowledgeItemRetry,
  postAdminBotKnowledgeItemsBulkDelete,
  postAdminBotRetrainAgent,
  postAdminKnowledgeFaq,
  postAdminKnowledgeSnippet,
} from './adminKnowledgeApi';

const P = '/api/admin';

export function loginAdmin(email: string, password: string) {
  return adminFetch<AdminLoginResponse>(`${P}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export function logoutAdmin() {
  return adminFetch<AdminLogoutResponse>(
    `${P}/auth/logout`,
    { method: 'POST' },
    { skipSessionUnauthorizedHandling: true },
  );
}

export function getAdminMe() {
  return adminFetch<AdminMe>(`${P}/me`);
}

export function getAdminBots(params?: { status?: 'draft' | 'published' | 'all' }) {
  const q = params?.status && params.status !== 'all' ? `?status=${encodeURIComponent(params.status)}` : '';
  return adminFetch<AdminBotListItem[]>(`${P}/bots${q}`);
}

export function getAdminBot(botId: string) {
  return adminFetch<AdminBotDetailResponse>(`${P}/bots/${encodeURIComponent(botId)}`);
}

export function patchAdminBot(botId: string, payload: Record<string, unknown>) {
  return adminFetch<unknown>(`${P}/bots/${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getAdminCustomers(params?: AdminCustomersListParams) {
  const q = new URLSearchParams();
  if (params?.q?.trim()) q.set('q', params.q.trim());
  if (params?.page != null && params.page > 0) q.set('page', String(params.page));
  if (params?.limit != null && params.limit > 0) q.set('limit', String(params.limit));
  const qs = q.toString();
  return adminFetch<AdminCustomersListResponse>(`${P}/customers${qs ? `?${qs}` : ''}`);
}

export function getAdminCustomer(customerId: string) {
  return adminFetch<AdminCustomerDetailResponse>(
    `${P}/customers/${encodeURIComponent(customerId)}`,
  );
}

export function getAdminCustomerWorkspaces(customerId: string) {
  return adminFetch<AdminCustomerWorkspacesResponse>(
    `${P}/customers/${encodeURIComponent(customerId)}/workspaces`,
  );
}

export function getAdminWorkspaceBillingSummary(workspaceId: string) {
  return adminFetch<AdminWorkspaceBillingSummary>(
    `${P}/workspaces/${encodeURIComponent(workspaceId)}/billing/summary`,
  );
}

export function postAdminWorkspaceBillingSync(workspaceId: string) {
  return adminFetch<BillingAdminSyncResult>(
    `${P}/workspaces/${encodeURIComponent(workspaceId)}/billing/sync`,
    { method: 'POST' },
  );
}

export function postAdminReplayWebhookEvent(eventId: string) {
  return adminFetch<{ replayed: boolean; status: string; message: string }>(
    `${P}/billing/webhook-events/${encodeURIComponent(eventId)}/replay`,
    { method: 'POST' },
  );
}

export function getAdminCustomerBots(customerId: string) {
  return adminFetch<AdminCustomerBotsResponse>(
    `${P}/customers/${encodeURIComponent(customerId)}/bots`,
  );
}

export function getAdminPlatformBots(params?: {
  type?: PlatformBotType;
  status?: 'draft' | 'published' | 'all';
}) {
  const q = new URLSearchParams();
  if (params?.type) q.set('type', params.type);
  if (params?.status && params.status !== 'all') q.set('status', params.status);
  const qs = q.toString();
  return adminFetch<AdminPlatformBotListItem[]>(`${P}/platform-bots${qs ? `?${qs}` : ''}`);
}

export function createAdminPlatformBot(payload: {
  name: string;
  description?: string;
  platformBotType: PlatformBotType;
  visibility?: 'public' | 'private';
}) {
  return adminFetch<AdminPlatformBotDetail>(`${P}/platform-bots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getAdminPlatformBot(botId: string) {
  return adminFetch<AdminPlatformBotDetail>(`${P}/platform-bots/${encodeURIComponent(botId)}`);
}

export function patchAdminPlatformBot(botId: string, payload: Record<string, unknown>) {
  return adminFetch<AdminPlatformBotDetail>(`${P}/platform-bots/${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminPlatformBot(botId: string) {
  return adminFetch<{ ok: boolean; deleted: string }>(
    `${P}/platform-bots/${encodeURIComponent(botId)}`,
    { method: 'DELETE' },
  );
}

export function postAdminBotAvatar(botId: string, formData: FormData) {
  return adminFetch<{ ok: true; url: string }>(`${P}/bots/${encodeURIComponent(botId)}/avatar`, {
    method: 'POST',
    body: formData,
  });
}

export function postAdminBotRotateAccessKey(botId: string) {
  return adminFetch<{ ok: true; accessKey: string }>(
    `${P}/bots/${encodeURIComponent(botId)}/rotate-access-key`,
    { method: 'POST' },
  );
}

export function postAdminBotRotateSecretKey(botId: string) {
  return adminFetch<{ ok: true; secretKey: string }>(
    `${P}/bots/${encodeURIComponent(botId)}/rotate-secret-key`,
    { method: 'POST' },
  );
}

export function postAdminKnowledgeSuggestionsSync(botId: string, body: unknown) {
  return adminFetch<unknown>(`${P}/bots/${encodeURIComponent(botId)}/knowledge/suggestions/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export {
  getAdminBotConversationDetail,
  getAdminBotConversationMessages,
  getAdminBotConversations,
} from './adminConversationsApi';

export {
  getAdminAnalyticsBotDetail,
  getAdminAnalyticsBotsSummary,
  getAdminAnalyticsLeadsSummary,
  getAdminAnalyticsOverview,
} from './adminAnalyticsApi';

export { getAdminVisitorDetail, getAdminVisitors } from './adminVisitorsApi';

export {
  getBackendHealth,
  testAdminOpenAiKey,
  testAdminOpenAiPlatformKey,
} from './adminSettingsApi';

export type { ApiResult };
