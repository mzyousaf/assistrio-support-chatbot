import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CustomerLeadsStartedFromBreakdownItem, CustomerLeadsFieldCaptureItem } from '@/api/types';
import { buildFieldCaptureChartRows, FieldTooltip, LeadsFieldCaptureChart } from './LeadsFieldCaptureChart';
import { LeadsLocationPanel } from './LeadsLocationPanel';
import { buildLeadsSourceChartRows } from './LeadsSourceChart';
import { LeadsSummaryCards } from './LeadsSummaryCards';
import { LeadsWidgetSourceChart } from './LeadsWidgetSourceChart';

describe('LeadsSummaryCards', () => {
  it('renders conversion, complete, and partial KPI tiles', () => {
    const html = renderToStaticMarkup(
      <LeadsSummaryCards
        summary={{
          totalConversations: 40,
          totalLeads: 8,
          completeLeads: 5,
          partialLeads: 3,
          leadCompletionRate: 5 / 8,
          conversionRate: 0.2,
          totalCapturedFields: 24,
          averageFieldsPerLead: 3,
        }}
        timeSeries={[
          {
            date: '2026-01-01',
            conversations: 10,
            leads: 2,
            completeLeads: 1,
            partialLeads: 1,
            conversionRate: 0.2,
            leadCompletionRate: 0.5,
          },
        ]}
        granularity="day"
      />,
    );
    expect(html).toContain('Conversion rate');
    expect(html).toContain('Complete leads');
    expect(html).toContain('Partial leads');
    expect(html).not.toContain('Total leads');
    expect(html).not.toContain('Avg fields captured');
    expect(html).not.toContain('Top lead source');
    expect(html.match(/Conversion rate/g)?.length).toBe(1);
  });
});

describe('LeadsWidgetSourceChart', () => {
  it('omits sidebar rows when that source has zero leads', () => {
    const html = renderToStaticMarkup(
      <LeadsWidgetSourceChart
        rows={[
          {
            key: 'runtime_widget',
            label: 'Runtime Widget',
            conversations: 10,
            leads: 0,
            conversionRate: 0,
          },
          {
            key: 'runtime_iframe',
            label: 'Runtime IFrame',
            conversations: 2,
            leads: 3,
            conversionRate: 0.5,
          },
        ]}
      />,
    );
    expect(html).not.toContain('Runtime Widget');
    expect(html).toContain('Runtime IFrame');
  });
});

describe('LeadsSourceChart rows', () => {
  it('uses friendly labels from keys for chart data', () => {
    const rows: CustomerLeadsStartedFromBreakdownItem[] = [
      { key: 'runtime_iframe', label: 'x', conversations: 5, leads: 2, conversionRate: 0.4 },
    ];
    const chartRows = buildLeadsSourceChartRows(rows);
    expect(chartRows[0]?.label).toBe('Runtime IFrame');
  });
});

describe('LeadsFieldCaptureChart', () => {
  it('orders dynamic field rows by capturedCount descending', () => {
    const rows: CustomerLeadsFieldCaptureItem[] = [
      { fieldKey: 'a', label: 'Low', type: 'text', capturedCount: 1 },
      { fieldKey: 'b', label: 'High', type: 'email', capturedCount: 9 },
    ];
    const chartRows = buildFieldCaptureChartRows(rows);
    expect(chartRows.map((r) => r.label)).toEqual(['High', 'Low']);
  });

  it('filters chart rows by field status when requested', () => {
    const rows: CustomerLeadsFieldCaptureItem[] = [
      { fieldKey: 'a', label: 'Only Active', type: 'text', capturedCount: 5, fieldStatus: 'active' },
      { fieldKey: 'b', label: 'Deleted row', type: 'text', capturedCount: 3, fieldStatus: 'deleted' },
    ];
    expect(buildFieldCaptureChartRows(rows, '').map((r) => r.fieldKey)).toEqual(['a', 'b']);
    expect(buildFieldCaptureChartRows(rows, 'active').map((r) => r.fieldKey)).toEqual(['a']);
    expect(buildFieldCaptureChartRows(rows, 'deleted').map((r) => r.fieldKey)).toEqual(['b']);
  });

  it('shows empty copy when no captures', () => {
    const html = renderToStaticMarkup(
      <LeadsFieldCaptureChart rows={[{ fieldKey: 'e', label: 'Email', type: 'email', capturedCount: 0 }]} />,
    );
    expect(html).toContain('No captured fields yet.');
  });

  it('maps explicit fieldStatus onto chart rows', () => {
    const rows: CustomerLeadsFieldCaptureItem[] = [
      { fieldKey: 'legacy_co', label: 'Legacy Co', type: 'text', capturedCount: 4, fieldStatus: 'deleted' },
    ];
    const chartRows = buildFieldCaptureChartRows(rows);
    expect(chartRows[0]?.fieldStatus).toBe('deleted');
  });

  it('infers deleted when only legacy archived is present', () => {
    const rows: CustomerLeadsFieldCaptureItem[] = [
      { fieldKey: 'legacy_co', label: 'Legacy Co', type: 'text', capturedCount: 4, archived: true },
    ];
    expect(buildFieldCaptureChartRows(rows)[0]?.fieldStatus).toBe('deleted');
  });

  it('field tooltip shows Status: Inactive without archived wording', () => {
    const html = renderToStaticMarkup(
      <FieldTooltip
        active
        payload={[
          {
            payload: {
              label: 'Budget',
              fieldKey: 'budget',
              type: 'text',
              capturedCount: 2,
              fieldStatus: 'inactive',
            },
          },
        ]}
      />,
    );
    expect(html).toContain('Status');
    expect(html).toContain('Inactive');
    expect(html.toLowerCase()).not.toContain('archived');
  });

  it('chart rendering avoids archived wording', () => {
    const html = renderToStaticMarkup(
      <LeadsFieldCaptureChart
        rows={[
          { fieldKey: 'a', label: 'Alpha', type: 'text', capturedCount: 5, fieldStatus: 'active' },
          { fieldKey: 'b', label: 'Beta', type: 'text', capturedCount: 3, fieldStatus: 'deleted' },
        ]}
      />,
    );
    expect(html.toLowerCase()).not.toContain('archived');
  });
});

describe('LeadsLocationPanel', () => {
  it('does not expose raw geo identifiers beyond aggregates', () => {
    const html = renderToStaticMarkup(
      <LeadsLocationPanel
        countries={[{ country: 'Canada', countryCode: 'CA', leads: 3, conversations: 10 }]}
        cities={[{ city: 'Toronto', countryCode: 'CA', leads: 2, conversations: 5 }]}
      />,
    );
    expect(html.toLowerCase()).not.toContain('iphash');
    expect(html.toLowerCase()).not.toContain('ip_hash');
    expect(html.toLowerCase()).not.toContain('coordinates');
    expect(html).toContain('Leads by country');
  });
});
