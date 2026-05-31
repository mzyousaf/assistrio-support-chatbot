import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import {
  buildAiCreditsCardDisplay,
  buildAiCreditsTrendPoints,
  buildBotNameLookup,
  buildMonthlyAiCreditsCardDisplay,
  buildTopUpCreditsCardDisplay,
  buildTopUpCreditsFooter,
  computeTotalCreditsAvailable,
  computeTopUpCreditsUsage,
  formatAiCreditsPercent,
  formatCreditsSharePercent,
  formatPlanChipLabel,
  formatSubscriptionStatusLabel,
  formatUsagePeriodDate,
  hasAiCreditUsage,
  hasPurchasedTopUpCredits,
  hasTopUpPurchaseRecords,
  usagePlanStatusTagClassName,
} from './usagePageFormat';

describe('usagePageFormat', () => {
  it('maps plan status tag colors from subscription status', () => {
    expect(
      usagePlanStatusTagClassName({
        plan: { status: 'free' },
        subscription: { subscriptionStatus: 'free', hasActivePaidSubscription: false },
        entitlements: { isTrialPlan: true },
      } as never),
    ).toContain('teal');

    expect(
      usagePlanStatusTagClassName({
        plan: { status: 'active' },
        subscription: { subscriptionStatus: 'past_due', hasPaymentIssue: true },
        entitlements: { isTrialPlan: false },
      } as never),
    ).toContain('red');
  });

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

  it('builds monthly AI credits card with remaining and usage lines', () => {
    const display = buildMonthlyAiCreditsCardDisplay({
      monthlyCredits: 500,
      monthlyCreditsUsed: 0,
      monthlyCreditsRemaining: 500,
      periodEnd: '2026-06-01T00:00:00.000Z',
    });

    expect(display.valueLabel).toBe('0 / 500');
    expect(display.usageLine).toBe('Credits used this period');
    expect(display.resetFooter).toMatch(/^Resets /);
    expect(display.monthlyUsagePercent).toBe(0);
  });

  it('builds trial AI credits card without monthly renewal copy', () => {
    const display = buildMonthlyAiCreditsCardDisplay(
      {
        monthlyCredits: 50,
        monthlyCreditsUsed: 50,
        monthlyCreditsRemaining: 0,
        periodEnd: '2026-06-01T00:00:00.000Z',
      },
      { isTrialPlan: true },
    );

    expect(display.usageLine).toBe('Trial credits used');
    expect(display.resetFooter).toBe('Trial credits do not renew');
    expect(display.resetFooter).not.toMatch(/^Resets /);
  });

  it('monthly usage percent ignores top-up credits', () => {
    const display = buildMonthlyAiCreditsCardDisplay({
      monthlyCredits: 500,
      monthlyCreditsUsed: 250,
      monthlyCreditsRemaining: 250,
    });

    expect(display.monthlyUsagePercent).toBe(formatAiCreditsPercent(250, 500));
    expect(display.monthlyUsagePercent).toBe(50);
    expect(
      computeTotalCreditsAvailable(display.monthlyRemaining, 2000),
    ).toBe(2250);
  });

  it('computes total available as monthly remaining plus top-up remaining', () => {
    expect(computeTotalCreditsAvailable(500, 1000)).toBe(1500);

    const legacy = buildAiCreditsCardDisplay({
      monthlyCredits: 500,
      monthlyCreditsUsed: 0,
      monthlyCreditsRemaining: 500,
      topUpCreditsRemaining: 1000,
    });
    expect(legacy.totalAvailable).toBe(1500);
  });

  it('shows top-up card when purchased top-up credits remain', () => {
    const display = buildTopUpCreditsCardDisplay(1000, [
      {
        creditsPurchased: 1000,
        creditsRemaining: 1000,
        expiresAt: '2027-05-29T00:00:00.000Z',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ]);

    expect(display.showCard).toBe(true);
    expect(display.valueLabel).toBe('0 / 1,000');
    expect(display.subtitleLine).toBe('Purchased credit balance');
    expect(display.reserveTooltip).toBe('Used after monthly credits run out');
    expect(display.ringPercent).toBe(0);
    expect(display.expiryFooter).toMatch(/^Expires /);
  });

  it('hides top-up card when no top-up credits exist', () => {
    const display = buildTopUpCreditsCardDisplay(0);

    expect(display.showCard).toBe(false);
    expect(display.topUpRemaining).toBe(0);
  });

  it('hides top-up card when remaining credits exist without purchase records', () => {
    const display = buildTopUpCreditsCardDisplay(1000, []);

    expect(display.showCard).toBe(false);
    expect(hasTopUpPurchaseRecords([])).toBe(false);
    expect(hasPurchasedTopUpCredits(1000, [])).toBe(false);
  });

  it('detects purchased top-up records', () => {
    const topUps = [
      {
        creditsPurchased: 1000,
        creditsRemaining: 1000,
        expiresAt: '2027-05-29T00:00:00.000Z',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ];

    expect(hasTopUpPurchaseRecords(topUps)).toBe(true);
    expect(hasPurchasedTopUpCredits(1000, topUps)).toBe(true);
    expect(hasPurchasedTopUpCredits(0, topUps)).toBe(false);
  });

  it('merges multiple top-up purchases into combined usage totals', () => {
    const topUps = [
      {
        creditsPurchased: 1000,
        creditsRemaining: 0,
        expiresAt: '2027-05-01T00:00:00.000Z',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        creditsPurchased: 1000,
        creditsRemaining: 700,
        expiresAt: '2027-06-01T00:00:00.000Z',
        createdAt: '2026-05-02T00:00:00.000Z',
      },
    ];

    expect(computeTopUpCreditsUsage(700, topUps)).toEqual({ used: 1300, totalPurchased: 2000 });

    const display = buildTopUpCreditsCardDisplay(700, topUps);
    expect(display.valueLabel).toBe('1,300 / 2,000');
  });

  it('builds nearest expiry footer for multiple top-ups', () => {
    const footer = buildTopUpCreditsFooter([
      {
        creditsPurchased: 500,
        creditsRemaining: 500,
        expiresAt: '2027-06-01T00:00:00.000Z',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        creditsPurchased: 500,
        creditsRemaining: 500,
        expiresAt: '2027-05-29T00:00:00.000Z',
        createdAt: '2026-05-02T00:00:00.000Z',
      },
    ]);

    expect(footer).toMatch(/^Expires /);
    expect(footer).toContain('Multiple top-ups');
  });
});
