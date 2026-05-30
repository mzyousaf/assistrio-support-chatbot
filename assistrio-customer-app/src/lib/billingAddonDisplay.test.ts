import { describe, expect, it } from 'vitest';
import { mockBillingSubscription } from '@/lib/billingSummaryFixtures';
import { mockTrialBillingEntitlements } from '@/lib/planEntitlements';
import { buildBillingAddonChips } from './billingAddonDisplay';

describe('buildBillingAddonChips', () => {
  it('returns No active add-ons when empty', () => {
    const chips = buildBillingAddonChips({
      workspaceId: 'ws-1',
      plan: { key: 'starter', name: 'Starter', priceMonthly: 49, status: 'active', currentPeriodStart: '', currentPeriodEnd: '' },
      subscription: mockBillingSubscription(),
      entitlements: mockTrialBillingEntitlements(),
      usage: {
        bots: { current: 1, limit: 1 },
        members: { current: 1, pendingInvites: 0, used: 1, limit: 3 },
        aiCredits: {
          periodStart: '',
          periodEnd: '',
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
    });
    expect(chips).toEqual([]);
  });

  it('maps known addon keys to chip labels', () => {
    const chips = buildBillingAddonChips({
      workspaceId: 'ws-1',
      plan: { key: 'pro', name: 'Pro', priceMonthly: 99, status: 'active', currentPeriodStart: '', currentPeriodEnd: '' },
      subscription: mockBillingSubscription(),
      entitlements: { ...mockTrialBillingEntitlements(), isTrialPlan: false },
      usage: {
        bots: { current: 1, limit: 1 },
        members: { current: 1, pendingInvites: 0, used: 1, limit: 5 },
        aiCredits: {
          periodStart: '',
          periodEnd: '',
          monthlyCredits: 2000,
          monthlyCreditsUsed: 0,
          monthlyCreditsRemaining: 2000,
          topUpCreditsRemaining: 100,
          totalCreditsAvailable: 2100,
          totalCreditsRemaining: 2100,
          isOverLimit: false,
          byBot: [],
        },
        trainedKnowledge: { perBot: [], totalUsedBytes: 0, note: '' },
      },
      planCatalog: [],
      addonCatalog: [],
      activeAddons: [
        {
          addonKey: 'extra_bot',
          name: 'Extra bot',
          status: 'active',
          targetBotId: null,
          targetBotName: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      ],
    });
    expect(chips.some((c) => c.label === 'Extra bot')).toBe(true);
    expect(chips.some((c) => c.label.includes('AI top-up'))).toBe(true);
  });
});
