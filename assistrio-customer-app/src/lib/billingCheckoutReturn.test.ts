import { describe, expect, it } from 'vitest';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import type { WorkspaceBillingSummary } from '@/api/types';
import {
  billingCheckoutChangesApplied,
  captureBillingCheckoutSnapshot,
} from '@/lib/billingCheckoutReturn';

function summary(overrides: Partial<WorkspaceBillingSummary>): WorkspaceBillingSummary {
  return {
    workspaceId: 'ws-1',
    plan: {
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      status: 'free',
      currentPeriodStart: '',
      currentPeriodEnd: '',
    },
    subscription: mockBillingSubscription(),
    entitlements: mockTrialBillingEntitlements(),
    usage: {
      bots: { current: 0, limit: 1 },
      members: { current: 0, pendingInvites: 0, used: 0, limit: 1 },
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 50,
        monthlyCreditsUsed: 0,
        monthlyCreditsRemaining: 50,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 50,
        isOverLimit: false,
        byBot: [],
      },
      trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
    },
    planCatalog: [],
    addonCatalog: [],
    activeAddons: [],
    ...overrides,
  };
}

describe('billingCheckoutReturn', () => {
  it('detects plan upgrade', () => {
    const before = captureBillingCheckoutSnapshot(summary({}));
    const after = summary({
      plan: { key: 'starter', name: 'Starter', priceMonthly: 49, status: 'active', currentPeriodStart: '', currentPeriodEnd: '' },
    });
    expect(billingCheckoutChangesApplied(before, after)).toBe(true);
  });

  it('detects top-up credits', () => {
    const before = captureBillingCheckoutSnapshot(summary({}));
    const after = summary({
      entitlements: { ...mockTrialBillingEntitlements(), topUpCreditsRemaining: 1000 },
    });
    expect(billingCheckoutChangesApplied(before, after)).toBe(true);
  });
});
