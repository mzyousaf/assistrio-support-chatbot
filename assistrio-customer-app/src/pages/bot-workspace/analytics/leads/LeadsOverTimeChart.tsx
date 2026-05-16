import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerChatsAnalyticsGranularity, CustomerLeadsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { APEX } from '../shared/apexAnalyticsTheme';
import { ApexChartLoader } from '../shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '../shared/apexTooltip';
import { apexChartBase, apexGrid, apexLegendBottom, apexXAxisCategories } from '../shared/apexChartUtils';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

type Props = {
  points: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function LeadsOverTimeChart({ points, granularity }: Props) {
  const { series, options } = useMemo(() => {
    const cats = points.map((p) => formatAnalyticsDateLabel(p.date, granularity));
    const ser: ApexOptions['series'] = [
      { name: 'Conversations', data: points.map((p) => p.conversations ?? 0) },
      { name: 'Leads captured', data: points.map((p) => p.leads ?? 0) },
    ];
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'line' },
      colors: [CHART.slate500, CHART.teal600],
      stroke: { curve: 'smooth', width: [2, 2] },
      markers: { size: 0, hover: { size: 4 } },
      grid: apexGrid(),
      legend: apexLegendBottom(),
      xaxis: { ...apexXAxisCategories(cats, -35), tooltip: { enabled: false } },
      yaxis: {
        labels: {
          style: { colors: APEX.axis, fontSize: '11px' },
          formatter: (v: number) => formatAnalyticsInteger(v),
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
            const nm = seriesNames[si] ?? '';
            const displayName = nm === 'Leads' ? 'Leads captured' : nm === 'Conversations' ? 'Conversations' : nm;
            rows.push(apexTooltipRow(displayName, formatAnalyticsInteger(v)));
          }
          return apexTooltipShell(cat, rows.join(''));
        },
      },
    };
    return { series: ser, options: opts };
  }, [points, granularity]);

  const hasActivity = points.some((d) => (d.conversations ?? 0) > 0 || (d.leads ?? 0) > 0);

  if (!points.length) {
    return <AnalyticsChartEmpty message="No time-series data for this range." className="h-[220px]" />;
  }
  if (!hasActivity) {
    return <AnalyticsChartEmpty message="No conversations in this range." className="h-[220px]" />;
  }

  return (
    <div className="min-h-[280px] w-full">
      <ApexChartLoader options={options} series={series} type="line" height={300} width="100%" />
    </div>
  );
}
