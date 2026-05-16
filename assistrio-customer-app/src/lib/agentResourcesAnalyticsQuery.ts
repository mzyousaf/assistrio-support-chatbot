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
  'preset' | 'customFrom' | 'customTo' | 'includePreview' | 'startedFrom'
>;

export const AGENT_RESOURCES_ANALYTICS_DEFAULTS: AgentResourcesAnalyticsUiState = {
  preset: '7d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
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
  if (state.startedFrom) params.startedFrom = state.startedFrom;
  return params;
}

export { localYmd };
