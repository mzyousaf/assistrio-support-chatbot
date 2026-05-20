import { adminFetch } from './client';
import type {
  AdminBotConversationsListParams,
  AdminBotConversationsListResponse,
  AdminConversationDetail,
  AdminConversationMessage,
  ApiResult,
} from './types';

const conversationsPath = (botId: string) =>
  `/api/admin/bots/${encodeURIComponent(botId)}/conversations`;

export function getAdminBotConversations(botId: string, params?: AdminBotConversationsListParams) {
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
  return adminFetch<AdminBotConversationsListResponse>(
    `${conversationsPath(botId)}${qs ? `?${qs}` : ''}`,
  );
}

export function getAdminBotConversationDetail(botId: string, conversationId: string) {
  return adminFetch<AdminConversationDetail>(
    `${conversationsPath(botId)}/${encodeURIComponent(conversationId)}`,
  );
}

export function getAdminBotConversationMessages(botId: string, conversationId: string) {
  return adminFetch<{ ok: true; messages: AdminConversationMessage[] }>(
    `${conversationsPath(botId)}/${encodeURIComponent(conversationId)}/messages`,
  );
}

export type { ApiResult };
