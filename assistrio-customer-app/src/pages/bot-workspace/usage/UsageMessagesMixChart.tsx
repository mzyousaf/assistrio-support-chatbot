import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerChatsAnalyticsGranularity, CustomerUsageTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
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

export function UsageMessagesMixChart({ timeSeries, granularity }: Props) {
  const { series, options } = useMemo(() => {
    const cats = timeSeries.map((t) => formatAnalyticsDateLabel(t.date, granularity));
    const ser: ApexOptions['series'] = [
      { name: 'Text', data: timeSeries.map((t) => t.textMessages ?? 0) },
      { name: 'Voice', data: timeSeries.map((t) => t.voiceMessages ?? 0) },
      { name: 'Dictation', data: timeSeries.map((t) => t.dictationMessages ?? 0) },
      { name: 'Attachment', data: timeSeries.map((t) => t.attachmentMessages ?? 0) },
      { name: 'Suggested Q', data: timeSeries.map((t) => t.suggestedQuestionMessages ?? 0) },
    ];
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'bar', stacked: true },
      colors: [CHART.teal600, CHART.teal700, CHART.indigo400, CHART.slate400, CHART.amber500],
      plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
      dataLabels: { enabled: false },
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
            if (!Number.isFinite(v) || v <= 0) continue;
            rows.push(apexTooltipRow(seriesNames[si] ?? '', formatAnalyticsInteger(v)));
          }
          return apexTooltipShell(cat, rows.join(''));
        },
      },
    };
    return { series: ser, options: opts };
  }, [timeSeries, granularity]);

  const hasMessages = timeSeries.some(
    (d) =>
      (d.textMessages ?? 0) > 0 ||
      (d.voiceMessages ?? 0) > 0 ||
      (d.dictationMessages ?? 0) > 0 ||
      (d.attachmentMessages ?? 0) > 0 ||
      (d.suggestedQuestionMessages ?? 0) > 0,
  );

  if (!timeSeries.length) {
    return <AnalyticsChartEmpty message="No time-series data for this range." className="h-[280px]" />;
  }
  if (!hasMessages) {
    return <AnalyticsChartEmpty message="No message mix for this range." className="h-[280px]" />;
  }

  return (
    <div className="min-h-[280px] w-full">
      <ApexChartLoader options={options} series={series} type="bar" height={300} width="100%" />
    </div>
  );
}
