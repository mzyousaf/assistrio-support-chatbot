import { CHART } from '../shared/analyticsChartTheme';

/** Teal area: user-originated message volume per bucket. */
export const CHATS_MESSAGE_TOTAL_AREA_KEY = 'userMessages' as const;

export const CHATS_MESSAGE_MODALITY_SERIES = [
  { id: CHATS_MESSAGE_TOTAL_AREA_KEY, label: 'User messages', color: CHART.teal600, chart: 'area' as const },
  { id: 'textMessages', label: 'User text messages', color: CHART.usageCreditStackText, chart: 'line' as const },
  { id: 'voiceMessages', label: 'User voice messages', color: CHART.usageCreditStackVoice, chart: 'line' as const },
] as const;

export type ChatsMessageModalitySeriesId = (typeof CHATS_MESSAGE_MODALITY_SERIES)[number]['id'];
