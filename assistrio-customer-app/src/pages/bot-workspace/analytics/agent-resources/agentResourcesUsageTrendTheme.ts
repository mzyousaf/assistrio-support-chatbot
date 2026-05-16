import { CHART } from '../shared/analyticsChartTheme';

export const AGENT_RESOURCES_USAGE_SERIES = [
  {
    id: 'textCredits',
    label: 'Text messages',
    mapsToUsageType: 'text_message' as const,
    color: CHART.usageCreditStackText,
  },
  {
    id: 'voiceCredits',
    label: 'Voice messages',
    mapsToUsageType: 'voice_message' as const,
    color: CHART.usageCreditStackVoice,
  },
  {
    id: 'dictationCredits',
    label: 'Dictation sessions',
    mapsToUsageType: 'dictation_session' as const,
    color: CHART.usageCreditStackDictation,
  },
  { id: 'totalCreditsUsed', label: 'Total Usage', color: CHART.teal600 },
] as const;

export type AgentResourcesUsageSeriesId = (typeof AGENT_RESOURCES_USAGE_SERIES)[number]['id'];

export const AGENT_RESOURCES_USAGE_SERIES_IDS: AgentResourcesUsageSeriesId[] =
  AGENT_RESOURCES_USAGE_SERIES.map((s) => s.id);
