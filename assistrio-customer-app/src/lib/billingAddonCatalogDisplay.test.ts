import { describe, expect, it } from 'vitest';
import {
  formatAddonStatusLabel,
  resolveAddonPurchaseLabel,
} from './billingAddonCatalogDisplay';

describe('billingAddonCatalogDisplay', () => {
  it('maps add-on status labels for billing cards', () => {
    expect(formatAddonStatusLabel('active')).toBe('Active');
    expect(formatAddonStatusLabel('inactive')).toBe('Not active');
    expect(formatAddonStatusLabel('cancel_at_period_end')).toBe('Cancels at period end');
  });

  it('uses Buy credits for top-up add-on', () => {
    expect(
      resolveAddonPurchaseLabel({
        key: 'ai_credits_1000',
        name: '1,000 extra AI credits',
        billingInterval: 'one_time',
        priceUsd: 30,
        scope: 'workspace',
        checkoutAvailable: true,
      }),
    ).toBe('Buy credits');
  });
});
