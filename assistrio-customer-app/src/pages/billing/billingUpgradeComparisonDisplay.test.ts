import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import {
  buildBillingUpgradeComparison,
  buildBillingUpgradeComparisonRowTooltip,
  formatBillingUpgradeComparisonHeading,
} from '@/pages/billing/billingUpgradeComparisonDisplay';

const planCatalog = [
  {
    key: 'free',
    name: 'Free',
    priceMonthly: 0,
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    analyticsHistoryDays: 7,
    canExportReports: false,
    checkoutAvailable: true,
  },
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    botLimit: 3,
    memberLimit: 5,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    botLimit: 10,
    memberLimit: 10,
    monthlyAiCredits: 2000,
    kbStorageMbPerBot: 30,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: true,
  },
] as WorkspaceBillingSummary['planCatalog'];

describe('billingUpgradeComparisonDisplay', () => {
  it('formats starter to pro heading', () => {
    expect(formatBillingUpgradeComparisonHeading('starter', 'pro')).toBe('STARTER → PRO');
  });

  it('builds starter to pro comparison rows', () => {
    const rows = buildBillingUpgradeComparison(
      {
        workspaceId: 'ws-1',
        plan: {
          key: 'starter',
          name: 'Starter',
          priceMonthly: 49,
          status: 'active',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-06-29T00:00:00.000Z',
        },
        subscription: mockBillingSubscription({ hasActivePaidSubscription: true }),
        entitlements: { ...mockTrialBillingEntitlements(), isTrialPlan: false, monthlyAiCredits: 500 },
        usage: {
          bots: { current: 1, limit: 3 },
          members: { current: 1, pendingInvites: 0, used: 1, limit: 5 },
          aiCredits: {
            periodStart: '2026-05-01T00:00:00.000Z',
            periodEnd: '2026-06-29T00:00:00.000Z',
            monthlyCredits: 500,
            monthlyCreditsUsed: 0,
            monthlyCreditsRemaining: 500,
            topUpCreditsRemaining: 0,
            totalCreditsAvailable: 500,
            totalCreditsRemaining: 500,
            isOverLimit: false,
            byBot: [],
          },
          trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
        },
        planCatalog,
        addonCatalog: [],
        activeAddons: [],
      },
      'pro',
    );

    expect(rows).toEqual([
      { label: 'AI credits', fromValue: '500', toValue: '2,000' },
      { label: 'KB storage', fromValue: '15 MB', toValue: '30 MB' },
      { label: 'Members', fromValue: '5', toValue: '10' },
      { label: 'Support', fromValue: 'Standard', toValue: 'Priority' },
    ]);
  });

  it('builds explanatory tooltip copy for comparison rows', () => {
    const tooltip = buildBillingUpgradeComparisonRowTooltip({
      label: 'AI credits',
      fromValue: '500',
      toValue: '2,000',
    });

    expect(tooltip.label).toBe('AI credits');
    expect(tooltip.fromValue).toBe('500');
    expect(tooltip.toValue).toBe('2,000');
    expect(tooltip.description).toMatch(/chat replies/i);
  });
});
