import { describe, expect, it } from 'vitest';
import { isBillingAddonAdded } from '@/pages/billing/billingAddonCardIconDisplay';

describe('isBillingAddonAdded', () => {
  it('detects added state for recurring add-ons', () => {
    expect(isBillingAddonAdded({ addonKey: 'remove_branding', status: 'active' })).toBe(true);
    expect(isBillingAddonAdded({ addonKey: 'remove_branding', status: 'inactive' })).toBe(false);
  });

  it('detects added state for extra bot instances and top-up balance', () => {
    expect(isBillingAddonAdded({ addonKey: 'extra_bot', extraBotInstanceCount: 2 })).toBe(true);
    expect(isBillingAddonAdded({ addonKey: 'extra_bot', extraBotInstanceCount: 0 })).toBe(false);
    expect(isBillingAddonAdded({ addonKey: 'ai_credits_1000', hasTopUpBalance: true })).toBe(true);
    expect(isBillingAddonAdded({ addonKey: 'ai_credits_1000', hasTopUpBalance: false })).toBe(false);
  });
});
