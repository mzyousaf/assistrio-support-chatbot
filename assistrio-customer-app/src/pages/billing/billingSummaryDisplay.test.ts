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
    ).toContain('15 MB trained knowledge / bot');
    expect(
      planCatalogFeatureLines({
        key: 'free',
        name: 'Free',
        priceMonthly: 0,
        botLimit: 1,
        memberLimit: 1,
        monthlyAiCredits: 50,
        kbStorageMbPerBot: 5,
        analyticsHistoryDays: 7,
        canExportReports: false,
      }),
    ).toContain('50 trial credits total');
  });

  it('formats add-on display names and prices', () => {
    const addon: WorkspaceBillingAddonCatalogCard = {
      key: 'extra_bot',
      name: 'Extra bot',
      billingInterval: 'monthly',
      priceUsd: 49,
      scope: 'workspace',
      checkoutAvailable: false,
    };
    expect(formatAddonDisplayName(addon)).toBe('Extra agent');
    expect(formatAddonPriceLabel(addon)).toBe('$49 / month');
  });
});
