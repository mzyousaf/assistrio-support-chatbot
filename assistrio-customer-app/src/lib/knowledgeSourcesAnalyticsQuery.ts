import type {
  CustomerBotKnowledgeSourcesAnalyticsParams,
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsStartedFromKey,
  CustomerKnowledgeSourcesAnalyticsSourceType,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  computeDateRangeFromAnalyticsPreset,
  localYmd,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type KnowledgeSourcesDatePreset = ChatsAnalyticsDatePreset;

export type KnowledgeSourcesAnalyticsUiState = {
  preset: KnowledgeSourcesDatePreset;
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  /** Reserved for shared date controls; not sent to the knowledge-sources API. */
  startedFrom: '' | CustomerChatsAnalyticsStartedFromKey;
  sourceType: '' | CustomerKnowledgeSourcesAnalyticsSourceType;
};

export const KNOWLEDGE_SOURCES_ANALYTICS_DEFAULTS: KnowledgeSourcesAnalyticsUiState = {
  preset: '30d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
  sourceType: '',
};

export function buildKnowledgeSourcesAnalyticsApiParams(
  state: KnowledgeSourcesAnalyticsUiState,
): CustomerBotKnowledgeSourcesAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state);
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);

  const params: CustomerBotKnowledgeSourcesAnalyticsParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };
  if (state.sourceType) params.sourceType = state.sourceType;
  return params;
}

/** `includePreview` omitted from query when true (matches API default). */
export function knowledgeSourcesAnalyticsQueryIncludesPreviewFlag(
  params: CustomerBotKnowledgeSourcesAnalyticsParams,
): boolean {
  return params.includePreview === false;
}

export { localYmd };
