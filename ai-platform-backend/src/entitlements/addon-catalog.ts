import {
  resolveMonthlyEquivalentYearly,
  resolveYearlyPriceFromMonthly,
  YEARLY_DISCOUNT_PERCENT,
  type BillingInterval,
} from '../billing/billing-interval.types';

/**
 * Static add-on catalog for billing/enforcement.
 */
export const LEGACY_KB_ADDON_KEYS = ['kb_storage_5mb', 'kb_storage_10mb'] as const;

export type LegacyKbAddonKey = (typeof LEGACY_KB_ADDON_KEYS)[number];

export function isLegacyKbAddonKey(key: string | null | undefined): boolean {
  const normalized = String(key ?? '').trim();
  return LEGACY_KB_ADDON_KEYS.includes(normalized as LegacyKbAddonKey);
}

export const WORKSPACE_ADDON_KEYS = [
  'ai_credits_1000',
  'extra_bot',
  'remove_branding',
] as const;

export type WorkspaceAddonKey = (typeof WORKSPACE_ADDON_KEYS)[number];

export type WorkspaceAddonDefinition = {
  key: WorkspaceAddonKey;
  name: string;
  billingInterval: 'one_time' | BillingInterval;
  priceUsd: number;
  priceYearlyUsd?: number;
  monthlyEquivalentYearlyUsd?: number;
  yearlyDiscountPercent?: number;
  billingIntervals?: readonly BillingInterval[];
  scope: 'workspace' | 'bot';
};

function buildRecurringAddonDefinition(input: {
  key: WorkspaceAddonKey;
  name: string;
  priceMonthlyUsd: number;
  scope: 'workspace' | 'bot';
}): WorkspaceAddonDefinition {
  const priceYearlyUsd = resolveYearlyPriceFromMonthly(input.priceMonthlyUsd);
  return {
    key: input.key,
    name: input.name,
    billingInterval: 'monthly',
    priceUsd: input.priceMonthlyUsd,
    priceYearlyUsd,
    monthlyEquivalentYearlyUsd: resolveMonthlyEquivalentYearly(priceYearlyUsd),
    yearlyDiscountPercent: YEARLY_DISCOUNT_PERCENT,
    billingIntervals: ['monthly', 'yearly'],
    scope: input.scope,
  };
}

export const WORKSPACE_ADDON_CATALOG: readonly WorkspaceAddonDefinition[] = [
  {
    key: 'ai_credits_1000',
    name: '1,000 extra AI credits',
    billingInterval: 'one_time',
    priceUsd: 30,
    scope: 'workspace',
  },
  buildRecurringAddonDefinition({
    key: 'extra_bot',
    name: 'Extra AI Agent',
    priceMonthlyUsd: 39,
    scope: 'workspace',
  }),
  buildRecurringAddonDefinition({
    key: 'remove_branding',
    name: 'Remove Powered by Assistrio',
    priceMonthlyUsd: 49,
    scope: 'workspace',
  }),
];

export function getWorkspaceAddonDefinition(key: string): WorkspaceAddonDefinition | undefined {
  return WORKSPACE_ADDON_CATALOG.find((item) => item.key === key);
}

export function isRecurringWorkspaceAddonKey(key: string): key is 'extra_bot' | 'remove_branding' {
  return key === 'extra_bot' || key === 'remove_branding';
}
