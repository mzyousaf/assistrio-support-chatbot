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

/** Pricing card analytics line (e.g. "7 days analytics"). */
export function formatAnalyticsHistoryCardLabel(days: number | null | undefined): string {
  if (days == null) return 'Unlimited analytics';
  return `${days} days analytics`;
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
  if (addon.key === 'extra_bot') return 'Extra agent';
  return addon.name;
}

export function formatAddonPriceLabel(addon: WorkspaceBillingAddonCatalogCard): string {
  const interval = formatAddonBillingInterval(addon.billingInterval);
  const scope = addon.scope === 'bot' ? ' per bot' : '';
  return `$${addon.priceUsd} / ${interval}${scope}`;
}

/** Compact price label for add-on comparison tables. */
export function formatAddonTablePriceLabel(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.billingInterval === 'one_time') {
    return `$${addon.priceUsd} one-time`;
  }
  return `$${addon.priceUsd}/mo`;
}

/** Scope label for add-on comparison tables. */
export function formatAddonTableScopeLabel(scope: WorkspaceBillingAddonCatalogCard['scope']): string {
  return scope === 'bot' ? 'Per bot' : 'Workspace';
}

/** Price line for add-on cards (e.g. "$30 one-time", "$49 per month"). */
export function formatAddonCardPriceLine(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.billingInterval === 'one_time') {
    return `$${addon.priceUsd.toLocaleString()} one-time`;
  }
  if (addon.scope === 'bot') {
    return `$${addon.priceUsd.toLocaleString()} per month per bot`;
  }
  return `$${addon.priceUsd.toLocaleString()} per month`;
}

/** Short description copy for add-on cards. Frontend display only. */
export function formatAddonDescription(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.key === 'ai_credits_1000') {
    return 'Top up your workspace with extra AI credits when you need more capacity for chats, voice, and dictation.';
  }
  if (addon.key === 'extra_bot') {
    return 'Add extra agents to your workspace.';
  }
  if (addon.key === 'remove_branding') {
    return 'Remove the Powered by Assistrio branding from your deployed agents.';
  }
  if (addon.key === 'kb_storage_5mb') {
    return 'Add trained knowledge storage capacity to a single agent.';
  }
  if (addon.key === 'kb_storage_10mb') {
    return 'Add more trained knowledge storage capacity to a single agent.';
  }
  return addon.name;
}

export function planCatalogFeatureLines(plan: WorkspaceBillingPlanCatalogCard): string[] {
  return planPricingCardFeatureLines(plan);
}

/** Key limits shown on Plans pricing cards. */
export function planPricingCardFeatureLines(plan: WorkspaceBillingPlanCatalogCard): string[] {
  return [
    `${plan.botLimit} agent${plan.botLimit === 1 ? '' : 's'}`,
    `${plan.memberLimit} member${plan.memberLimit === 1 ? '' : 's'}`,
    `${plan.monthlyAiCredits.toLocaleString()} AI credits/month`,
    `${plan.kbStorageMbPerBot} MB trained knowledge / bot`,
    formatAnalyticsHistoryCardLabel(plan.analyticsHistoryDays),
    formatExportReportsLabel(plan.canExportReports),
  ];
}
