import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerKnowledgeSourceTypeBreakdownItem } from '@/api/types';
import { formatAnalyticsInteger, formatAnalyticsScore } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { APEX } from '../shared/apexAnalyticsTheme';
import { ApexChartLoader } from '../shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '../shared/apexTooltip';
import { apexChartBase, apexGrid } from '../shared/apexChartUtils';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

type Props = { rows: CustomerKnowledgeSourceTypeBreakdownItem[] };

type Row = {
  label: string;
  sourceUses: number;
  uniqueSources: number;
  assistantMessages: number;
  averageScore: number | null;
};

export function SourceTypeBreakdownChart({ rows }: Props) {
  const { series, options } = useMemo(() => {
    const data: Row[] = rows
      .filter((r) => (r.sourceUses ?? 0) > 0)
      .map((r) => ({
        label: r.label,
        sourceUses: r.sourceUses,
        uniqueSources: r.uniqueSources,
        assistantMessages: r.assistantMessages,
        averageScore: r.averageScore,
      }));
    const cats = data.map((d) => d.label);
    const ser: ApexOptions['series'] = [{ name: 'Source uses', data: data.map((d) => d.sourceUses) }];

    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'bar' },
      colors: [CHART.teal600],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '70%' } },
      dataLabels: { enabled: false },
      grid: { ...apexGrid(), yaxis: { lines: { show: false } } },
      xaxis: {
        categories: cats,
        labels: { style: { colors: APEX.axis, fontSize: '11px' } },
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
          const r = data[i]!;
          const body =
            apexTooltipRow('Source uses', formatAnalyticsInteger(r.sourceUses)) +
            apexTooltipRow('Unique sources', formatAnalyticsInteger(r.uniqueSources)) +
            apexTooltipRow('Assistant messages', formatAnalyticsInteger(r.assistantMessages)) +
            apexTooltipRow('Average match score', formatAnalyticsScore(r.averageScore));
          return apexTooltipShell(r.label, body);
        },
      },
    };
    return { series: ser, options: opts };
  }, [rows]);

  const filtered = rows.filter((r) => (r.sourceUses ?? 0) > 0);
  if (!filtered.length) {
    return <AnalyticsChartEmpty message="No source types in this range." className="h-[220px]" />;
  }

  return (
    <div className="min-h-[260px] w-full">
      <ApexChartLoader options={options} series={series} type="bar" height={280} width="100%" />
    </div>
  );
}
