import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerLeadsStartedFromBreakdownItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsRatioAsPercent } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { APEX } from '../shared/apexAnalyticsTheme';
import { ApexChartLoader } from '../shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '../shared/apexTooltip';
import { apexChartBase, apexGrid, apexLegendBottom } from '../shared/apexChartUtils';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

type Row = { name: string; conversations: number; leads: number; conversionRate: number | null };

type Props = { rows: CustomerLeadsStartedFromBreakdownItem[] };

export function LeadsStartedFromChart({ rows }: Props) {
  const { series, options } = useMemo(() => {
    const data: Row[] = rows.map((r) => ({
      name: r.label,
      conversations: r.conversations,
      leads: r.leads,
      conversionRate: r.conversionRate,
    }));
    const cats = data.map((d) => d.name);
    const ser: ApexOptions['series'] = [
      { name: 'Conversations', data: data.map((d) => d.conversations) },
      { name: 'Leads captured', data: data.map((d) => d.leads) },
    ];
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'bar' },
      colors: [CHART.slate400, CHART.teal600],
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
      dataLabels: { enabled: false },
      grid: apexGrid(),
      legend: apexLegendBottom(),
      xaxis: {
        categories: cats,
        labels: { rotate: -12, rotateAlways: true, style: { colors: APEX.axis, fontSize: '10px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
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
          const cr = formatAnalyticsRatioAsPercent(row.conversionRate, 1);
          const body =
            apexTooltipRow('Conversations', formatAnalyticsInteger(row.conversations)) +
            apexTooltipRow('Leads captured', formatAnalyticsInteger(row.leads)) +
            apexTooltipRow('Conversion rate', cr);
          return apexTooltipShell(row.name, body);
        },
      },
    };
    return { series: ser, options: opts };
  }, [rows]);

  const hasData = rows.some((d) => d.conversations > 0 || d.leads > 0);
  if (!hasData) {
    return <AnalyticsChartEmpty message="No source breakdown for this range." className="h-[220px]" />;
  }

  return (
    <div className="min-h-[260px] w-full">
      <ApexChartLoader options={options} series={series} type="bar" height={280} width="100%" />
    </div>
  );
}
