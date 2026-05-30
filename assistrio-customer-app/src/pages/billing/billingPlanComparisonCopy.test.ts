import { describe, expect, it } from 'vitest';
import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';
import {
  buildMainPlanComparisonRows,
  buildPlanComparisonTableGroups,
  MESSAGING_CREDITS_NOTE,
  TRAINED_KNOWLEDGE_UPLOAD_HELPER,
} from './billingPlanComparisonCopy';

const catalog: WorkspaceBillingPlanCatalogCard[] = [
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
  },
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    botLimit: 1,
    memberLimit: 5,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    analyticsHistoryDays: null,
    canExportReports: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    botLimit: 1,
    memberLimit: 10,
    monthlyAiCredits: 2000,
    kbStorageMbPerBot: 30,
    analyticsHistoryDays: null,
    canExportReports: true,
  },
];

describe('billingPlanComparisonCopy', () => {
  it('formats trial and monthly AI credits copy', () => {
    const rows = buildMainPlanComparisonRows(catalog);
    const creditsRow = rows.find((row) => row.feature === 'AI credits / month');
    expect(creditsRow?.values.free).toBe('50 trial credits total');
    expect(creditsRow?.values.starter).toBe('500 AI credits / month');
    expect(creditsRow?.values.pro).toBe('2,000 AI credits / month');
    expect(creditsRow?.featureHint).toContain('Trial credits do not renew.');
  });

  it('uses trained knowledge storage labels and helpers', () => {
    const groups = buildPlanComparisonTableGroups(catalog);
    const coreLimits = groups.find((group) => group.id === 'core-limits');
    expect(coreLimits?.rows.some((row) => row.feature === 'Trained knowledge storage / bot')).toBe(true);
    expect(coreLimits?.note).toBe(TRAINED_KNOWLEDGE_UPLOAD_HELPER);
    expect(groups.find((group) => group.id === 'messaging')?.note).toBe(MESSAGING_CREDITS_NOTE);
  });

  it('shows owner-only access and paid-plan add-on copy on free', () => {
    const groups = buildPlanComparisonTableGroups(catalog);
    const collaboration = groups.find((group) => group.id === 'collaboration-support');
    const memberRow = collaboration?.rows.find((row) => row.feature === 'Member-level access');
    const agentRow = collaboration?.rows.find((row) => row.feature === 'Agent-level access');
    expect(memberRow?.values.free).toBe('—');
    expect(agentRow?.values.free).toBe('—');

    const widgetSharing = groups.find((group) => group.id === 'widget-sharing');
    const brandingRow = widgetSharing?.rows.find((row) => row.feature === 'Remove branding');
    expect(brandingRow?.values.free).toBe('Available on paid plans');
    expect(brandingRow?.values.starter).toBe('Coming soon');
    expect(brandingRow?.values.pro).toBe('Coming soon');
  });
});
