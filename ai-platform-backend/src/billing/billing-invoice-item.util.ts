import type { PlanKey } from '../entitlements/plan-catalog';
import type { WorkspaceAddonKey } from '../entitlements/addon-catalog';
import { isLegacyKbAddonKey, WORKSPACE_ADDON_CATALOG } from '../entitlements/addon-catalog';import type { LemonSqueezyBillingConfig } from './billing-config.util';
import type { ProviderInvoiceRow } from './billing-invoice.types';

export type InvoiceItemType = 'plan' | 'addon' | 'top_up' | 'unknown';

export type InvoiceSource = 'lemon_subscription_invoice' | 'lemon_order' | 'local_top_up';

export type InvoiceItemKey =
  | PlanKey
  | WorkspaceAddonKey
  | 'starter'
  | 'pro'
  | 'extra_bot'
  | 'remove_branding'
  | 'legacy_kb_storage'
  | 'ai_credits_1000';

const LEGACY_KB_ITEM_KEYS = new Set(['kb_storage_5mb', 'kb_storage_10mb']);

const ADDON_ITEM_NAMES: Record<string, string> = {
  extra_bot: 'Extra bot',
  remove_branding: 'Remove Powered by Assistrio',
  legacy_kb_storage: 'Legacy KB storage add-on',
  ai_credits_1000: '1,000 AI credits',
};
const PLAN_ITEM_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
};

const PLAN_VARIANT_KEYS = new Set<string>(['starter', 'pro']);

export type InvoiceFetchHint =
  | { kind: 'plan'; planKey: PlanKey; providerSubscriptionId?: string }
  | { kind: 'addon'; addonKey: string; providerSubscriptionId?: string };

export function buildSubscriptionInvoiceRowId(row: {
  id: string;
  source?: string | null;
  providerSubscriptionId?: string | null;
}): string {
  const invoiceId = String(row.id ?? '').trim();
  if (!invoiceId) return '';
  const source = String(row.source ?? 'lemon_subscription_invoice').trim();
  const subscriptionId = String(row.providerSubscriptionId ?? '').trim() || 'unknown-subscription';
  return `${source}:${invoiceId}:${subscriptionId}`;
}

export type InvoiceItemMatch = {
  itemType: InvoiceItemType;
  itemKey?: string;
  itemName?: string;
  description: string;
};

export function variantIdToItemKey(
  variantId: string | null | undefined,
  lemonConfig: LemonSqueezyBillingConfig | null,
): InvoiceItemKey | undefined {
  const id = String(variantId ?? '').trim();
  if (!id || !lemonConfig) return undefined;

  const entries = Object.entries(lemonConfig.variantIds) as Array<[InvoiceItemKey, string]>;
  const match = entries.find(([, configuredId]) => {
    const configured = String(configuredId ?? '').trim();
    return configured.length > 0 && configured === id;
  });
  return match?.[0];
}

export function resolveInvoiceItemType(itemKey: string | undefined): InvoiceItemType {
  if (!itemKey) return 'unknown';
  if (itemKey === 'legacy_kb_storage') return 'unknown';
  if (itemKey === 'starter' || itemKey === 'pro') return 'plan';
  if (itemKey === 'ai_credits_1000') return 'top_up';
  if (itemKey in ADDON_ITEM_NAMES && itemKey !== 'ai_credits_1000') return 'addon';
  return 'unknown';
}

export function resolveInvoiceItemName(itemKey: string | undefined): string | undefined {
  if (!itemKey) return undefined;
  return ADDON_ITEM_NAMES[itemKey] ?? PLAN_ITEM_NAMES[itemKey] ?? undefined;
}

export function mapInvoiceItemDescription(input: {
  itemKey?: string;
  billingReason?: string | null;
}): string {
  const reason = String(input.billingReason ?? '')
    .trim()
    .toLowerCase();
  const itemKey = String(input.itemKey ?? '').trim();

  if (itemKey === 'starter') {
    if (reason === 'renewal') return 'Starter subscription renewal';
    if (reason === 'updated') return 'Starter subscription updated';
    if (reason === 'initial' || !reason) return 'Starter subscription started';
    return 'Starter subscription renewal';
  }
  if (itemKey === 'pro') {
    if (reason === 'renewal') return 'Pro subscription renewal';
    if (reason === 'updated') return 'Pro subscription updated';
    if (reason === 'initial' || !reason) return 'Pro subscription started';
    return 'Pro subscription renewal';
  }
  if (itemKey === 'extra_bot') return 'Extra bot add-on';
  if (itemKey === 'remove_branding') return 'Remove branding add-on';
  if (itemKey === 'legacy_kb_storage' || LEGACY_KB_ITEM_KEYS.has(itemKey)) {
    return 'Legacy trained knowledge add-on';
  }
  if (itemKey === 'ai_credits_1000') return '1,000 AI credits top-up';
  if (reason === 'initial') return 'Subscription started';
  if (reason === 'renewal') return 'Subscription renewal';
  return 'Payment';
}

