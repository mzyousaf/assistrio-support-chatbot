import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerChatsAnalyticsGranularity, CustomerLeadsTimeSeriesPoint } from '@/api/types';
import {
  formatAnalyticsDateLabel,
  formatAnalyticsInteger,
  formatAnalyticsRatioAsPercent,
} from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { APEX } from '../shared/apexAnalyticsTheme';
import { ApexChartLoader } from '../shared/ApexChartLoader';
import { apexChartBase, apexGrid, apexXAxisCategories } from '../shared/apexChartUtils';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

type Row = CustomerLeadsTimeSeriesPoint & { label: string; pct: number | null };

type Props = {
  points: CustomerLeadsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
};

export function LeadsConversionChart({ points, granularity }: Props) {
  const { series, options } = useMemo(() => {
    const data: Row[] = points.map((p) => ({
      ...p,
      label: formatAnalyticsDateLabel(p.date, granularity),
      pct: p.conversionRate != null && Number.isFinite(p.conversionRate) ? p.conversionRate * 100 : null,
    }));
    const cats = data.map((d) => d.label);
    const ser: ApexOptions['series'] = [
      {
        name: 'Conversion rate',
        data: data.map((d) => (d.pct == null ? null : d.pct)),
      },
    ];
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'line' },
      colors: [CHART.teal600],
      stroke: { curve: 'smooth', width: 2, connectNulls: false } as ApexOptions['stroke'],
      markers: { size: 2, hover: { size: 4 } },
      grid: apexGrid(),
      xaxis: { ...apexXAxisCategories(cats, -35), tooltip: { enabled: false } },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          style: { colors: APEX.axis, fontSize: '11px' },
          formatter: (v: number) => `${formatAnalyticsInteger(v)}%`,
        },
      },
      tooltip: {
        intersect: false,
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const i = dataPointIndex;
          if (i < 0 || !data[i]) return '';
          const row = data[i]!;
          const pctLabel = formatAnalyticsRatioAsPercent(row.conversionRate ?? null, 1);
          const inner = `<p style="margin:0">Conversion rate: ${pctLabel}</p><p style="margin:6px 0 0;font-size:11px;color:#64748b">Conversations: ${formatAnalyticsInteger(row.conversations)} · Leads captured: ${formatAnalyticsInteger(row.leads)}</p>`;
          return `<div style="padding:10px 12px;background:#fff;border:1px solid ${CHART.tooltipBorder};border-radius:8px;box-shadow:${CHART.tooltipShadow};font-size:12px"><p style="margin:0 0 6px;font-weight:600;color:#334155">${row.label.replace(/</g, '&lt;')}</p>${inner}</div>`;
        },
      },
    };
    return { series: ser, options: opts };
  }, [points, granularity]);

  const hasLine = points.some((d) => (d.conversations ?? 0) > 0);

  if (!hasLine) {
    return <AnalyticsChartEmpty message="No conversion data for this range." className="h-[200px]" />;
  }

  return (
    <div className="min-h-[240px] w-full">
      <ApexChartLoader options={options} series={series} type="line" height={260} width="100%" />
    </div>
  );
}
