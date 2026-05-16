import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CustomerLeadsTimeSeriesPoint } from '@/api/types';
import { CHART } from '../shared/analyticsChartTheme';
import {
  LEADS_OVER_TIME_LINE_COLORS,
  LEADS_OVER_TIME_MAIN_SERIES_KEYS,
  LEADS_OVER_TIME_SERIES,
  LeadsOverTimeTrendChart,
  LeadsOverTimeTrendTooltipContent,
  buildLeadsOverTimeChartRows,
} from './LeadsOverTimeTrendChart';
import {
  LeadsConversionRateChart,
  buildLeadsConversionChartRows,
  leadsConversionPercentForChart,
} from './LeadsConversionRateChart';

describe('buildLeadsOverTimeChartRows', () => {
  it('maps API points into chart rows with tooltip fields including conversations', () => {
    const points: CustomerLeadsTimeSeriesPoint[] = [
      {
        date: '2026-01-15',
        conversations: 100,
        leads: 12,
        completeLeads: 7,
        partialLeads: 5,
        conversionRate: 0.12,
        leadCompletionRate: 7 / 12,
      },
    ];
    const rows = buildLeadsOverTimeChartRows(points, 'day');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.conversations).toBe(100);
    expect(rows[0]?.leads).toBe(12);
    expect(rows[0]?.xLabel).toBeTruthy();
  });

  it('parses legacy API points that omit optional lead-split fields', () => {
    const legacy = [
      {
        date: '2026-01-15',
        conversations: 5,
        leads: 2,
        conversionRate: 0.4,
        leadCompletionRate: null,
      },
    ] as unknown as CustomerLeadsTimeSeriesPoint[];
    const rows = buildLeadsOverTimeChartRows(legacy, 'day');
    expect(rows[0]?.conversations).toBe(5);
    expect(rows[0]?.leads).toBe(2);
  });
});

describe('Leads over time chart series', () => {
  it('exposes Conversations and Leads as the main line series keys', () => {
    expect([...LEADS_OVER_TIME_MAIN_SERIES_KEYS]).toEqual(['conversations', 'leads']);
  });

  it('uses indigo for conversations line and teal for qualified leads line', () => {
    expect(LEADS_OVER_TIME_LINE_COLORS.conversations).toBe('#6366f1');
    expect(LEADS_OVER_TIME_LINE_COLORS.leads).toBe(CHART.teal600);
  });

  it('series labels match stacked chart legend copy', () => {
    expect(LEADS_OVER_TIME_SERIES[0]?.label).toBe('Conversations');
    expect(LEADS_OVER_TIME_SERIES[1]?.label).toBe('Qualified leads');
  });
});

describe('LeadsOverTimeTrendTooltipContent', () => {
  it('matches chats-style tooltip: period title plus metric rows', () => {
    const row = buildLeadsOverTimeChartRows(
      [
        {
          date: '2026-01-15',
          conversations: 40,
          leads: 10,
          completeLeads: 6,
          partialLeads: 4,
          conversionRate: 0.25,
          leadCompletionRate: 0.6,
        },
      ],
      'day',
    )[0]!;
    const html = renderToStaticMarkup(
      <LeadsOverTimeTrendTooltipContent label={row.xLabel} payload={[{ payload: row }]} />,
    );
    expect(html).toContain(row.xLabel);
    expect(html).toContain('Conversations');
    expect(html).toContain('Qualified leads');
    expect(html).not.toContain('Complete leads');
    expect(html).not.toContain('Conversion rate');
  });
});

