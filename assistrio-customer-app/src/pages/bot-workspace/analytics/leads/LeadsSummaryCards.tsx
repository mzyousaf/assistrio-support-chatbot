import type {
  CustomerChatsAnalyticsGranularity,
  CustomerLeadsAnalyticsSummary,
  CustomerLeadsTimeSeriesPoint,
} from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsRatioAsPercent } from '@/lib/analyticsFormat';
import {
  AnalyticsKpiGrid,
  type AnalyticsKpiItem,
} from '@/pages/bot-workspace/analytics/shared/AnalyticsKpiGrid';
import { LeadsCountKpiMiniChart } from './LeadsCountKpiMiniChart';
import { LeadsConversionKpiMiniChart } from './LeadsConversionKpiMiniChart';

type Props = {
  summary: CustomerLeadsAnalyticsSummary;
  timeSeries: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function LeadsSummaryCards({ summary, timeSeries, granularity }: Props) {
  const convRate = formatAnalyticsRatioAsPercent(summary.conversionRate, 1);

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Conversion rate',
      value: convRate,
      infoTooltip: 'Leads ÷ conversations',
      headerInline: true,
      footer: <LeadsConversionKpiMiniChart points={timeSeries} granularity={granularity} />,
    },
    {
      label: 'Complete leads',
      value: formatAnalyticsInteger(summary.completeLeads),
      infoTooltip:
        'Complete leads — qualified captures where every active required lead field has a non-empty value (current bot rules).',
      headerInline: true,
      footer: (
        <LeadsCountKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="completeLeads" />
      ),
    },
    {
      label: 'Partial leads',
      value: formatAnalyticsInteger(summary.partialLeads),
      infoTooltip: 'Partial leads — captured lead data that does not yet meet complete-lead rules.',
      headerInline: true,
      footer: (
        <LeadsCountKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="partialLeads" />
      ),
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-1 sm:grid-cols-3" />;
}
