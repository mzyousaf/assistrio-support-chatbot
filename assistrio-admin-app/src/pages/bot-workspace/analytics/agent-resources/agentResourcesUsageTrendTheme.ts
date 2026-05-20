/** Credit breakdown legend colors (conversation insights modal). */
const USAGE_COLORS = {
  text: '#5278d9',
  voice: '#8f74d8',
  dictation: '#e89563',
  total: '#0d9488',
} as const;

export const AGENT_RESOURCES_USAGE_SERIES = [
  {
    id: 'textCredits',
    label: 'Text messages',
    mapsToUsageType: 'text_message' as const,
    color: USAGE_COLORS.text,
  },
  {
    id: 'voiceCredits',
    label: 'Voice messages',
    mapsToUsageType: 'voice_message' as const,
    color: USAGE_COLORS.voice,
  },
  {
    id: 'dictationCredits',
    label: 'Dictation sessions',
    mapsToUsageType: 'dictation_session' as const,
    color: USAGE_COLORS.dictation,
  },
  { id: 'totalCreditsUsed', label: 'Total Usage', color: USAGE_COLORS.total },
] as const;

export type AgentResourcesUsageSeriesId = (typeof AGENT_RESOURCES_USAGE_SERIES)[number]['id'];

export const AGENT_RESOURCES_USAGE_SERIES_IDS: AgentResourcesUsageSeriesId[] =
  AGENT_RESOURCES_USAGE_SERIES.map((s) => s.id);