describe('leadsConversionPercentForChart', () => {
  it('maps ratio 1 to 100 and ratio 0 to 0', () => {
    expect(
      leadsConversionPercentForChart({
        date: 'd',
        conversations: 8,
        leads: 8,
        completeLeads: 5,
        partialLeads: 3,
        conversionRate: 1,
        leadCompletionRate: 1,
      }),
    ).toBe(100);
    expect(
      leadsConversionPercentForChart({
        date: 'd',
        conversations: 8,
        leads: 0,
        completeLeads: 0,
        partialLeads: 0,
        conversionRate: 0,
        leadCompletionRate: null,
      }),
    ).toBe(0);
  });

  it('derives percent when conversionRate is null but conversations > 0', () => {
    expect(
      leadsConversionPercentForChart({
        date: 'd',
        conversations: 10,
        leads: 5,
        completeLeads: 2,
        partialLeads: 3,
        conversionRate: null,
        leadCompletionRate: null,
      }),
    ).toBeCloseTo(50);
  });

  it('returns null when conversations are zero', () => {
    expect(
      leadsConversionPercentForChart({
        date: 'd',
        conversations: 0,
        leads: 0,
        completeLeads: 0,
        partialLeads: 0,
        conversionRate: null,
        leadCompletionRate: null,
      }),
    ).toBeNull();
  });

  it('keeps a numeric point after a prior bucket at 100%', () => {
    const pts: CustomerLeadsTimeSeriesPoint[] = [
      {
        date: '2026-01-01',
        conversations: 10,
        leads: 10,
        completeLeads: 8,
        partialLeads: 2,
        conversionRate: 1,
        leadCompletionRate: 0.8,
      },
      {
        date: '2026-01-02',
        conversations: 20,
        leads: 10,
        completeLeads: 6,
        partialLeads: 4,
        conversionRate: 0.5,
        leadCompletionRate: 0.6,
      },
    ];
    const percents = pts.map(leadsConversionPercentForChart);
    expect(percents[0]).toBe(100);
    expect(percents[1]).toBe(50);
    expect(percents.every((p) => p == null || Number.isFinite(p))).toBe(true);
  });
});

describe('buildLeadsConversionChartRows', () => {
  it('converts ratio to percent and preserves denominator counts', () => {
    const points: CustomerLeadsTimeSeriesPoint[] = [
      {
        date: '2026-01-15',
        conversations: 50,
        leads: 10,
        completeLeads: 6,
        partialLeads: 4,
        conversionRate: 0.2,
        leadCompletionRate: 0.6,
      },
    ];
    const rows = buildLeadsConversionChartRows(points, 'day');
    expect(rows[0]?.conversionPercent).toBeCloseTo(20);
    expect(rows[0]?.conversations).toBe(50);
    expect(rows[0]?.leads).toBe(10);
  });

  it('uses null percent when conversations are zero', () => {
    const points: CustomerLeadsTimeSeriesPoint[] = [
      {
        date: '2026-01-15',
        conversations: 0,
        leads: 0,
        completeLeads: 0,
        partialLeads: 0,
        conversionRate: null,
        leadCompletionRate: null,
      },
    ];
    const rows = buildLeadsConversionChartRows(points, 'day');
    expect(rows[0]?.conversionPercent).toBeNull();
  });
});

describe('LeadsOverTimeTrendChart empty state', () => {
  it('does not crash when there are no points', () => {
    const html = renderToStaticMarkup(
      <LeadsOverTimeTrendChart points={[]} granularity="day" hiddenSeriesIds={[]} />,
    );
    expect(html).toContain('No time-series data');
  });

  it('shows empty copy when points exist but counts are all zero', () => {
    const html = renderToStaticMarkup(
      <LeadsOverTimeTrendChart
        points={[
          {
            date: '2026-01-15',
            conversations: 0,
            leads: 0,
            completeLeads: 0,
            partialLeads: 0,
            conversionRate: 0,
            leadCompletionRate: null,
          },
        ]}
        granularity="day"
        hiddenSeriesIds={[]}
      />,
    );
    expect(html).toContain('No leads activity');
  });

  it('prompts when every series is hidden', () => {
    const pts: CustomerLeadsTimeSeriesPoint[] = [
      {
        date: '2026-01-15',
        conversations: 5,
        leads: 2,
        completeLeads: 1,
        partialLeads: 1,
        conversionRate: 0.4,
        leadCompletionRate: 0.5,
      },
    ];
    const html = renderToStaticMarkup(
      <LeadsOverTimeTrendChart points={pts} granularity="day" hiddenSeriesIds={['conversations', 'leads']} />,
    );
    expect(html).toContain('Show at least one series');
  });

  it('mounts chart container when points exist (responsive size deferred without layout)', () => {
    const pts: CustomerLeadsTimeSeriesPoint[] = [
      {
        date: '2026-01-15',
        conversations: 5,
        leads: 2,
        completeLeads: 1,
        partialLeads: 1,
        conversionRate: 0.4,
        leadCompletionRate: 0.5,
      },
    ];
    const html = renderToStaticMarkup(
      <LeadsOverTimeTrendChart points={pts} granularity="day" hiddenSeriesIds={[]} />,
    );
    expect(html).toContain('recharts-responsive-container');
    expect(html).not.toContain('No time-series data');
  });
});

describe('LeadsConversionRateChart empty state', () => {
  it('does not crash when there are no points', () => {
    const html = renderToStaticMarkup(<LeadsConversionRateChart points={[]} granularity="day" />);
    expect(html).toContain('No time-series data');
  });
});
