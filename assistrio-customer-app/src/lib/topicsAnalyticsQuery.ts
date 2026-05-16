import type {
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsStartedFromKey,
  CustomerTopicAnalyticsParams,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  computeDateRangeFromAnalyticsPreset,
  localYmd,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type { ChatsAnalyticsDatePreset };

/** API `messageTopicScope`: `primary` = primary-topic mentions only; `all` = secondary labels + primary fallback (broader). */
export type TopicsMessageTopicScope = 'all' | 'primary';

export type TopicsAnalyticsUiState = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  startedFromKeys: CustomerChatsAnalyticsStartedFromKey[];
  /** Chart + ranking: messages vs conversations (UI only; API returns both breakdowns). */
  metricMode: 'messages' | 'conversations';
  /** Message-level topic tag scope: primary only vs all tags on the message. Conversation metric always uses primary-only matching. */
  messageTopicScope: TopicsMessageTopicScope;
};

export const TOPICS_ANALYTICS_DEFAULTS: TopicsAnalyticsUiState = {
  preset: '7d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFromKeys: [],
  metricMode: 'messages',
  messageTopicScope: 'primary',
};

export function buildTopicsAnalyticsApiParams(state: TopicsAnalyticsUiState): CustomerTopicAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state, { invalidCustomFallbackLastDays: 7 });
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);

  const params: CustomerTopicAnalyticsParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };
  if (state.startedFromKeys.length > 0) {
    params.startedFrom = [...state.startedFromKeys].sort().join(',');
  }
  if (state.metricMode === 'conversations' || state.messageTopicScope === 'primary') {
    params.messageTopicScope = 'primary';
  }
  return params;
}

export function topicsAnalyticsQueryIncludesPreviewFlag(params: CustomerTopicAnalyticsParams): boolean {
  return params.includePreview === false;
}

export { localYmd };
