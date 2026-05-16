import type { CustomerChatsAnalyticsSummary } from '@/api/types';

import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import { MessageSquare, MessagesSquare, ThumbsDown, ThumbsUp } from 'lucide-react';

type Props = {
  summary: CustomerChatsAnalyticsSummary;
};

export function AnalyticsSummaryCards({ summary }: Props) {
  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Conversations',
      hint: 'Threads in this range and filters',
      value: formatAnalyticsInteger(summary.totalConversations),
      Icon: MessagesSquare,
    },
    {
      label: 'Messages',
      hint: 'User and assistant messages',
      value: formatAnalyticsInteger(summary.totalMessages),
      Icon: MessageSquare,
    },
    {
      label: 'Thumbs up',
      hint: 'Assistant replies rated up',
      value: formatAnalyticsInteger(summary.totalThumbsUp),
      Icon: ThumbsUp,
    },
    {
      label: 'Thumbs down',
      hint: 'Assistant replies rated down',
      value: formatAnalyticsInteger(summary.totalThumbsDown),
      Icon: ThumbsDown,
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-2 sm:grid-cols-4" />;
}
