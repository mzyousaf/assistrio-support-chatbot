import type { WorkspaceBillingAddonCatalogCard, WorkspaceBillingPlanCatalogCard } from '@/api/types';

export function formatPlanPriceMonthly(priceMonthly: number | null | undefined): string {
  const price = Number(priceMonthly ?? 0);
  if (!Number.isFinite(price) || price <= 0) return '$0/month';
  return `$${price.toLocaleString()}/month`;
}

export function formatAnalyticsHistoryLabel(days: number | null | undefined): string {
  if (days == null) return 'Unlimited history';
  return `${days} days`;
}

export function formatExportReportsLabel(enabled: boolean | null | undefined): string {
  return enabled ? 'Export reports included' : 'Export reports not included';
}

export function formatAddonBillingInterval(interval: WorkspaceBillingAddonCatalogCard['billingInterval']): string {
  return interval === 'one_time' ? 'one-time' : 'month';
}

export function formatAddonScopeLabel(scope: WorkspaceBillingAddonCatalogCard['scope']): string {
  return scope === 'bot' ? 'per bot' : 'workspace';
}

/** User-facing add-on titles aligned with Epic 6 trained-knowledge wording. */
export function formatAddonDisplayName(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.key === 'kb_storage_5mb') return '+5 MB trained KB storage';
  if (addon.key === 'kb_storage_10mb') return '+10 MB trained KB storage';
  return addon.name;
}

export function formatAddonPriceLabel(addon: WorkspaceBillingAddonCatalogCard): string {
  const interval = formatAddonBillingInterval(addon.billingInterval);
  const scope = addon.scope === 'bot' ? ' per bot' : '';
  return `$${addon.priceUsd} / ${interval}${scope}`;
}

export function planCatalogFeatureLines(plan: WorkspaceBillingPlanCatalogCard): string[] {
  return [
    `${plan.botLimit} agent${plan.botLimit === 1 ? '' : 's'}`,
    `${plan.memberLimit} member${plan.memberLimit === 1 ? '' : 's'}`,
    `${plan.monthlyAiCredits.toLocaleString()} AI credits/month`,
    `${plan.kbStorageMbPerBot} MB trained knowledge storage / bot`,
    formatAnalyticsHistoryLabel(plan.analyticsHistoryDays),
    formatExportReportsLabel(plan.canExportReports),
  ];
}
