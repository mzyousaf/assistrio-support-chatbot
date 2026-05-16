import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerUsageTypeBreakdownItem } from '@/api/types';
import { formatAnalyticsCreditsWithUnit, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '@/pages/bot-workspace/analytics/shared/analyticsChartTheme';
import { APEX } from '@/pages/bot-workspace/analytics/shared/apexAnalyticsTheme';
import { ApexChartLoader } from '@/pages/bot-workspace/analytics/shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '@/pages/bot-workspace/analytics/shared/apexTooltip';
import { apexChartBase, apexGrid } from '@/pages/bot-workspace/analytics/shared/apexChartUtils';
import { AnalyticsChartEmpty } from '@/pages/bot-workspace/analytics/shared/AnalyticsChartEmpty';

type Props = { rows: CustomerUsageTypeBreakdownItem[] };

type Row = { name: string; events: number; creditsUsed: number };

export function UsageTypeBreakdownChart({ rows }: Props) {
  const { series, options } = useMemo(() => {
    const data: Row[] = rows
      .filter((r) => (r.events ?? 0) > 0 || (r.creditsUsed ?? 0) > 0)
      .map((r) => ({
        name: r.label || r.usageType,
        events: r.events,
        creditsUsed: r.creditsUsed,
      }));
    const cats = data.map((d) => d.name);
    const ser: ApexOptions['series'] = [{ name: 'Events', data: data.map((d) => d.events) }];
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'bar' },
      colors: [CHART.teal600],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
      dataLabels: { enabled: false },
      grid: { ...apexGrid(), yaxis: { lines: { show: false } } },
      xaxis: { categories: cats, labels: { style: { colors: APEX.axis, fontSize: '11px' } } },
      yaxis: {
        labels: {
          style: { colors: APEX.axis, fontSize: '11px' },
          formatter: (v: number) => formatAnalyticsInteger(v),
        },
      },
      tooltip: {
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const i = dataPointIndex;
          if (i < 0 || !data[i]) return '';
          const row = data[i]!;
          const body =
            apexTooltipRow('Events', formatAnalyticsInteger(row.events)) +
            apexTooltipRow('Credits', formatAnalyticsCreditsWithUnit(row.creditsUsed));
          return apexTooltipShell(row.name, body);
        },
      },
    };
    return { series: ser, options: opts };
  }, [rows]);

  const hasData = rows.some((r) => (r.events ?? 0) > 0 || (r.creditsUsed ?? 0) > 0);
  if (!hasData) {
    return <AnalyticsChartEmpty message="No usage-type breakdown for this range." className="h-[240px]" />;
  }

  return (
    <div className="min-h-[260px] w-full">
      <ApexChartLoader options={options} series={series} type="bar" height={280} width="100%" />
    </div>
  );
}
