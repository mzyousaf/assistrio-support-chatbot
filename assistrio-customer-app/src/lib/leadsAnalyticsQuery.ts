import type {
  CustomerBotLeadsAnalyticsParams,
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsStartedFromKey,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  computeDateRangeFromAnalyticsPreset,
  localYmd,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type { ChatsAnalyticsDatePreset };

export type LeadsAnalyticsUiState = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  startedFrom: '' | CustomerChatsAnalyticsStartedFromKey;
  countryCode: string;
};

export const LEADS_ANALYTICS_DEFAULTS: LeadsAnalyticsUiState = {
  preset: '30d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
  countryCode: '',
};

export function buildLeadsAnalyticsApiParams(state: LeadsAnalyticsUiState): CustomerBotLeadsAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state);
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);

  const params: CustomerBotLeadsAnalyticsParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };
  if (state.startedFrom) params.startedFrom = state.startedFrom;
  if (state.countryCode.trim()) params.countryCode = state.countryCode.trim().toUpperCase();
  return params;
}

export function leadsAnalyticsQueryIncludesPreviewFlag(params: CustomerBotLeadsAnalyticsParams): boolean {
  return params.includePreview === false;
}

export { localYmd };
