import { describe, expect, it } from 'vitest';
import { buildAppShellCreditsDisplay, buildAppShellPlanFooterDisplay } from '@/layout/appShellCreditsDisplay';

const baseAiCredits = {
  periodStart: '2026-05-01T00:00:00.000Z',
  periodEnd: '2026-06-01T00:00:00.000Z',
  monthlyCredits: 500,
  monthlyCreditsUsed: 0,
  monthlyCreditsRemaining: 500,
  topUpCreditsRemaining: 0,
  totalCreditsAvailable: 500,
  totalCreditsRemaining: 500,
  isOverLimit: false,
  byBot: [],
};

describe('buildAppShellCreditsDisplay', () => {
  it('hides top-up bar without purchase records', () => {
    const display = buildAppShellCreditsDisplay(
      { ...baseAiCredits, topUpCreditsRemaining: 1000, totalCreditsRemaining: 1500 },
      [],
    );

    expect(display?.showTopUpBar).toBe(false);
  });

  it('shows top-up bar when purchased top-up credits remain', () => {
    const display = buildAppShellCreditsDisplay(
      { ...baseAiCredits, topUpCreditsRemaining: 1000, totalCreditsRemaining: 1500 },
      [
        {
          creditsPurchased: 1000,
          creditsRemaining: 1000,
          expiresAt: '2027-05-29T00:00:00.000Z',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    );

    expect(display?.showTopUpBar).toBe(true);
    expect(display?.topUpUsed).toBe(0);
    expect(display?.topUpTotal).toBe(1000);
  });
});

describe('buildAppShellPlanFooterDisplay', () => {
  it('returns upgrade footer when contextual upgrade exists', () => {
    const summary = {
      workspaceId: 'ws-1',
      plan: {
        key: 'starter',
        name: 'Starter',
        priceMonthly: 49,
        status: 'active',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-06-29T00:00:00.000Z',
      },
      subscription: {
        subscriptionStatus: 'active',
        hasActivePaidSubscription: true,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-06-29T00:00:00.000Z',
      },
      entitlements: {
        isTrialPlan: false,
        monthlyAiCredits: 500,
        botLimit: 3,
        memberLimit: 5,
        kbStorageMbPerBot: 15,
        canExportReports: true,
        analyticsHistoryDays: null,
      },
      usage: {
        bots: { current: 1, limit: 3 },
        members: { current: 1, pendingInvites: 0, used: 1, limit: 5 },
        aiCredits: baseAiCredits,
        trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
      },
      planCatalog: [
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
      ],
      addonCatalog: [],
      activeAddons: [],
      topUps: [],
    } as const;

    expect(buildAppShellPlanFooterDisplay(summary)).toEqual({
      kind: 'upgrade',
      fromPlanKey: 'starter',
      toPlanKey: 'pro',
      planName: 'Pro',
      price: '$99/month',
      comparisonRows: expect.arrayContaining([
        { label: 'AI credits', fromValue: '500', toValue: '2,000' },
        { label: 'KB storage', fromValue: '15 MB', toValue: '30 MB' },
        { label: 'Members', fromValue: '5', toValue: '10' },
        { label: 'Support', fromValue: 'Standard', toValue: 'Priority' },
      ]),
    });
  });

  it('returns current plan footer when already on Pro', () => {
    const summary = {
      workspaceId: 'ws-1',
      plan: {
        key: 'pro',
        name: 'Pro',
        priceMonthly: 99,
        status: 'active',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-06-29T00:00:00.000Z',
      },
      subscription: {
        subscriptionStatus: 'active',
        hasActivePaidSubscription: true,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-06-29T00:00:00.000Z',
      },
      entitlements: {
        isTrialPlan: false,
        monthlyAiCredits: 2000,
        botLimit: 10,
        memberLimit: 10,
        kbStorageMbPerBot: 30,
        canExportReports: true,
        analyticsHistoryDays: null,
      },
      usage: {
        bots: { current: 1, limit: 10 },
        members: { current: 1, pendingInvites: 0, used: 1, limit: 10 },
        aiCredits: baseAiCredits,
        trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
      },
      planCatalog: [],
      addonCatalog: [],
      activeAddons: [],
      topUps: [],
    } as const;

    expect(buildAppShellPlanFooterDisplay(summary)).toEqual({
      kind: 'current',
      planKey: 'pro',
      planName: 'Pro',
      price: '$99/month',
      renewalLine: expect.any(String),
      isHighestPlan: true,
    });
  });
});
