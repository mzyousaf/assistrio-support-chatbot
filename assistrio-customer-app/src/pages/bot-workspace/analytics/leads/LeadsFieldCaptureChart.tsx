import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerLeadsFieldCaptureItem } from '@/api/types';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { APEX } from '../shared/apexAnalyticsTheme';
import { ApexChartLoader } from '../shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '../shared/apexTooltip';
import { apexChartBase, apexGrid } from '../shared/apexChartUtils';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';

type Row = { label: string; fieldKey: string; type: string; capturedCount: number };

type Props = { rows: CustomerLeadsFieldCaptureItem[] };

export function LeadsFieldCaptureChart({ rows }: Props) {
  const { series, options, height } = useMemo(() => {
    const data: Row[] = [...rows]
      .filter((r) => (r.capturedCount ?? 0) > 0)
      .slice(0, 24)
      .map((r) => ({
        label: r.label.length > 28 ? `${r.label.slice(0, 26)}…` : r.label,
        fieldKey: r.fieldKey,
        type: r.type,
        capturedCount: r.capturedCount,
      }));
    const cats = data.map((d) => d.label);
    const ser: ApexOptions['series'] = [{ name: 'Captures', data: data.map((d) => d.capturedCount) }];
    const h = Math.min(420, 120 + data.length * 22);
    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: { ...apexChartBase().chart, type: 'bar' },
      colors: [CHART.teal600],
      plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '75%' } },
      dataLabels: { enabled: false },
      grid: { ...apexGrid(), yaxis: { lines: { show: false } } },
      xaxis: { categories: cats, labels: { style: { colors: APEX.axis, fontSize: '10px' } } },
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
          const typeLabel = row.type ? row.type.replace(/_/g, ' ') : '—';
          const body =
            apexTooltipRow('Field key', row.fieldKey) +
            apexTooltipRow('Type', typeLabel) +
            apexTooltipRow('Captures', formatAnalyticsInteger(row.capturedCount));
          return apexTooltipShell(row.label, body);
        },
      },
    };
    return { series: ser, options: opts, height: h };
  }, [rows]);

  if (!rows.some((r) => (r.capturedCount ?? 0) > 0)) {
    return <AnalyticsChartEmpty message="No field captures in this range." className="h-[200px]" />;
  }

  return (
    <div className="w-full" style={{ minHeight: height }}>
      <ApexChartLoader options={options} series={series} type="bar" height={height} width="100%" />
    </div>
  );
}
