import type {
  CustomerBotUsageParams,
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsStartedFromKey,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  computeDateRangeFromAnalyticsPreset,
  isoRangeForLastDays,
  isoRangeForLocalDateInputs,
  isoRangeForToday,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type UsageAnalyticsUiState = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  /** Reserved for shared date controls; not sent to the usage API. */
  startedFrom: '' | CustomerChatsAnalyticsStartedFromKey;
  /** '' = all types */
  usageTypeFilter: string;
};

export const USAGE_ANALYTICS_DEFAULTS: UsageAnalyticsUiState = {
  preset: '30d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
  usageTypeFilter: '',
};

export function buildUsageAnalyticsApiParams(state: UsageAnalyticsUiState): CustomerBotUsageParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state);
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);

  const params: CustomerBotUsageParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };
  if (state.usageTypeFilter.trim()) {
    params.usageType = state.usageTypeFilter.trim();
  }
  return params;
}

export const USAGE_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All usage types' },
  { value: 'text_message', label: 'Text message' },
  { value: 'voice_message', label: 'Voice message' },
  { value: 'dictation_message', label: 'Dictation message' },
  { value: 'attachment_message', label: 'Attachment message' },
  { value: 'suggested_question_message', label: 'Suggested question' },
  { value: 'quick_reply_message', label: 'Quick reply' },
  { value: 'assistant_reply', label: 'Assistant reply' },
  { value: 'stt_seconds', label: 'Speech (STT)' },
  { value: 'unknown_message', label: 'Unknown message' },
];

export { isoRangeForLastDays, isoRangeForLocalDateInputs, isoRangeForToday };
