import type { CustomerKnowledgeSourcesAnalyticsSummary } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsNumber, formatAnalyticsScore } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import {
  BookMarked,
  CircleDashed,
  Hash,
  Layers,
  MessageCircleReply,
  Sigma,
} from 'lucide-react';

type Props = { summary: CustomerKnowledgeSourcesAnalyticsSummary };

export function KnowledgeSourcesSummaryCards({ summary }: Props) {
  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Answers with sources',
      value: formatAnalyticsInteger(summary.messagesWithSources),
      hint: 'Assistant replies citing knowledge',
      Icon: BookMarked,
    },
    {
      label: 'Answers without sources',
      value: formatAnalyticsInteger(summary.messagesWithoutSources),
      hint: 'No citations in this range',
      Icon: CircleDashed,
    },
    {
      label: 'Total source uses',
      value: formatAnalyticsInteger(summary.totalSourceUses),
      hint: 'Citations counted per source line',
      Icon: Layers,
    },
    {
      label: 'Unique sources',
      value: formatAnalyticsInteger(summary.uniqueSourcesUsed),
      hint: 'Distinct KB items or titles',
      Icon: Hash,
    },
    {
      label: 'Avg sources / answer',
      value:
        summary.averageSourcesPerAnswer != null
          ? formatAnalyticsNumber(summary.averageSourcesPerAnswer, { maximumFractionDigits: 2 })
          : '—',
      hint: 'Average citations per assistant reply',
      Icon: MessageCircleReply,
    },
    {
      label: 'Avg source match score',
      value: formatAnalyticsScore(summary.averageSourceMatchScore),
      hint: 'Plain numeric score when recorded',
      Icon: Sigma,
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />;
}
