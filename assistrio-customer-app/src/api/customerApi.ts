import { customerFetch, getCustomerApiOrigin } from './client';
import type {
  ChatResponse,
  CreateDraftResponse,
  CustomerBotDetailResponse,
  CustomerBotInsightsResponse,
  CustomerBotChatsAnalyticsParams,
  CustomerChatsAnalyticsResponse,
  CustomerBotLifecycleResponse,
  CustomerBotConversationsListParams,
  CustomerBotConversationsListResponse,
  CustomerBotLeadsListParams,
  CustomerTopicAnalyticsParams,
  CustomerTopicsAnalyticsResponse,
  CustomerSentimentAnalyticsParams,
  CustomerSentimentAnalyticsResponse,
  CustomerAgentResourcesAnalyticsResponse,
  CustomerBotAgentResourcesAnalyticsParams,
  CustomerKnowledgeItemPrimarySourceAnalyticsParams,
  CustomerKnowledgeItemPrimarySourceAnalyticsResponse,
  CustomerLeadsAnalyticsResponse,
  CustomerBotLeadsAnalyticsParams,
  CustomerBotListItem,
  CustomerConversationDetail,
  CustomerConversationMessage,
  CustomerLeadDetail,
  CustomerLeadsListResponse,
  CustomerDatasheetImportCancelResponse,
  CustomerDatasheetImportConfirmResponseBase,
  CustomerDatasheetImportResponse,
  CustomerDatasheetPreviewResponse,
  CustomerDocumentDownloadUrlResponse,
  CustomerDocumentUploadResponse,
  CustomerDocumentsResponse,
  CustomerAgentTrainingStatusResponse,
  CustomerPendingTrainingItemsResponse,
  CustomerKnowledgeOverviewResponse,
  CustomerKnowledgeStatusResponse,
  CustomerKnowledgeCsvImportResponse,
  CustomerKnowledgeCsvSampleResponse,
  CustomerKnowledgeItemManualRetryResponse,
  CustomerMe,
  CustomerWorkspaceDocument,
  CustomerShareLinkResponse,
  CustomerShareLinkStatus,
  WorkspaceOnboardingGoLiveResponse,
  WorkspaceOnboardingResponse,
  SharedBotInitPayload,
  WidgetIframeInitPayload,
  ApiResult,
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

/** GET /api/customer/bots/:id/analytics/chats */
export function getCustomerBotChatsAnalytics(
  id: string,
  params?: CustomerBotChatsAnalyticsParams,
) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.granularity) q.set('granularity', params.granularity);
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.startedFrom) q.set('startedFrom', params.startedFrom);
  if (params?.countryCode?.trim()) q.set('countryCode', params.countryCode.trim());
  if (params?.deviceType?.trim()) q.set('deviceType', params.deviceType.trim());
  const qs = q.toString();
  return customerFetch<CustomerChatsAnalyticsResponse>(
    `${P}/bots/${encodeURIComponent(id)}/analytics/chats${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/analytics/topics */
export function getCustomerBotTopicsAnalytics(
  id: string,
  params?: CustomerTopicAnalyticsParams,
) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.granularity) q.set('granularity', params.granularity);
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.startedFrom) q.set('startedFrom', params.startedFrom);
  if (params?.topic) q.set('topic', params.topic);
  if (params?.messageTopicScope === 'primary') q.set('messageTopicScope', 'primary');
  const qs = q.toString();
  return customerFetch<CustomerTopicsAnalyticsResponse>(
    `${P}/bots/${encodeURIComponent(id)}/analytics/topics${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/analytics/sentiment */
export function getCustomerBotSentimentAnalytics(
  id: string,
  params?: CustomerSentimentAnalyticsParams,
) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.granularity) q.set('granularity', params.granularity);
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.startedFrom) q.set('startedFrom', params.startedFrom);
  if (params?.sentiment) q.set('sentiment', params.sentiment);
  const qs = q.toString();
  return customerFetch<CustomerSentimentAnalyticsResponse>(
    `${P}/bots/${encodeURIComponent(id)}/analytics/sentiment${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/analytics/agent-resources */
export function getCustomerBotAgentResourcesAnalytics(
  id: string,
  params?: CustomerBotAgentResourcesAnalyticsParams,
) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.granularity) q.set('granularity', params.granularity);
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.startedFrom) q.set('startedFrom', params.startedFrom);
  const qs = q.toString();
  return customerFetch<CustomerAgentResourcesAnalyticsResponse>(
    `${P}/bots/${encodeURIComponent(id)}/analytics/agent-resources${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:botId/knowledge/items/:itemId/primary-source-analytics */
export function getCustomerBotKnowledgeItemPrimarySourceAnalytics(
  botId: string,
  itemId: string,
  params?: CustomerKnowledgeItemPrimarySourceAnalyticsParams,
) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.granularity) q.set('granularity', params.granularity);
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.startedFrom) q.set('startedFrom', params.startedFrom);
  const qs = q.toString();
  return customerFetch<CustomerKnowledgeItemPrimarySourceAnalyticsResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/items/${encodeURIComponent(itemId)}/primary-source-analytics${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/analytics/leads */
export function getCustomerBotLeadsAnalytics(id: string, params?: CustomerBotLeadsAnalyticsParams) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.granularity) q.set('granularity', params.granularity);
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.startedFrom) q.set('startedFrom', params.startedFrom);
  if (params?.countryCode?.trim()) q.set('countryCode', params.countryCode.trim());
  const qs = q.toString();
  return customerFetch<CustomerLeadsAnalyticsResponse>(
    `${P}/bots/${encodeURIComponent(id)}/analytics/leads${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/conversations */
export function getCustomerBotConversations(id: string, params?: CustomerBotConversationsListParams) {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.before) q.set('before', params.before);
  if (params?.dateFrom?.trim()) q.set('dateFrom', params.dateFrom.trim());
  if (params?.dateTo?.trim()) q.set('dateTo', params.dateTo.trim());
  if (params?.startedFrom?.trim()) q.set('startedFrom', params.startedFrom.trim());
  if (params?.hasLead === true) q.set('hasLead', 'true');
  if (params?.hasLead === false) q.set('hasLead', 'false');
  if (params?.hasVoice === true) q.set('hasVoice', 'true');
  if (params?.hasVoice === false) q.set('hasVoice', 'false');
  if (params?.hasDictation === true) q.set('hasDictation', 'true');
  if (params?.hasDictation === false) q.set('hasDictation', 'false');
  if (params?.hasAttachment === true) q.set('hasAttachment', 'true');
  if (params?.hasAttachment === false) q.set('hasAttachment', 'false');
  if (params?.minCredits != null && Number.isFinite(params.minCredits)) q.set('minCredits', String(params.minCredits));
  if (params?.maxCredits != null && Number.isFinite(params.maxCredits)) q.set('maxCredits', String(params.maxCredits));
  if (params?.creditsGtZero === true) q.set('creditsGtZero', 'true');
  if (params?.creditsZero === true) q.set('creditsZero', 'true');
  if (params?.minMessages != null && Number.isFinite(params.minMessages) && params.minMessages > 0) {
    q.set('minMessages', String(Math.floor(params.minMessages)));
  }
  if (params?.deviceType?.trim()) q.set('deviceType', params.deviceType.trim());
  if (params?.countryCode?.trim()) q.set('countryCode', params.countryCode.trim());
  if (params?.primaryTopics?.trim()) q.set('primaryTopics', params.primaryTopics.trim());
  if (params?.secondaryTopics?.trim()) q.set('secondaryTopics', params.secondaryTopics.trim());
  if (params?.sentiments?.trim()) q.set('sentiments', params.sentiments.trim());
  const qs = q.toString();
  return customerFetch<CustomerBotConversationsListResponse>(
    `${P}/bots/${encodeURIComponent(id)}/conversations${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/leads */
export function getCustomerBotLeads(botId: string, params?: CustomerBotLeadsListParams) {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.before) q.set('before', params.before);
  if (params?.dateFrom?.trim()) q.set('dateFrom', params.dateFrom.trim());
  if (params?.dateTo?.trim()) q.set('dateTo', params.dateTo.trim());
  if (params?.startedFrom?.trim()) q.set('startedFrom', params.startedFrom.trim());
  if (params?.countryCode?.trim()) q.set('countryCode', params.countryCode.trim().toUpperCase());
  if (params?.fieldKey?.trim()) q.set('fieldKey', params.fieldKey.trim());
  if (params?.search?.trim()) q.set('search', params.search.trim());
  if (params?.includePreview === false) q.set('includePreview', 'false');
  if (params?.leadCompletion === 'complete' || params?.leadCompletion === 'partial') {
    q.set('leadCompletion', params.leadCompletion);
  }
  const qs = q.toString();
  return customerFetch<CustomerLeadsListResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/leads${qs ? `?${qs}` : ''}`,
  );
}

/** GET /api/customer/bots/:id/leads/:conversationId */
export function getCustomerBotLeadDetail(botId: string, conversationId: string) {
  return customerFetch<CustomerLeadDetail>(
    `${P}/bots/${encodeURIComponent(botId)}/leads/${encodeURIComponent(conversationId)}`,
  );
}

/** GET /api/customer/bots/:id/conversations/:conversationId */
export function getCustomerBotConversationDetail(botId: string, conversationId: string) {
  return customerFetch<CustomerConversationDetail>(
    `${P}/bots/${encodeURIComponent(botId)}/conversations/${encodeURIComponent(conversationId)}`,
  );
}

/** GET /api/customer/bots/:id/conversations/:conversationId/messages */
export function getCustomerBotConversationMessages(botId: string, conversationId: string) {
  return customerFetch<{ ok: true; messages: CustomerConversationMessage[] }>(
    `${P}/bots/${encodeURIComponent(botId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
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
 * PATCH `/api/customer/bots/:id` — agent settings **only** (name, persona, origins, widget UI, …). FAQ/snippets/datasheets/suggestions use `/bots/:id/knowledge/*` POST/PATCH/DELETE (suggestions: `POST …/suggestions`, `POST …/suggestions/sync`, label/scope PATCH).
 * The backend applies partial updates and does not default or overwrite omitted fields.
 */
export function patchCustomerBot(id: string, body: Record<string, unknown>) {
  return customerFetch<unknown>(`${P}/bots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type RefineResponseStyleResult = {
  mode: 'structured';
  description: string;
  instructions: string;
  preview: { title: string; example: string };
};

/** POST refine response style (does not persist; caller saves via PATCH). */
export function refineCustomerBotResponseStyle(botId: string, description: string) {
  return customerFetch<RefineResponseStyleResult>(
    `${P}/bots/${encodeURIComponent(botId)}/ai/response-style/refine`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    },
  );
}

function customerKnowledgePath(botId: string) {
  return `${P}/bots/${encodeURIComponent(botId)}/knowledge`;
}

/** Append one FAQ row (`POST …/knowledge/faqs`). Same shape as a legacy PUT array element. */
export function postCustomerKnowledgeFaq(botId: string, body: Record<string, unknown>) {
  return customerFetch<{ ok: true; index: number }>(`${customerKnowledgePath(botId)}/faqs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Single FAQ row merge (`PATCH …/knowledge/faqs/:index`). */
export function patchCustomerKnowledgeFaq(botId: string, faqIndex: number, body: Record<string, unknown>) {
  return customerFetch<{ ok: true }>(`${customerKnowledgePath(botId)}/faqs/${faqIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Multipart CSV import for Q&A rows (all-or-nothing). */
export function postCustomerKnowledgeFaqImportCsv(botId: string, formData: FormData) {
  return customerFetch<CustomerKnowledgeCsvImportResponse>(`${customerKnowledgePath(botId)}/faqs/import-csv`, {
    method: 'POST',
    body: formData,
  });
}

/** Download sample CSV for Q&A import. */
export function getCustomerKnowledgeFaqImportCsvSample(botId: string) {
  return customerFetch<CustomerKnowledgeCsvSampleResponse>(`${customerKnowledgePath(botId)}/faqs/import-csv-sample`);
}

/** Append one snippet (`POST …/knowledge/snippets`). */
export function postCustomerKnowledgeSnippet(botId: string, body: Record<string, unknown>) {
  return customerFetch<{ ok: true; index: number }>(`${customerKnowledgePath(botId)}/snippets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerKnowledgeSnippet(botId: string, snippetIndex: number, body: Record<string, unknown>) {
  return customerFetch<{ ok: true }>(`${customerKnowledgePath(botId)}/snippets/${snippetIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Multipart CSV import for snippets (all-or-nothing). */
export function postCustomerKnowledgeSnippetImportCsv(botId: string, formData: FormData) {
  return customerFetch<CustomerKnowledgeCsvImportResponse>(`${customerKnowledgePath(botId)}/snippets/import-csv`, {
    method: 'POST',
    body: formData,
  });
}

/** Download sample CSV for snippet import. */
export function getCustomerKnowledgeSnippetImportCsvSample(botId: string) {
  return customerFetch<CustomerKnowledgeCsvSampleResponse>(
    `${customerKnowledgePath(botId)}/snippets/import-csv-sample`,
  );
}

/** Append one datasheet (`POST …/knowledge/datasheets`). */
export function postCustomerKnowledgeDatasheet(botId: string, body: Record<string, unknown>) {
  return customerFetch<{ ok: true; index: number }>(`${customerKnowledgePath(botId)}/datasheets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerKnowledgeDatasheet(botId: string, tableIndex: number, body: Record<string, unknown>) {
  return customerFetch<{ ok: true }>(`${customerKnowledgePath(botId)}/datasheets/${tableIndex}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Legacy plain-text notes (`PATCH …/knowledge/description`). */
export function patchCustomerKnowledgeDescription(botId: string, body: Record<string, unknown>) {
  return customerFetch<{ ok: true }>(`${customerKnowledgePath(botId)}/description`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Append one suggestion chip (`POST …/knowledge/suggestions`). Body: `{ label, context? }`. */
export function postCustomerKnowledgeSuggestion(botId: string, body: Record<string, unknown>) {
  return customerFetch<{ ok: true; index: number }>(`${customerKnowledgePath(botId)}/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Replace full suggestion chip list (`POST …/knowledge/suggestions/sync`). Body: JSON array (same shapes as legacy). */
export function postCustomerKnowledgeSuggestionsSync(botId: string, payload: unknown[]) {
  return customerFetch<{ ok: true }>(`${customerKnowledgePath(botId)}/suggestions/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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

/** Multipart: field `file` (max 20MB). Uploads to S3, returns preview rows + importSessionId for import-confirm. */
export function postCustomerBotDatasheetPreview(botId: string, formData: FormData) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  const path = `${P}/bots/${encodeURIComponent(botId)}/datasheets/preview`;
  return customerFetch<CustomerDatasheetPreviewResponse>(path, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer);
  });
}

/** JSON: abandon preview session — deletes temp upload and marks session cancelled server-side. */
export function postCustomerBotDatasheetImportCancel(
  botId: string,
  body: { importSessionId: string },
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60_000);
  const path = `${P}/bots/${encodeURIComponent(botId)}/datasheets/import-cancel`;
  return customerFetch<CustomerDatasheetImportCancelResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer);
  });
}

/** JSON: import session from preview; queues background full parse + KB row. */
export function postCustomerBotDatasheetImportConfirm(
  botId: string,
  body: { importSessionId: string; title?: string; dropColumnIndices?: number[] },
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  const path = `${P}/bots/${encodeURIComponent(botId)}/datasheets/import-confirm`;
  return customerFetch<CustomerDatasheetImportConfirmResponseBase>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer);
  });
}

/** @deprecated Use preview + {@link postCustomerBotDatasheetImportConfirm}. */
export function postCustomerBotDatasheetImport(botId: string, formData: FormData) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  const path = `${P}/bots/${encodeURIComponent(botId)}/datasheets/import`;
  return customerFetch<CustomerDatasheetImportResponse>(path, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer);
  });
}

export function postCustomerBotChat(
  botId: string,
  body: {
    message: string;
    suggestionId?: string;
    conversationOrigin?: {
      source?: string;
      mode?: string;
      embedType?: string;
      pageUrl?: string;
      websiteOrigin?: string;
      referrer?: string;
      surface?: string;
    };
    previewContext?: { sourcePage?: string };
  },
  debug?: boolean,
) {
  const q = debug ? '?debug=true' : '';
  return customerFetch<ChatResponse>(`${P}/bots/${encodeURIComponent(botId)}/chat${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getCustomerBotKnowledgeOverview(botId: string) {
  return customerFetch<CustomerKnowledgeOverviewResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/overview`,
  );
}

export function getCustomerBotAgentTrainingStatus(botId: string) {
  return customerFetch<CustomerAgentTrainingStatusResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/training/status`,
  );
}

export function getCustomerBotKnowledgePendingTrainingItems(botId: string) {
  return customerFetch<CustomerPendingTrainingItemsResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/training/pending-items`,
  );
}

/** Retrain agent. On `!ok`, use {@link toastIfTrainQueueRateLimited} before a generic error toast. */
export function postCustomerBotRetrainAgent(
  botId: string,
  body?: { includeFailed?: boolean; forceRetrain?: boolean },
) {
  return customerFetch<CustomerAgentTrainingStatusResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/training/retrain-agent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? { includeFailed: true }),
    },
  );
}

export function patchCustomerBotKnowledgeTrainingSettings(
  botId: string,
  body: { autoTrainEnabled?: boolean; trainingDelayMinutes?: number },
) {
  return customerFetch<CustomerKnowledgeOverviewResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/training-settings`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function patchCustomerBotKnowledgeReplyPriority(
  botId: string,
  body: {
    knowledgeReplyPriority: {
      mode: 'default' | 'priority';
      sourceOrder: Array<'faq' | 'note' | 'table' | 'document' | 'suggestion'>;
    };
  },
) {
  return patchCustomerBot(botId, body);
}

/** Single KB item pipeline retry (extraction, table import, or training) — idempotent on the server. */
export function postCustomerBotKnowledgeItemRetry(botId: string, itemId: string) {
  return customerFetch<CustomerKnowledgeItemManualRetryResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/items/${encodeURIComponent(itemId)}/retry`,
    { method: 'POST' },
  );
}

/** Delete many KB rows in one request (same per-row rules as single delete — training/import gates, etc.). Max 100 ids. */
export function postCustomerBotKnowledgeItemsBulkDelete(botId: string, itemIds: string[]) {
  return customerFetch<{ ok: true; deleted: number }>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/items/bulk-delete`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds }),
    },
  );
}

/**
 * Dedicated KB row delete — soft-delete + chunk cleanup + OOS reconcile (see backend).
 * File-backed documents normally use {@link deleteCustomerBotDocument}.
 */
export function deleteCustomerBotKnowledgeItem(botId: string, itemId: string) {
  return postCustomerBotKnowledgeItemsBulkDelete(botId, [itemId]);
}

/** Omit `type` (or pass `all`) to fetch every section in one response — same round trip the workspace poller uses. */
export function getCustomerBotKnowledgeStatus(
  botId: string,
  params?: {
    type?: 'faq' | 'note' | 'table' | 'document' | 'suggestion' | 'all';
    /** KnowledgeBaseItem `_id`; requires `type` other than `all`. */
    itemId?: string;
  },
) {
  const sp = new URLSearchParams();
  if (params?.type && params.type !== 'all') sp.set('type', params.type);
  if (params?.itemId?.trim()) sp.set('itemId', params.itemId.trim());
  const q = sp.toString() ? `?${sp}` : '';
  return customerFetch<CustomerKnowledgeStatusResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/status${q}`,
  );
}

export function patchCustomerBotSuggestionLabel(botId: string, suggestionIndex: number, body: { label: string }) {
  return customerFetch<{ ok: true }>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/suggestions/${encodeURIComponent(String(suggestionIndex))}/label`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function patchCustomerBotSuggestionScope(botId: string, suggestionIndex: number, body: { context: string }) {
  return customerFetch<{ ok: true }>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/suggestions/${encodeURIComponent(String(suggestionIndex))}/scope`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function patchCustomerBotSuggestionHideChipText(
  botId: string,
  suggestionIndex: number,
  body: { hideChipTextInChat: boolean },
) {
  return customerFetch<{ ok: true }>(
    `${P}/bots/${encodeURIComponent(botId)}/knowledge/suggestions/${encodeURIComponent(String(suggestionIndex))}/hide-chip-text`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
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

/** Single document (includes `text` when available). */
export function getCustomerBotDocument(botId: string, documentId: string) {
  return customerFetch<{ document: CustomerWorkspaceDocument }>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}`,
  );
}

/** Short-lived signed URL (or HTTPS file URL) for a ready, active uploaded document. */
export function getCustomerBotDocumentDownloadUrl(botId: string, documentId: string) {
  return customerFetch<CustomerDocumentDownloadUrlResponse>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  );
}

export function patchCustomerBotDocument(
  botId: string,
  documentId: string,
  body: { active?: boolean; title?: string; text?: string },
) {
  return customerFetch<{ ok: boolean }>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Customer-facing per-KB item toggle: updates whether this KB row is eligible for
 * runtime/RAG replies. Canonical backend field is `active`.
 */
export function patchCustomerKnowledgeItemUseInReplies(
  botId: string,
  itemId: string,
  body: { useInReplies: boolean },
) {
  return customerFetch<{ ok: boolean }>(
    `${customerKnowledgePath(botId)}/items/${encodeURIComponent(itemId)}/use-in-replies`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

/** DELETE document route — server soft-deletes the KB row; hard purge runs on a worker schedule. */
export function deleteCustomerBotDocument(botId: string, documentId: string) {
  return customerFetch<unknown>(
    `${P}/bots/${encodeURIComponent(botId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  );
}

/** Bulk soft-remove documents (same semantics as {@link deleteCustomerBotDocument}). */
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
 * Multipart upload: one or more parts named `file` (per-request cap matches per-bot document max), optional `title` (only when a single file).
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

async function runtimeBackendJson<T>(
  path: string,
  init: RequestInit,
  defaultCredentials: RequestCredentials,
): Promise<ApiResult<T>> {
  const base = getCustomerApiOrigin().replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      credentials: init.credentials ?? defaultCredentials,
      headers: {
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    return { ok: false, status: 0, error: msg, body: null };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    return { ok: true, data: body as T, status: res.status };
  }
  const err =
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
      ? (body as { error: string }).error.trim()
      : res.statusText || `Request failed (${res.status})`;
  return { ok: false, status: res.status, error: err || 'Request failed', body };
}

/** GET `/api/shared/bots/:slug/init` — Assistrio-hosted share preview; optional `shareToken` for draft links. */
export function getSharedBotInit(slug: string, chatVisitorId?: string, shareToken?: string) {
  const q = new URLSearchParams();
  if (chatVisitorId?.trim()) q.set('chatVisitorId', chatVisitorId.trim());
  if (shareToken?.trim()) q.set('shareToken', shareToken.trim());
  const qs = q.toString();
  return runtimeBackendJson<SharedBotInitPayload>(
    `/api/shared/bots/${encodeURIComponent(slug)}/init${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
    'omit',
  );
}

/** POST `/api/widget/iframe/init` — sets embed session cookie on the API origin. */
export function postWidgetIframeInit(body: {
  botId: string;
  accessKey: string;
  secretKey?: string;
  parentOrigin: string;
  pageUrl?: string;
  referrer?: string;
  chatVisitorId?: string;
}) {
  return runtimeBackendJson<WidgetIframeInitPayload>(
    '/api/widget/iframe/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'include',
  );
}

const SHARE_LINK_STATUSES = new Set<CustomerShareLinkStatus>([
  'not_created',
  'active',
  'disabled',
  'expired',
  'revoked',
  'missing',
]);

/**
 * Normalizes share-link JSON so callers always receive a flat
 * {@link CustomerShareLinkResponse} (handles optional `{ data: { ... } }` wrappers).
 */
export function parseCustomerShareLinkResponse(body: unknown): CustomerShareLinkResponse | null {
  const candidates: unknown[] = [];
  const push = (x: unknown) => {
    if (x != null) candidates.push(x);
  };
  push(body);
  if (body && typeof body === 'object' && 'data' in body) {
    push((body as { data: unknown }).data);
  }

  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (typeof o.enabled !== 'boolean' || typeof o.slug !== 'string') continue;

    const slug = o.slug.trim().toLowerCase();
    let expiresAt: string | null = null;
    if (typeof o.expiresAt === 'string' && o.expiresAt.trim()) {
      expiresAt = o.expiresAt.trim();
    } else if (o.expiresAt === null) {
      expiresAt = null;
    }

    let previewToken: string | null | undefined;
    if (typeof o.previewToken === 'string' && o.previewToken.trim()) previewToken = o.previewToken.trim();
    else if (o.previewToken === null) previewToken = null;

    let tokenRevokedAt: string | null | undefined;
    if (typeof o.tokenRevokedAt === 'string' && o.tokenRevokedAt.trim()) tokenRevokedAt = o.tokenRevokedAt.trim();
    else if (o.tokenRevokedAt === null) tokenRevokedAt = null;

    const expiresInHours =
      typeof o.expiresInHours === 'number' && Number.isFinite(o.expiresInHours) ? o.expiresInHours : undefined;

    const statusRaw = o.status;
    const status =
      typeof statusRaw === 'string' && SHARE_LINK_STATUSES.has(statusRaw as CustomerShareLinkStatus)
        ? (statusRaw as CustomerShareLinkStatus)
        : undefined;

    const secureSharePreviewConfigured =
      typeof o.secureSharePreviewConfigured === 'boolean' ? o.secureSharePreviewConfigured : undefined;

    return {
      enabled: o.enabled === true,
      slug,
      ...(typeof o.shareUrl === 'string' && o.shareUrl.trim() ? { shareUrl: o.shareUrl.trim() } : {}),
      expiresAt,
      ...(tokenRevokedAt !== undefined ? { tokenRevokedAt } : {}),
      ...(typeof o.allowDraft === 'boolean' ? { allowDraft: o.allowDraft } : {}),
      ...(typeof o.requiresPreviewToken === 'boolean' ? { requiresPreviewToken: o.requiresPreviewToken } : {}),
      ...(expiresInHours != null ? { expiresInHours } : {}),
      ...(previewToken !== undefined ? { previewToken } : {}),
      ...(secureSharePreviewConfigured !== undefined ? { secureSharePreviewConfigured } : {}),
      ...(status ? { status } : {}),
    };
  }
  return null;
}

async function customerFetchShareLink(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<CustomerShareLinkResponse>> {
  const res = await customerFetch<unknown>(path, init);
  if (!res.ok) return res;
  const parsed = parseCustomerShareLinkResponse(res.data);
  if (!parsed) {
    return {
      ok: false,
      status: res.status,
      error: 'Invalid share link response',
      body: res.data,
    };
  }
  return { ok: true, data: parsed, status: res.status };
}

export function getCustomerBotShareLink(botId: string) {
  return customerFetchShareLink(`${P}/bots/${encodeURIComponent(botId)}/share-link`, { method: 'GET' });
}

export function postCustomerBotShareLink(botId: string, body: { expiresInHours: number }) {
  return customerFetchShareLink(`${P}/bots/${encodeURIComponent(botId)}/share-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerBotShareLink(botId: string, body: Record<string, unknown>) {
  return customerFetchShareLink(`${P}/bots/${encodeURIComponent(botId)}/share-link`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteCustomerBotShareLink(botId: string) {
  return customerFetchShareLink(`${P}/bots/${encodeURIComponent(botId)}/share-link`, { method: 'DELETE' });
}

/** Create or refresh share preview settings (POST). */
export const enableSharePreview = postCustomerBotShareLink;

/** Turn off share preview (DELETE). Keeps token and expiry server-side; link is unusable until enabled again. */
export const disableSharePreview = deleteCustomerBotShareLink;

/** Turn share preview on/off without rotating the token (PATCH). Enable fails if expired or token missing. */
export function patchSharePreviewEnabled(botId: string, enabled: boolean) {
  return patchCustomerBotShareLink(botId, { enabled });
}

/** New slug + token — previous preview URLs stop working. */
export function rotateSharePreview(botId: string, expiresInHours: number) {
  return patchCustomerBotShareLink(botId, { rotateSlug: true, expiresInHours });
}

/** New preview token + expiry. Returns `previewToken` once. */
export function regenerateSharePreviewToken(botId: string, expiresInHours: number) {
  return patchCustomerBotShareLink(botId, { regenerateSharePreviewToken: true, expiresInHours });
}

/** Permanently invalidate the current preview link and clear stored token material. */
export function revokeSharePreview(botId: string) {
  return patchCustomerBotShareLink(botId, { revoke: true });
}

function workspaceOnboardingPath(workspaceId: string) {
  return `${P}/workspaces/${encodeURIComponent(workspaceId)}/onboarding`;
}

/** GET workspace onboarding draft (creates draft server-side when missing). */
export function getCustomerWorkspaceOnboarding(workspaceId: string) {
  return customerFetch<WorkspaceOnboardingResponse>(workspaceOnboardingPath(workspaceId));
}

export function patchCustomerWorkspaceOnboardingProfile(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  return customerFetch<WorkspaceOnboardingResponse>(`${workspaceOnboardingPath(workspaceId)}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerWorkspaceOnboardingInstructions(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  return customerFetch<WorkspaceOnboardingResponse>(
    `${workspaceOnboardingPath(workspaceId)}/instructions`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export function patchCustomerWorkspaceOnboardingKnowledge(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  return customerFetch<WorkspaceOnboardingResponse>(`${workspaceOnboardingPath(workspaceId)}/knowledge`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerWorkspaceOnboardingGoLive(
  workspaceId: string,
  body: Record<string, unknown>,
) {
  return customerFetch<WorkspaceOnboardingResponse>(`${workspaceOnboardingPath(workspaceId)}/go-live`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchCustomerWorkspaceOnboardingProgress(
  workspaceId: string,
  body: { currentStep?: string; completedStep?: string },
) {
  return customerFetch<WorkspaceOnboardingResponse>(`${workspaceOnboardingPath(workspaceId)}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Create/publish bot from workspace onboarding draft. */
export function postCustomerWorkspaceOnboardingGoLive(
  workspaceId: string,
  body?: { origin?: string; label?: string; idempotencyKey?: string },
) {
  return customerFetch<WorkspaceOnboardingGoLiveResponse>(
    `${workspaceOnboardingPath(workspaceId)}/go-live`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    },
  );
}

/** Mark workspace onboarding completed after install step. */
export function postCustomerWorkspaceOnboardingComplete(workspaceId: string) {
  return customerFetch<WorkspaceOnboardingResponse>(`${workspaceOnboardingPath(workspaceId)}/complete`, {
    method: 'POST',
  });
}

/** Multipart avatar upload for workspace onboarding draft (PNG/JPEG/WebP, max 2MB). */
export function postCustomerWorkspaceOnboardingAvatar(workspaceId: string, formData: FormData) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  return customerFetch<WorkspaceOnboardingResponse>(`${workspaceOnboardingPath(workspaceId)}/avatar`, {
    method: 'POST',
    body: formData,
    signal: controller.signal,
  }).finally(() => {
    window.clearTimeout(timer);
  });
}

function onboardingKnowledgeUpload(
  workspaceId: string,
  kind: 'documents' | 'datasheets',
  formData: FormData,
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  return customerFetch<WorkspaceOnboardingResponse>(
    `${workspaceOnboardingPath(workspaceId)}/knowledge/${kind}`,
    {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    },
  ).finally(() => {
    window.clearTimeout(timer);
  });
}

/** Stage document uploads against workspace onboarding draft (no bot). */
export function postCustomerWorkspaceOnboardingDocuments(workspaceId: string, files: File[]) {
  const fd = new FormData();
  for (const file of files) fd.append('file', file);
  return onboardingKnowledgeUpload(workspaceId, 'documents', fd);
}

/** Stage a single datasheet against workspace onboarding draft (no bot). */
export function postCustomerWorkspaceOnboardingDatasheet(workspaceId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return onboardingKnowledgeUpload(workspaceId, 'datasheets', fd);
}

export function deleteCustomerWorkspaceOnboardingDocument(workspaceId: string, stagedItemId: string) {
  return customerFetch<WorkspaceOnboardingResponse>(
    `${workspaceOnboardingPath(workspaceId)}/knowledge/documents/${encodeURIComponent(stagedItemId)}`,
    { method: 'DELETE' },
  );
}

export function postCustomerWorkspaceOnboardingDocumentsBulkDelete(workspaceId: string, ids: string[]) {
  return postOnboardingKnowledgeBulkDelete(workspaceId, 'documents', ids);
}

export function deleteCustomerWorkspaceOnboardingDatasheet(workspaceId: string, stagedItemId: string) {
  return customerFetch<WorkspaceOnboardingResponse>(
    `${workspaceOnboardingPath(workspaceId)}/knowledge/datasheets/${encodeURIComponent(stagedItemId)}`,
    { method: 'DELETE' },
  );
}

export function postCustomerWorkspaceOnboardingDatasheetsBulkDelete(workspaceId: string, ids: string[]) {
  return postOnboardingKnowledgeBulkDelete(workspaceId, 'datasheets', ids);
}

function onboardingKnowledgeJson<T = WorkspaceOnboardingResponse>(
  workspaceId: string,
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
) {
  return customerFetch<T>(`${workspaceOnboardingPath(workspaceId)}/knowledge/${path}`, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

export type WorkspaceOnboardingBulkDeleteResponse = WorkspaceOnboardingResponse & {
  deletedCount?: number;
};

function postOnboardingKnowledgeBulkDelete(
  workspaceId: string,
  kind: 'documents' | 'datasheets' | 'snippets' | 'qas',
  ids: string[],
) {
  return onboardingKnowledgeJson<WorkspaceOnboardingBulkDeleteResponse>(
    workspaceId,
    `${kind}/bulk-delete`,
    'POST',
    { ids },
  );
}

export function postCustomerWorkspaceOnboardingSnippet(
  workspaceId: string,
  body: { title: string; description: string },
) {
  return onboardingKnowledgeJson(workspaceId, 'snippets', 'POST', body);
}

export function patchCustomerWorkspaceOnboardingSnippet(
  workspaceId: string,
  snippetId: string,
  body: Partial<{ title: string; description: string }>,
) {
  return onboardingKnowledgeJson(
    workspaceId,
    `snippets/${encodeURIComponent(snippetId)}`,
    'PATCH',
    body,
  );
}

export function deleteCustomerWorkspaceOnboardingSnippet(workspaceId: string, snippetId: string) {
  return onboardingKnowledgeJson(workspaceId, `snippets/${encodeURIComponent(snippetId)}`, 'DELETE');
}

export function postCustomerWorkspaceOnboardingSnippetsBulkDelete(workspaceId: string, ids: string[]) {
  return postOnboardingKnowledgeBulkDelete(workspaceId, 'snippets', ids);
}

export function postCustomerWorkspaceOnboardingQa(
  workspaceId: string,
  body: { title: string; questions: string[]; answer: string },
) {
  return onboardingKnowledgeJson(workspaceId, 'qas', 'POST', body);
}

export function patchCustomerWorkspaceOnboardingQa(
  workspaceId: string,
  qaId: string,
  body: Partial<{ title: string; questions: string[]; answer: string }>,
) {
  return onboardingKnowledgeJson(workspaceId, `qas/${encodeURIComponent(qaId)}`, 'PATCH', body);
}

export function deleteCustomerWorkspaceOnboardingQa(workspaceId: string, qaId: string) {
  return onboardingKnowledgeJson(workspaceId, `qas/${encodeURIComponent(qaId)}`, 'DELETE');
}

export function postCustomerWorkspaceOnboardingQasBulkDelete(workspaceId: string, ids: string[]) {
  return postOnboardingKnowledgeBulkDelete(workspaceId, 'qas', ids);
}

export function postCustomerWorkspaceOnboardingQaImport(workspaceId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  return customerFetch<
    WorkspaceOnboardingResponse & { imported?: number; skippedCount?: number; skippedReason?: string }
  >(`${workspaceOnboardingPath(workspaceId)}/knowledge/qas/import`, {
    method: 'POST',
    body: fd,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));
}

export function postCustomerWorkspaceOnboardingSnippetImport(workspaceId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120_000);
  return customerFetch<
    WorkspaceOnboardingResponse & { imported?: number; skippedCount?: number; skippedReason?: string }
  >(`${workspaceOnboardingPath(workspaceId)}/knowledge/snippets/import`, {
    method: 'POST',
    body: fd,
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timer));
}

/** Transcribe audio for Describe Your AI Agent (does not save draft). */
export function postCustomerWorkspaceOnboardingDictation(workspaceId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60_000);
  return customerFetch<{ text: string }>(
    `${workspaceOnboardingPath(workspaceId)}/dictation/describe-agent`,
    { method: 'POST', body: fd, signal: controller.signal },
  ).finally(() => window.clearTimeout(timer));
}
