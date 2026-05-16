import type { CustomerLeadsAnalyticsSummary } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsRatioAsPercent } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import { Layers, MessagesSquare, Percent, Sigma, UserCheck } from 'lucide-react';

type Props = { summary: CustomerLeadsAnalyticsSummary };

export function LeadsSummaryCards({ summary }: Props) {
  const convRate = formatAnalyticsRatioAsPercent(summary.conversionRate, 1);
  const avgFields =
    summary.averageFieldsPerLead != null && Number.isFinite(summary.averageFieldsPerLead)
      ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(summary.averageFieldsPerLead)
      : '—';

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Conversations',
      value: formatAnalyticsInteger(summary.totalConversations),
      hint: 'Chats started in this range',
      Icon: MessagesSquare,
    },
    {
      label: 'Leads captured',
      value: formatAnalyticsInteger(summary.totalLeads),
      hint: 'With lead data saved',
      Icon: UserCheck,
    },
    {
      label: 'Conversion rate',
      value: convRate,
      hint: 'Qualified leads ÷ conversations',
      Icon: Percent,
    },
    {
      label: 'Field fills',
      value: formatAnalyticsInteger(summary.totalCapturedFields),
      hint: 'Non-empty captured values (counts only)',
      Icon: Layers,
    },
    {
      label: 'Avg fields / lead',
      value: avgFields,
      hint: 'Across captured leads',
      Icon: Sigma,
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />;
}
