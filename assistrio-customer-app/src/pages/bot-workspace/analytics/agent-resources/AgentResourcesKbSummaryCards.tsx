import { BookOpen, Layers, MessageSquare, Star, TrendingUp, Hash } from 'lucide-react';
import type { CustomerAgentResourcesKbSummary } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsNumber } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';

type Props = { summary: CustomerAgentResourcesKbSummary };

export function AgentResourcesKbSummaryCards({ summary }: Props) {
  const top = summary.topPrimarySource;
  const topLabel =
    top == null || !top.sourceTitle?.trim()
      ? '—'
      : `${top.sourceTitle.trim()} (${top.sourceType.replace(/_/g, ' ')})`;

  const avgScore =
    summary.averagePrimarySourceScore == null
      ? '—'
      : formatAnalyticsNumber(summary.averagePrimarySourceScore, { maximumFractionDigits: 4 });

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Messages with sources',
      hint: 'Assistant answers citing at least one knowledge source',
      value: formatAnalyticsInteger(summary.messagesWithSources),
      Icon: BookOpen,
    },
    {
      label: 'Messages without sources',
      hint: 'Assistant answers with no attached sources',
      value: formatAnalyticsInteger(summary.messagesWithoutSources),
      Icon: MessageSquare,
    },
    {
      label: 'Primary source uses',
      hint: 'One primary attribution per assistant answer (highest score)',
      value: formatAnalyticsInteger(summary.primarySourceUses),
      Icon: Layers,
    },
    {
      label: 'Unique primary sources',
      hint: 'Distinct knowledge items used as the primary source',
      value: formatAnalyticsInteger(summary.uniquePrimarySources),
      Icon: Hash,
    },
    {
      label: 'Top primary source',
      hint: 'Most frequent primary source in the selected range',
      value: topLabel,
      Icon: TrendingUp,
    },
    {
      label: 'Avg primary match score',
      hint: 'Across primary source rows with a numeric relevance score',
      value: avgScore,
      Icon: Star,
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />;
}
