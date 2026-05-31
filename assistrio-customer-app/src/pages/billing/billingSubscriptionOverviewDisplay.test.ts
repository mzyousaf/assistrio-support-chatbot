import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import {
  buildCurrentPlanRenewalDisplay,
  buildCurrentPlanDisplay,
  formatBillingPeriodRemainingDaysLabel,
  resolveNextPlanPanel,
  resolveScheduledPlanChange,
  resolveScheduledBillingIntervalChange,
} from '@/pages/billing/billingSubscriptionOverviewDisplay';

function buildSummary(overrides?: Partial<WorkspaceBillingSummary>): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'starter',
      name: 'Starter',
      priceMonthly: 49,
      status: 'active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-29T00:00:00.000Z',
    },
    subscription: mockBillingSubscription({
      subscriptionStatus: 'active',
      hasActivePaidSubscription: true,
    }),
    entitlements: { ...mockTrialBillingEntitlements(), isTrialPlan: false },
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 1, pendingInvites: 0, used: 1, limit: 3 },
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
    planCatalog: [],
    addonCatalog: [],
    activeAddons: [],
    topUps: [],
    ...overrides,
  };
}

describe('billingSubscriptionOverviewDisplay', () => {
  it('buildCurrentPlanDisplay returns essential plan fields only', () => {
    const display = buildCurrentPlanDisplay(buildSummary());
    expect(display.name).toBe('Starter');
    expect(display.status).toBe('Active');
    expect(display.price).toBe('$49/month');
    expect(display.renewsLabel).toBe('Renews on');
  });

  it('resolveScheduledPlanChange returns null when no scheduled fields exist', () => {
    expect(resolveScheduledPlanChange(buildSummary())).toBeNull();
  });

  it('resolveNextPlanPanel shows contextual upgrade when no scheduled change', () => {
    const panel = resolveNextPlanPanel(
      buildSummary({
        plan: {
          key: 'free',
          name: 'Free',
          priceMonthly: 0,
          status: 'free',
          currentPeriodStart: '2026-05-01T00:00:00.000Z',
          currentPeriodEnd: '2026-06-29T00:00:00.000Z',
        },
        entitlements: { ...mockTrialBillingEntitlements(), isTrialPlan: true },
        planCatalog: [
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
        ],
      }),
    );

    expect(panel).toEqual({
      kind: 'upgrade',
      upgrade: { planKey: 'starter', planName: 'Starter', price: '$49/month' },
    });
  });

  it('resolveNextPlanPanel returns null on Pro without scheduled change', () => {
    expect(
      resolveNextPlanPanel(
        buildSummary({
          plan: {
            key: 'pro',
            name: 'Pro',
            priceMonthly: 99,
            status: 'active',
            currentPeriodStart: '2026-05-01T00:00:00.000Z',
            currentPeriodEnd: '2026-06-29T00:00:00.000Z',
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
        }),
      ),
    ).toBeNull();
  });

  it('resolveScheduledPlanChange reads optional scheduled plan fields when present', () => {
    const summary = buildSummary({
      subscription: {
        ...mockBillingSubscription({ hasActivePaidSubscription: true }),
        scheduledPlanKey: 'pro',
        scheduledPlanName: 'Pro',
        scheduledPlanEffectiveDate: '2026-06-29T00:00:00.000Z',
      },
    });

    expect(resolveScheduledPlanChange(summary)).toEqual({
      planKey: 'pro',
      planName: 'Pro',
      effectiveDate: '2026-06-29T00:00:00.000Z',
    });
  });

  it('buildCurrentPlanRenewalDisplay includes remaining days label', () => {
    const summary = buildSummary({
      subscription: mockBillingSubscription({
        subscriptionStatus: 'active',
        hasActivePaidSubscription: true,
        currentPeriodEnd: '2026-06-29T00:00:00.000Z',
      }),
    });
    const display = buildCurrentPlanRenewalDisplay(
      summary,
      new Date('2026-06-01T12:00:00.000Z'),
    );

    expect(display.line).toBe('Renews Jun 29, 2026');
    expect(display.remainingLabel).toBe('28 days remaining');
  });

  it('formatBillingPeriodRemainingDaysLabel uses singular day', () => {
    expect(
      formatBillingPeriodRemainingDaysLabel(
        '2026-06-02T00:00:00.000Z',
        new Date('2026-06-01T12:00:00.000Z'),
      ),
    ).toBe('1 day remaining');
  });

  it('resolveScheduledBillingIntervalChange hides interval banner when cancellation is scheduled', () => {
    const summary = buildSummary({
      subscription: {
        ...mockBillingSubscription({ hasActivePaidSubscription: true, cancelAtPeriodEnd: true }),
        scheduledBillingInterval: 'yearly',
        scheduledBillingIntervalEffectiveDate: '2026-06-29T00:00:00.000Z',
      },
    });

    expect(resolveScheduledBillingIntervalChange(summary)).toBeNull();
  });

  it('resolveScheduledBillingIntervalChange hides interval banner when downgrade is scheduled', () => {
    const summary = buildSummary({
      subscription: {
        ...mockBillingSubscription({ hasActivePaidSubscription: true }),
        scheduledPlanKey: 'starter',
        scheduledBillingInterval: 'monthly',
        scheduledBillingIntervalEffectiveDate: '2026-06-29T00:00:00.000Z',
      },
    });

    expect(resolveScheduledBillingIntervalChange(summary)).toBeNull();
  });

  it('resolveScheduledBillingIntervalChange returns interval-only scheduled change', () => {
    const summary = buildSummary({
      subscription: {
        ...mockBillingSubscription({ hasActivePaidSubscription: true }),
        scheduledBillingInterval: 'yearly',
        scheduledBillingIntervalEffectiveDate: '2026-06-29T00:00:00.000Z',
      },
    });

    expect(resolveScheduledBillingIntervalChange(summary)).toEqual({
      targetInterval: 'yearly',
      effectiveDate: '2026-06-29T00:00:00.000Z',
    });
  });
});
