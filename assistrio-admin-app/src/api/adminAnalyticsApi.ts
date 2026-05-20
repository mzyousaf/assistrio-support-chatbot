import { adminFetch } from './client';
import type {
  AdminAnalyticsBotDetailResponse,
  AdminAnalyticsBotsSummaryResponse,
  AdminAnalyticsDateParams,
  AdminAnalyticsLeadsSummaryResponse,
  AdminAnalyticsOverviewResponse,
  AdminCustomerAnalyticsOverviewResponse,
} from './adminAnalyticsTypes';
import type { ApiResult } from './types';

const BASE = '/api/admin/analytics';
const CUSTOMERS_BASE = '/api/admin/customers';

function withAnalyticsQuery(path: string, params?: AdminAnalyticsDateParams): string {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  if (params?.scope) q.set('scope', params.scope);
  if (params?.platformOnly === true) q.set('platformOnly', 'true');
  if (params?.customerId?.trim()) q.set('customerId', params.customerId.trim());
  const qs = q.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

export function getAdminAnalyticsOverview(params?: AdminAnalyticsDateParams) {
  return adminFetch<AdminAnalyticsOverviewResponse>(withAnalyticsQuery(`${BASE}/overview`, params));
}

export function getAdminAnalyticsBotsSummary(params?: AdminAnalyticsDateParams) {
  return adminFetch<AdminAnalyticsBotsSummaryResponse>(withAnalyticsQuery(`${BASE}/bots/summary`, params));
}

export function getAdminAnalyticsLeadsSummary(params?: AdminAnalyticsDateParams) {
  return adminFetch<AdminAnalyticsLeadsSummaryResponse>(withAnalyticsQuery(`${BASE}/leads/summary`, params));
}

export function getAdminAnalyticsBotDetail(botId: string, params?: AdminAnalyticsDateParams) {
  return adminFetch<AdminAnalyticsBotDetailResponse>(
    withAnalyticsQuery(`${BASE}/bots/${encodeURIComponent(botId)}`, params),
  );
}

export function getAdminCustomerAnalyticsOverview(
  customerId: string,
  params?: Pick<AdminAnalyticsDateParams, 'from' | 'to'>,
) {
  const q = new URLSearchParams();
  if (params?.from?.trim()) q.set('from', params.from.trim());
  if (params?.to?.trim()) q.set('to', params.to.trim());
  const qs = q.toString();
  return adminFetch<AdminCustomerAnalyticsOverviewResponse>(
    `${CUSTOMERS_BASE}/${encodeURIComponent(customerId)}/analytics/overview${qs ? `?${qs}` : ''}`,
  );
}

export type { ApiResult };
