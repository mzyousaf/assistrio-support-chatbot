import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerChatsAnalyticsGranularity, CustomerUsageTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsCreditsWithUnit, formatAnalyticsDateLabel } from '@/lib/analyticsFormat';
import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import { APEX } from '@/pages/bot-workspace/analytics/shared/apexAnalyticsTheme';
import { ApexChartLoader } from '@/pages/bot-workspace/analytics/shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '@/pages/bot-workspace/analytics/shared/apexTooltip';
import { apexChartBase, apexGrid, apexLegendBottom, apexXAxisCategories } from '@/pages/bot-workspace/analytics/shared/apexChartUtils';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';

type Props = {
  timeSeries: CustomerUsageTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function UsageCreditsOverTimeChart({ timeSeries, granularity }: Props) {
  const { series, options } = useMemo(() => {
    const cats = timeSeries.map((t) => formatAnalyticsDateLabel(t.date, granularity));
    const ser: ApexOptions['series'] = [
      { name: 'Total credits', data: timeSeries.map((t) => t.creditsUsed ?? 0) },
      { name: 'Billable', data: timeSeries.map((t) => t.billableCredits ?? 0) },
      { name: 'Non-billable', data: timeSeries.map((t) => t.nonBillableCredits ?? 0) },
    ];
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'line' },
      colors: [CHART.teal600, CHART.teal700, CHART.slate400],
      stroke: { curve: 'smooth', width: [2, 1.75, 1.75] },
      markers: { size: 0, hover: { size: 4 } },
      grid: apexGrid(),
      legend: apexLegendBottom(),
      xaxis: {
        ...apexXAxisCategories(cats, -35),
        tickPlacement: 'on',
        tooltip: { enabled: false },
      },
      yaxis: {
        labels: {
          style: { colors: APEX.axis, fontSize: '11px' },
          formatter: (v: number) => formatAnalyticsCreditsWithUnit(v),
        },
      },
      tooltip: {
        shared: true,
        intersect: false,
        custom: (opts: {
          dataPointIndex: number;
          w: { globals: { categoryLabels: string[]; seriesNames: string[]; series: number[][] } };
        }) => {
          const i = opts.dataPointIndex;
          if (i < 0) return '';
          const { categoryLabels, seriesNames, series: sers } = opts.w.globals;
          const cat = categoryLabels[i] ?? '';
          const rows: string[] = [];
          for (let si = 0; si < sers.length; si++) {
            const raw = sers[si]?.[i];
            const v = typeof raw === 'number' && Number.isFinite(raw) ? raw : NaN;
            if (!Number.isFinite(v)) continue;
            rows.push(apexTooltipRow(seriesNames[si] ?? '', formatAnalyticsCreditsWithUnit(v)));
          }
          return apexTooltipShell(cat, rows.join(''));
        },
      },
    };
    return { series: ser, options: opts };
  }, [timeSeries, granularity]);

  if (!timeSeries.length) {
    return <AnalyticsChartEmpty message="No time-series data for this range." className="h-[280px]" />;
  }

  return (
    <div className="min-h-[280px] w-full">
      <ApexChartLoader options={options} series={series} type="line" height={300} width="100%" />
    </div>
  );
}
