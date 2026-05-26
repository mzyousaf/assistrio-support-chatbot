import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingAddonCatalogCard } from '@/api/types';
import {
  formatAddonDisplayName,
  formatAddonPriceLabel,
  formatPlanPriceMonthly,
  planCatalogFeatureLines,
} from './billingSummaryDisplay';

describe('billingSummaryDisplay', () => {
  it('formats plan prices and feature lines', () => {
    expect(formatPlanPriceMonthly(0)).toBe('$0/month');
    expect(formatPlanPriceMonthly(49)).toBe('$49/month');
    expect(
      planCatalogFeatureLines({
        key: 'starter',
        name: 'Starter',
        priceMonthly: 49,
        botLimit: 1,
        memberLimit: 3,
        monthlyAiCredits: 500,
        kbStorageMbPerBot: 15,
        analyticsHistoryDays: null,
        canExportReports: true,
      }),
    ).toContain('15 MB trained knowledge storage / bot');
  });

  it('formats add-on display names and prices', () => {
    const addon: WorkspaceBillingAddonCatalogCard = {
      key: 'kb_storage_5mb',
      name: '+5 MB KB storage',
      billingInterval: 'monthly',
      priceUsd: 10,
      scope: 'bot',
      checkoutAvailable: false,
    };
    expect(formatAddonDisplayName(addon)).toBe('+5 MB trained KB storage');
    expect(formatAddonPriceLabel(addon)).toBe('$10 / month per bot');
  });
});
