import type {
  WorkspaceBillingAddonCatalogCard,
  WorkspaceBillingInvoiceRow,
  WorkspaceBillingPlanCatalogCard,
} from '@/api/types';
import {
  CUSTOMER_EXTRA_AI_AGENT,
  CUSTOMER_KB_PER_AI_AGENT,
  CUSTOMER_PER_AI_AGENT,
  CUSTOMER_PER_AI_AGENT_TITLE,
  formatCustomerFacingAgentText,
} from '@/lib/customerAgentTerminology';

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

export function formatInvoiceCadenceLabel(
  row: Pick<WorkspaceBillingInvoiceRow, 'billingInterval' | 'itemType'>,
): string | null {
  if (row.itemType === 'top_up') return 'One-time';
  if (row.billingInterval === 'yearly') return 'Annually';
  if (row.billingInterval === 'monthly') return 'Monthly';
  return null;
}

export function formatAddonScopeLabel(scope: WorkspaceBillingAddonCatalogCard['scope']): string {
  return scope === 'bot' ? CUSTOMER_PER_AI_AGENT : 'workspace';
}

/** User-facing add-on titles aligned with Epic 6 trained-knowledge wording. */
export function formatAddonDisplayName(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.key === 'extra_bot') return CUSTOMER_EXTRA_AI_AGENT;
  if (addon.key === 'ai_credits_1000') return '1,000 extra AI credits';
  return formatCustomerFacingAgentText(addon.name);
}

export function formatAddonPriceLabel(addon: WorkspaceBillingAddonCatalogCard): string {
  const interval = formatAddonBillingInterval(addon.billingInterval);
  const scope = addon.scope === 'bot' ? ` ${CUSTOMER_PER_AI_AGENT}` : '';
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
  return scope === 'bot' ? CUSTOMER_PER_AI_AGENT_TITLE : 'Workspace';
}

/** Price line for add-on cards (e.g. "$30", "$49 per month"). */
export function formatAddonCardPriceLine(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.billingInterval === 'one_time') {
    return `$${addon.priceUsd.toLocaleString()}`;
  }
  if (addon.scope === 'bot') {
    return `$${addon.priceUsd.toLocaleString()} per month ${CUSTOMER_PER_AI_AGENT}`;
  }
  return `$${addon.priceUsd.toLocaleString()} per month`;
}

/** Compact price · scope line for Usage add-on rows. */
export function formatUsageAddonMetaLine(addon: WorkspaceBillingAddonCatalogCard): string {
  const price =
    addon.billingInterval === 'one_time'
      ? `$${addon.priceUsd.toLocaleString()} one-time`
      : `$${addon.priceUsd.toLocaleString()}/month`;
  return `${price} · ${formatAddonTableScopeLabel(addon.scope)}`;
}

/** Short description copy for add-on cards. Frontend display only. */
export function formatAddonDescription(addon: WorkspaceBillingAddonCatalogCard): string {
  if (addon.key === 'ai_credits_1000') {
    return 'Used after monthly credits.';
  }
  if (addon.key === 'extra_bot') {
    return 'Adds one extra AI agent to this workspace.';
  }
  if (addon.key === 'remove_branding') {
    return 'Hide "Powered by Assistrio" from your widget.';
  }
  if (addon.key === 'kb_storage_5mb' || addon.key === 'kb_storage_10mb') {
    return 'Add more trained knowledge storage for one bot.';
  }
  return addon.description?.trim() || addon.name;
}

export function planCatalogFeatureLines(plan: WorkspaceBillingPlanCatalogCard): string[] {
  return planPricingCardFeatureLines(plan);
}

/** Key limits shown on Plans pricing cards. */
export function planPricingCardFeatureLines(plan: WorkspaceBillingPlanCatalogCard): string[] {
  const creditsLine =
    plan.key === 'free'
      ? `${plan.monthlyAiCredits.toLocaleString()} trial credits total`
      : `${plan.monthlyAiCredits.toLocaleString()} AI credits / month`;

  return [
    `${plan.botLimit} AI Agent${plan.botLimit === 1 ? '' : 's'}`,
    `${plan.memberLimit} member${plan.memberLimit === 1 ? '' : 's'}`,
    creditsLine,
    `${plan.kbStorageMbPerBot} MB ${CUSTOMER_KB_PER_AI_AGENT}`,
    formatAnalyticsHistoryCardLabel(plan.analyticsHistoryDays),
    formatExportReportsLabel(plan.canExportReports),
  ];
}
