import type { ApexOptions } from 'apexcharts';
import { useMemo } from 'react';
import type { CustomerChatsAnalyticsGranularity, CustomerSentimentAnalyticsTimeSeriesPoint } from '@/api/types';
import { formatAnalyticsDateLabel, formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { CHART } from '../shared/analyticsChartTheme';
import { APEX } from '../shared/apexAnalyticsTheme';
import { ApexChartLoader } from '../shared/ApexChartLoader';
import { apexTooltipRow, apexTooltipShell } from '../shared/apexTooltip';
import { apexChartBase, apexXAxisCategories } from '../shared/apexChartUtils';
import { AnalyticsChartEmpty } from '../shared/AnalyticsChartEmpty';
import { SENTIMENT_CHART_COLORS } from './sentimentChartTheme';
import { SENTIMENT_CHART_SERIES_ORDER } from './sentimentTrendsChartHelpers';

const LABEL: Record<string, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  mixed: 'Mixed',
  unknown: 'Unknown',
};

/** Human-readable count line for stacked sentiment tooltips (tested). */
export function formatSentimentOverTimeTooltipCount(
  count: number,
  unit: 'messages' | 'chats' = 'messages',
): string {
  const n = formatAnalyticsInteger(count);
  return unit === 'chats' ? `${n} distinct chats` : `${n} user messages`;
}

type Props = {
  points: CustomerSentimentAnalyticsTimeSeriesPoint[];
  granularity: CustomerChatsAnalyticsGranularity;
  /** Series ids to omit from the stack (e.g. toggled off in the ranking sidebar). */
  hiddenSeriesIds?: string[];
  /** Tooltip wording for stacked bar counts. */
  countUnit?: 'messages' | 'chats';
};

function apexGridSoft(): ApexOptions['grid'] {
  return {
    borderColor: APEX.grid,
    strokeDashArray: 3,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { left: 2, right: 10, top: 4, bottom: 0 },
  };
}

export function SentimentOverTimeChart({
  points,
  granularity,
  hiddenSeriesIds = [],
  countUnit = 'messages',
}: Props) {
  const chartPayload = useMemo(() => {
    const visibleIds = SENTIMENT_CHART_SERIES_ORDER.filter((id) => !hiddenSeriesIds.includes(id));
    if (!visibleIds.length) return null;
    const cats = points.map((p) => formatAnalyticsDateLabel(p.date, granularity));
    const ser: ApexOptions['series'] = visibleIds.map((id) => ({
      name: LABEL[id] ?? id,
      data: points.map((p) => Math.max(0, Math.trunc(Number((p as Record<string, unknown>)[id] ?? 0)))),
    }));
    const colors = visibleIds.map(
      (id) => SENTIMENT_CHART_COLORS[id as keyof typeof SENTIMENT_CHART_COLORS] ?? CHART.slate400,
    );

    const opts: ApexOptions = {
      ...apexChartBase(),
      chart: {
        ...apexChartBase().chart,
        type: 'bar',
        stacked: true,
        stackType: 'normal',
        animations: { enabled: true, speed: 520 },
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
      },
      colors,
      plotOptions: {
        bar: {
          columnWidth: '56%',
          borderRadius: 5,
          borderRadiusApplication: 'end',
          borderRadiusWhenStacked: 'last',
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: { enabled: false },
      grid: apexGridSoft(),
      legend: { show: false },
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
        theme: 'light',
        style: { fontSize: '12px' },
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
            const friendlyName = seriesNames[si] ?? 'Series';
            rows.push(apexTooltipRow(friendlyName, formatSentimentOverTimeTooltipCount(v, countUnit)));
          }
          return apexTooltipShell(cat, rows.join(''));
        },
      },
    };
    return { series: ser, options: opts };
  }, [points, granularity, hiddenSeriesIds, countUnit]);

  const hasData =
    chartPayload != null &&
    points.some((p) => {
      let sum = 0;
      for (const id of SENTIMENT_CHART_SERIES_ORDER) {
        if (hiddenSeriesIds.includes(id)) continue;
        sum += Math.max(0, Math.trunc(Number((p as Record<string, unknown>)[id] ?? 0)));
      }
      return sum > 0;
    });

  if (!points.length) {
    return <AnalyticsChartEmpty message="No time-series data for this range." className="h-full min-h-[12rem] w-full flex-1" />;
  }
  if (!chartPayload) {
    return (
      <AnalyticsChartEmpty
        message="Select at least one series to display."
        className="h-full min-h-[12rem] w-full flex-1"
      />
    );
  }
  if (!hasData) {
    return <AnalyticsChartEmpty message="No sentiment activity in this range." className="h-full min-h-[12rem] w-full flex-1" />;
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col transition-opacity duration-300 ease-out">
      <div className="min-h-[12rem] w-full min-w-0 flex-1">
        <ApexChartLoader
          options={chartPayload.options}
          series={chartPayload.series}
          type="bar"
          height={360}
          width="100%"
        />
      </div>
    </div>
  );
}
