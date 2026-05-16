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

/** Client-side filter for Captured fields chart only (`''` = every status; not sent to API). */
export type LeadsFieldCaptureStatusFilter = '' | 'active' | 'inactive' | 'deleted';

export type LeadsAnalyticsUiState = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  startedFrom: '' | CustomerChatsAnalyticsStartedFromKey;
  countryCode: string;
  fieldCaptureStatus: LeadsFieldCaptureStatusFilter;
};

export const LEADS_ANALYTICS_DEFAULTS: LeadsAnalyticsUiState = {
  preset: '7d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
  countryCode: '',
  fieldCaptureStatus: '',
};

export function buildLeadsAnalyticsApiParams(state: LeadsAnalyticsUiState): CustomerBotLeadsAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state, { invalidCustomFallbackLastDays: 7 });
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
