import { CHART } from '../shared/analyticsChartTheme';

export const CHATS_ACTIVITY_SERIES = [
  { id: 'conversations', label: 'Conversations', color: CHART.teal600 },
  { id: 'messages', label: 'Messages', color: CHART.slate500 },
] as const;

export type ChatsActivitySeriesId = (typeof CHATS_ACTIVITY_SERIES)[number]['id'];
