import type { PlanKey } from '../entitlements/plan-catalog';

const BILLABLE_PLAN_KEYS = new Set<PlanKey>(['starter', 'pro']);

const MAIN_PLAN_INVOICE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
]);

export type MainPlanSubscriptionIdSource =
  | 'subscription'
  | 'billing_order'
  | 'customer_lookup'
  | 'none';

export function resolveMainPlanProviderSubscriptionId(input: {
  subscriptionProviderSubscriptionId?: string | null;
  addonSubscriptionIds: Set<string>;
  planOrderProviderSubscriptionIds: string[];
}): {
  id: string;
  source: MainPlanSubscriptionIdSource;
  skippedReason?: string;
} {
  const fromSubscription = String(input.subscriptionProviderSubscriptionId ?? '').trim();
  if (fromSubscription && !input.addonSubscriptionIds.has(fromSubscription)) {
    return { id: fromSubscription, source: 'subscription' };
  }

  for (const candidate of input.planOrderProviderSubscriptionIds) {
    const trimmed = String(candidate ?? '').trim();
    if (trimmed && !input.addonSubscriptionIds.has(trimmed)) {
      return { id: trimmed, source: 'billing_order' };
    }
  }

  if (fromSubscription && input.addonSubscriptionIds.has(fromSubscription)) {
    return {
      id: '',
      source: 'none',
      skippedReason: 'subscription_id_matches_addon',
    };
  }

  return {
    id: '',
    source: 'none',
    skippedReason: 'missing_provider_subscription_id',
  };
}

export function shouldFetchMainPlanInvoices(input: {
  provider?: string | null;
  planKey?: PlanKey | string | null;
  status?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodEnd?: Date | null;
  planSubscriptionId?: string | null;
  now?: Date;
}): { eligible: boolean; skippedReason?: string } {
  const planSubscriptionId = String(input.planSubscriptionId ?? '').trim();
  if (!planSubscriptionId) {
    return { eligible: false, skippedReason: 'missing_provider_subscription_id' };
  }

  if (input.provider !== 'lemon_squeezy') {
    return { eligible: false, skippedReason: 'provider_not_lemon_squeezy' };
  }

  const planKey = String(input.planKey ?? '').trim();
  if (!BILLABLE_PLAN_KEYS.has(planKey as PlanKey)) {
    return { eligible: false, skippedReason: 'plan_key_not_billable' };
  }

  const status = String(input.status ?? '').trim().toLowerCase();
  if (status && status !== 'free' && !MAIN_PLAN_INVOICE_STATUSES.has(status)) {
    return { eligible: false, skippedReason: `status_not_eligible:${status}` };
  }

  const now = input.now ?? new Date();
  const periodEnd = input.currentPeriodEnd;
  if (
    status === 'canceled' &&
    !input.cancelAtPeriodEnd &&
    periodEnd &&
    periodEnd.getTime() <= now.getTime()
  ) {
    // Still list historical invoices after cancellation.
    return { eligible: true };
  }

  return { eligible: true };
}
