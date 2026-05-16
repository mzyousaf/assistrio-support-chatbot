import { describe, expect, it } from 'vitest';
import { formatAnalyticsCredits } from '@/lib/analyticsFormat';
import { USAGE_DASHBOARD_COPY } from './usageDashboardCopy';

describe('usageDashboardCopy', () => {
  it('does not include quota / enforcement style wording', () => {
    const banned = [
      /\bquota\b/i,
      /\bremaining\b/i,
      /\bupgrade\b/i,
      /\bsubscription\b/i,
      /\bmonthly limit\b/i,
      /\blimit reached\b/i,
      /\bprogress bar\b/i,
    ];
    const strings = Object.values(USAGE_DASHBOARD_COPY) as string[];
    for (const s of strings) {
      for (const re of banned) {
        expect(s).not.toMatch(re);
      }
    }
  });
});

describe('usage credits display', () => {
  it('formatAnalyticsCredits preserves decimals when needed', () => {
    expect(formatAnalyticsCredits(1.25)).toBe('1.25');
    expect(formatAnalyticsCredits(3)).toBe('3');
  });
});