export function resolveInvoiceItemMatch(input: {
  row: Pick<
    ProviderInvoiceRow,
    'providerSubscriptionId' | 'providerVariantId' | 'providerOrderId' | 'billingReason'
  >;
  planSubscriptionId: string;
  planKey?: PlanKey | string | null;
  addonKeyBySubscriptionId: Map<string, string>;
  topUpOrderIds: Set<string>;
  lemonConfig: LemonSqueezyBillingConfig | null;
  fetchHint?: InvoiceFetchHint;
}): InvoiceItemMatch {
  const subscriptionId = String(input.row.providerSubscriptionId ?? '').trim();
  const planSubscriptionId = String(input.planSubscriptionId ?? '').trim();
  const billingReason = input.row.billingReason ?? null;
  const planKey = input.planKey === 'starter' || input.planKey === 'pro' ? input.planKey : undefined;
  const variantKey = variantIdToItemKey(input.row.providerVariantId, input.lemonConfig);

  // 1. Recurring add-on subscription (most specific)
  if (subscriptionId && input.addonKeyBySubscriptionId.has(subscriptionId)) {
    const addonKey = input.addonKeyBySubscriptionId.get(subscriptionId)!;
    return buildMatch(addonKey, billingReason);
  }

  // 2. Main workspace plan subscription (subscription id is authoritative)
  if (planSubscriptionId && subscriptionId && subscriptionId === planSubscriptionId && planKey) {
    return buildMatch(planKey, billingReason);
  }

  // 3. Top-up order id
  const orderId = String(input.row.providerOrderId ?? '').trim();
  if (orderId && input.topUpOrderIds.has(orderId)) {
    return buildMatch('ai_credits_1000', billingReason);
  }

  // 4. Fetch hint — only when subscription id is missing or matches the hinted subscription
  if (input.fetchHint?.kind === 'addon') {
    const hintedSubscriptionId = String(input.fetchHint.providerSubscriptionId ?? '').trim();
    if (
      !subscriptionId ||
      subscriptionId === hintedSubscriptionId ||
      input.addonKeyBySubscriptionId.get(subscriptionId) === input.fetchHint.addonKey
    ) {
      return buildMatch(input.fetchHint.addonKey, billingReason);
    }
  }
  if (input.fetchHint?.kind === 'plan' && planKey) {
    const hintedSubscriptionId = String(input.fetchHint.providerSubscriptionId ?? '').trim();
    if (
      (!subscriptionId || subscriptionId === planSubscriptionId || subscriptionId === hintedSubscriptionId) &&
      (!variantKey || PLAN_VARIANT_KEYS.has(variantKey))
    ) {
      return buildMatch(planKey, billingReason);
    }
  }

  // 5. Provider variant id
  if (variantKey) {
    return buildMatch(variantKey, billingReason);
  }

  // 6. Last-resort fetch hint when Lemon omitted subscription/variant metadata
  if (input.fetchHint?.kind === 'addon') {
    return buildMatch(input.fetchHint.addonKey, billingReason);
  }
  if (planKey && input.fetchHint?.kind === 'plan') {
    return buildMatch(planKey, billingReason);
  }

  return {
    itemType: 'unknown',
    itemKey: undefined,
    itemName: undefined,
    description: mapInvoiceItemDescription({ billingReason }),
  };
}

function normalizeInvoiceItemKey(itemKey: string): string {
  if (isLegacyKbAddonKey(itemKey)) return 'legacy_kb_storage';
  return itemKey;
}

function buildMatch(itemKey: string, billingReason: string | null): InvoiceItemMatch {
  const normalizedKey = normalizeInvoiceItemKey(itemKey);
  return {
    itemType: resolveInvoiceItemType(normalizedKey),
    itemKey: normalizedKey,
    itemName:
      resolveInvoiceItemName(normalizedKey) ??
      WORKSPACE_ADDON_CATALOG.find((addon) => addon.key === normalizedKey)?.name,
    description: mapInvoiceItemDescription({ itemKey: normalizedKey, billingReason }),
  };
}
export function enrichInvoiceRow<T extends ProviderInvoiceRow>(
  row: T,
  match: InvoiceItemMatch,
  extras?: { source?: InvoiceSource },
): T & InvoiceItemMatch & { source?: InvoiceSource } {
  return {
    ...row,
    ...match,
    source: extras?.source,
  };
}
