import type { ReactNode } from 'react';
import type {
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsSummary,
  CustomerChatsAnalyticsTimeSeriesPoint,
} from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import { ChatsSummaryKpiMiniChart } from './ChatsSummaryKpiMiniChart';

function chatsCardTooltip(title: string, body: ReactNode): ReactNode {
  return (
    <div className="space-y-1 text-left">
      <p className="m-0 text-[11px] font-semibold normal-case tracking-wide text-slate-300">{title}</p>
      <div className="m-0 max-w-[18rem] text-[0.75rem] font-medium leading-snug text-slate-50">{body}</div>
    </div>
  );
}

type Props = {
  summary: CustomerChatsAnalyticsSummary;
  timeSeries: CustomerChatsAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function AnalyticsSummaryCards({ summary, timeSeries, granularity }: Props) {
  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Conversations',
      labelClassName: 'normal-case tracking-normal text-slate-600',
      value: formatAnalyticsInteger(summary.totalConversations),
      headerInline: true,
      tileTooltip: chatsCardTooltip(
        'Conversations',
        <>
          Distinct chat threads started in your selected range and filters — each thread counts once even if it has many
          messages.
        </>,
      ),
      footer: (
        <ChatsSummaryKpiMiniChart
          points={timeSeries}
          granularity={granularity}
          seriesKey="conversations"
        />
      ),
    },
    {
      label: 'Messages',
      labelClassName: 'normal-case tracking-normal text-slate-600',
      value: formatAnalyticsInteger(summary.totalMessages),
      headerInline: true,
      tileTooltip: chatsCardTooltip(
        'Messages',
        <>All user and assistant messages counted across those conversations in this range.</>,
      ),
      footer: (
        <ChatsSummaryKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="messages" />
      ),
    },
    {
      label: 'Thumbs up',
      labelClassName: 'normal-case tracking-normal text-slate-600',
      value: formatAnalyticsInteger(summary.totalThumbsUp),
      headerInline: true,
      tileTooltip: chatsCardTooltip(
        'Thumbs up',
        <>
          Assistant replies visitors marked helpful — sparkline uses thumbs-up events by time bucket (when feedback was
          submitted).
        </>,
      ),
      footer: (
        <ChatsSummaryKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="thumbsUp" />
      ),
    },
    {
      label: 'Thumbs down',
      labelClassName: 'normal-case tracking-normal text-slate-600',
      value: formatAnalyticsInteger(summary.totalThumbsDown),
      headerInline: true,
      tileTooltip: chatsCardTooltip(
        'Thumbs down',
        <>
          Assistant replies visitors marked not helpful — sparkline uses thumbs-down events by time bucket (when feedback was
          submitted).
        </>,
      ),
      footer: (
        <ChatsSummaryKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="thumbsDown" />
      ),
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />;
}
