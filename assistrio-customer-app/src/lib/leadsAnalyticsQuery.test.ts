import { describe, expect, it } from 'vitest';
import {
  LEADS_ANALYTICS_DEFAULTS,
  buildLeadsAnalyticsApiParams,
  leadsAnalyticsQueryIncludesPreviewFlag,
} from './leadsAnalyticsQuery';

describe('buildLeadsAnalyticsApiParams', () => {
  it('maps startedFrom and country', () => {
    const p = buildLeadsAnalyticsApiParams({
      ...LEADS_ANALYTICS_DEFAULTS,
      startedFrom: 'runtime_widget',
      countryCode: 'gb',
    });
    expect(p.startedFrom).toBe('runtime_widget');
    expect(p.countryCode).toBe('GB');
  });

  it('includePreview false flag helper', () => {
    const p = buildLeadsAnalyticsApiParams({ ...LEADS_ANALYTICS_DEFAULTS, includePreview: false });
    expect(leadsAnalyticsQueryIncludesPreviewFlag(p)).toBe(true);
  });
});
