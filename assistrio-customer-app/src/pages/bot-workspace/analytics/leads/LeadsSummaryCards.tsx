import type { ReactNode } from 'react';
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

function leadsCardTooltip(title: string, body: ReactNode): ReactNode {
  return (
    <div className="space-y-1 text-left">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-300">{title}</p>
      <div className="m-0 max-w-[18rem] text-[0.75rem] font-medium leading-snug text-slate-50">{body}</div>
    </div>
  );
}

type Props = {
  summary: CustomerLeadsAnalyticsSummary;
  timeSeries: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function LeadsSummaryCards({ summary, timeSeries, granularity }: Props) {
  const convRate = formatAnalyticsRatioAsPercent(summary.conversionRate ?? 0, 1);

  const cards: AnalyticsKpiItem[] = [
    {
      label: 'Conversion rate',
      value: convRate,
      headerInline: true,
      tileTooltip: leadsCardTooltip(
        'Conversion rate',
        <>
          Share of conversations that produced at least one lead, calculated as leads ÷ conversations.
        </>,
      ),
      footer: <LeadsConversionKpiMiniChart points={timeSeries} granularity={granularity} />,
    },
    {
      label: 'Complete leads',
      value: formatAnalyticsInteger(summary.completeLeads),
      headerInline: true,
      tileTooltip: leadsCardTooltip(
        'Complete leads',
        <>
          Qualified captures where every active required lead field has a non-empty value, using your bot’s current lead rules.
        </>,
      ),
      footer: (
        <LeadsCountKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="completeLeads" />
      ),
    },
    {
      label: 'Partial leads',
      value: formatAnalyticsInteger(summary.partialLeads),
      headerInline: true,
      tileTooltip: leadsCardTooltip(
        'Partial leads',
        <>Captured lead details that don’t yet pass your bot’s “complete lead” checks (missing or empty required fields).</>,
      ),
      footer: (
        <LeadsCountKpiMiniChart points={timeSeries} granularity={granularity} seriesKey="partialLeads" />
      ),
    },
  ];

  return <AnalyticsKpiGrid items={cards} columnsClassName="grid-cols-1 sm:grid-cols-3" />;
}
