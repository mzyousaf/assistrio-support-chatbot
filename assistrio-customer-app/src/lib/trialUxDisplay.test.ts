import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingSummary } from '@/api/types';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import {
  formatTrialDaysRemaining,
  isTrialCreditsExhausted,
  isTrialEndingSoon,
  resolveTrialUxState,
} from '@/lib/trialUxDisplay';

function buildSummary(overrides?: Partial<WorkspaceBillingSummary>): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      status: 'trialing',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-05-08T00:00:00.000Z',
    },
    subscription: mockBillingSubscription(),
    entitlements: mockTrialBillingEntitlements(),
    usage: {
      bots: { current: 1, limit: 1 },
      members: { current: 1, pendingInvites: 0, used: 1, limit: 1 },
      aiCredits: {
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-05-08T00:00:00.000Z',
        monthlyCredits: 50,
        monthlyCreditsUsed: 10,
        monthlyCreditsRemaining: 40,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 40,
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

describe('trialUxDisplay', () => {
  it('formats trial days remaining', () => {
    const end = new Date('2026-05-08T12:00:00.000Z').toISOString();
    expect(formatTrialDaysRemaining(end, new Date('2026-05-06T12:00:00.000Z'))).toBe('Ends in 2 days');
  });

  it('detects ending soon within 24 hours', () => {
    const end = '2026-05-08T00:00:00.000Z';
    const summary = buildSummary({
      plan: {
        ...buildSummary().plan,
        currentPeriodEnd: end,
      },
      subscription: mockBillingSubscription({ currentPeriodEnd: end }),
    });
    expect(isTrialEndingSoon(summary, new Date('2026-05-07T12:00:00.000Z'))).toBe(true);
  });

  it('detects credits exhausted state', () => {
    const summary = buildSummary({
      usage: {
        ...buildSummary().usage,
        aiCredits: {
          ...buildSummary().usage.aiCredits,
          monthlyCreditsUsed: 50,
          monthlyCreditsRemaining: 0,
          isOverLimit: true,
        },
      },
    });
    expect(isTrialCreditsExhausted(summary)).toBe(true);
    expect(resolveTrialUxState(summary)).toBe('credits_exhausted');
  });

  it('prioritizes expired trial over credits exhausted', () => {
    const summary = buildSummary({
      entitlements: {
        ...mockTrialBillingEntitlements(),
        isTrialExpired: true,
      },
      usage: {
        ...buildSummary().usage,
        aiCredits: {
          ...buildSummary().usage.aiCredits,
          monthlyCreditsUsed: 50,
          isOverLimit: true,
        },
      },
    });
    expect(resolveTrialUxState(summary)).toBe('expired');
  });
});
