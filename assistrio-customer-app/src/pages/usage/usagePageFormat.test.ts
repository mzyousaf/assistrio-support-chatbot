import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import {
  buildAiCreditsTrendPoints,
  buildBotNameLookup,
  formatCreditsSharePercent,
  formatPlanChipLabel,
  formatSubscriptionStatusLabel,
  formatUsagePeriodDate,
  hasAiCreditUsage,
} from './usagePageFormat';

describe('usagePageFormat', () => {
  it('formats subscription status labels', () => {
    expect(formatSubscriptionStatusLabel('free')).toBe('Free trial');
    expect(formatSubscriptionStatusLabel('trialing')).toBe('Free trial');
    expect(formatSubscriptionStatusLabel('active')).toBe('Active');
  });

  it('formats plan chip labels', () => {
    expect(formatPlanChipLabel('Free')).toBe('Free plan');
    expect(formatPlanChipLabel('Pro plan')).toBe('Pro plan');
  });

  it('builds bot name lookup from trained knowledge rows', () => {
    const summary = {
      usage: {
        trainedKnowledge: {
          perBot: [{ botId: 'bot-1', botName: 'Support Agent' }],
        },
      },
    } as WorkspaceBillingSummary;

    expect(buildBotNameLookup(summary).get('bot-1')).toBe('Support Agent');
  });

  it('detects AI credit usage rows', () => {
    expect(
      hasAiCreditUsage({
        usage: { aiCredits: { byBot: [{ botId: 'bot-1', creditsUsed: 0 }] } },
      } as WorkspaceBillingSummary),
    ).toBe(false);
    expect(
      hasAiCreditUsage({
        usage: { aiCredits: { byBot: [{ botId: 'bot-1', creditsUsed: 3 }] } },
      } as WorkspaceBillingSummary),
    ).toBe(true);
  });

  it('formats usage period dates safely', () => {
    expect(formatUsagePeriodDate('2026-05-01T00:00:00.000Z')).not.toBe('—');
    expect(formatUsagePeriodDate(undefined)).toBe('—');
  });

  it('formats credits share percent', () => {
    expect(formatCreditsSharePercent(10, 10)).toBe(100);
    expect(formatCreditsSharePercent(0, 10)).toBe(0);
  });

  it('builds honest AI credits trend points from period usage', () => {
    const points = buildAiCreditsTrendPoints(
      '2026-05-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z',
      25,
    );
    expect(points[0]?.credits).toBe(0);
    expect(points[points.length - 1]?.credits).toBe(25);
  });
});
