import { describe, expect, it } from 'vitest';
import {
  USAGE_ANALYTICS_DEFAULTS,
  buildUsageAnalyticsApiParams,
} from './usageAnalyticsQuery';

describe('usageAnalyticsQuery', () => {
  it('buildUsageAnalyticsApiParams maps state to API params', () => {
    const p = buildUsageAnalyticsApiParams({
      ...USAGE_ANALYTICS_DEFAULTS,
      preset: '7d',
      includePreview: false,
      usageTypeFilter: 'voice_message',
    });
    expect(p.granularity).toBe('day');
    expect(p.includePreview).toBe(false);
    expect(p.usageType).toBe('voice_message');
    expect(p.from && p.to).toBeTruthy();
  });

  it('uses week granularity for 90-day preset', () => {
    const p = buildUsageAnalyticsApiParams({
      ...USAGE_ANALYTICS_DEFAULTS,
      preset: '90d',
    });
    expect(p.granularity).toBe('week');
  });

  it('omits usageType when filter empty', () => {
    const p = buildUsageAnalyticsApiParams({
      ...USAGE_ANALYTICS_DEFAULTS,
      usageTypeFilter: '',
    });
    expect(p.usageType).toBeUndefined();
  });
});
