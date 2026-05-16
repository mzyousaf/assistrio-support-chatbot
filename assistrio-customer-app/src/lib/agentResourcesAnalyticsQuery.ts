import type {
  CustomerBotAgentResourcesAnalyticsParams,
  CustomerChatsAnalyticsGranularity,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  computeDateRangeFromAnalyticsPreset,
  localYmd,
  type ChatsAnalyticsDatePreset,
  type ChatsAnalyticsUiState,
} from '@/lib/chatsAnalyticsQuery';
export type AgentResourcesDatePreset = ChatsAnalyticsDatePreset;

export type AgentResourcesAnalyticsUiState = Pick<
  ChatsAnalyticsUiState,
  'preset' | 'customFrom' | 'customTo' | 'includePreview' | 'startedFromKeys'
>;

export const AGENT_RESOURCES_ANALYTICS_DEFAULTS: AgentResourcesAnalyticsUiState = {
  preset: '7d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFromKeys: [],
};

/** KB item detail Source Usage chart — same default range as Agent Resources (`7d`). */
export const KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS: AgentResourcesAnalyticsUiState = {
  ...AGENT_RESOURCES_ANALYTICS_DEFAULTS,
};

export function buildAgentResourcesAnalyticsApiParams(
  state: AgentResourcesAnalyticsUiState,
): CustomerBotAgentResourcesAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state);
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);
  const params: CustomerBotAgentResourcesAnalyticsParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };
  if (state.startedFromKeys.length > 0) {
    params.startedFrom = [...state.startedFromKeys].sort().join(',');
  }
  return params;
}

export { localYmd };
