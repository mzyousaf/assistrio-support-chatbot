import { describe, expect, it } from 'vitest';
import type { CustomerLeadsStartedFromBreakdownItem } from '@/api/types';
import {
  displayLabelForLeadsSourceKey,
  normalizeLeadsStartedFromBreakdown,
  topLeadSourceLabel,
} from './leadsAnalyticsDisplay';

function row(
  key: CustomerLeadsStartedFromBreakdownItem['key'],
  overrides: Partial<CustomerLeadsStartedFromBreakdownItem> = {},
): CustomerLeadsStartedFromBreakdownItem {
  return {
    key,
    label: 'API label',
    conversations: 0,
    leads: 0,
    conversionRate: null,
    ...overrides,
  };
}

describe('leadsAnalyticsDisplay', () => {
  it('maps keys to friendly labels', () => {
    expect(displayLabelForLeadsSourceKey('runtime_widget')).toBe('Runtime Widget');
    expect(displayLabelForLeadsSourceKey('runtime_iframe')).toBe('Runtime IFrame');
    expect(displayLabelForLeadsSourceKey('shared_preview')).toBe('Shared Preview');
    expect(displayLabelForLeadsSourceKey('playground_preview')).toBe('Playground Preview');
    expect(displayLabelForLeadsSourceKey('unknown')).toBe('Unknown');
  });

  it('normalizes breakdown with zeros for missing keys', () => {
    const normalized = normalizeLeadsStartedFromBreakdown([
      row('runtime_widget', { conversations: 10, leads: 4, conversionRate: 0.4 }),
    ]);
    expect(normalized).toHaveLength(5);
    const rw = normalized.find((r) => r.key === 'runtime_widget');
    expect(rw?.label).toBe('Runtime Widget');
    expect(rw?.conversations).toBe(10);
    expect(rw?.leads).toBe(4);
    const iframe = normalized.find((r) => r.key === 'runtime_iframe');
    expect(iframe?.leads).toBe(0);
  });

  it('topLeadSourceLabel picks highest leads by friendly label', () => {
    expect(
      topLeadSourceLabel([
        row('shared_preview', { leads: 2 }),
        row('runtime_widget', { leads: 10 }),
        row('playground_preview', { leads: 10 }),
      ]),
    ).toBe('Playground Preview');
    expect(topLeadSourceLabel([])).toBe('—');
    expect(topLeadSourceLabel([row('runtime_widget', { leads: 0 })])).toBe('—');
  });
});
