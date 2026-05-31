import type { ApiResult } from '@/api/types';

type CheckoutErrorResult = Extract<ApiResult<unknown>, { ok: false }>;

export type PaidPlanCheckoutKey = 'starter' | 'pro';

export function canUpgradeToPlan(currentPlanKey: string, targetPlanKey: string): boolean {
  if (targetPlanKey === 'free') return false;
  if (targetPlanKey !== 'starter' && targetPlanKey !== 'pro') return false;

  if (targetPlanKey === currentPlanKey) {
    return false;
  }

  if (currentPlanKey === 'pro' && targetPlanKey === 'starter') return false;
  if (currentPlanKey === 'starter' && targetPlanKey === 'starter') return false;
  if (currentPlanKey === 'pro' && targetPlanKey === 'pro') return false;

  return true;
}

export function planCheckoutButtonLabel(
  currentPlanKey: string,
  targetPlanKey: PaidPlanCheckoutKey,
  options?: { isTrialPlan?: boolean },
): string {
  if (targetPlanKey === 'starter') {
    if (currentPlanKey === 'free' || options?.isTrialPlan) return 'Upgrade to Starter';
    return 'Upgrade to Starter';
  }
  if (targetPlanKey === 'pro') {
    return 'Upgrade';
  }
  return 'Upgrade';
}

export function resolvePlanCardCheckoutAction(input: {
  planKey: string;
  currentPlanKey: string;
  isTrialPlan: boolean;
  checkoutAvailable: boolean;
  isOwner: boolean;
}): {
  label: string;
  disabled: boolean;
  canCheckout: boolean;
  canChangePlan: boolean;
} {
  const { planKey, currentPlanKey, isTrialPlan, checkoutAvailable, isOwner } = input;

  if (planKey === 'free') {
    const isCurrent = currentPlanKey === 'free' || (isTrialPlan && currentPlanKey === 'free');
    return {
      label: isCurrent ? 'Current plan' : 'Coming soon',
      disabled: true,
      canCheckout: false,
      canChangePlan: false,
    };
  }

  const isCurrentPaid =
    planKey === currentPlanKey && !(isTrialPlan && currentPlanKey === 'free');

  if (isCurrentPaid) {
    return { label: 'Current plan', disabled: true, canCheckout: false, canChangePlan: false };
  }

  if (currentPlanKey === 'pro' && planKey === 'starter') {
    const enabled = isOwner && checkoutAvailable;
    return {
      label: 'Downgrade to Starter',
      disabled: !enabled,
      canCheckout: false,
      canChangePlan: enabled,
    };
  }

  if (currentPlanKey === 'starter' && planKey === 'pro' && !isTrialPlan) {
    const enabled = isOwner && checkoutAvailable;
    return {
      label: 'Upgrade to Pro',
      disabled: !enabled,
      canCheckout: false,
      canChangePlan: enabled,
    };
  }

  if (!isOwner || !checkoutAvailable) {
    return { label: 'Coming soon', disabled: true, canCheckout: false, canChangePlan: false };
  }

  if (!canUpgradeToPlan(currentPlanKey, planKey)) {
    return { label: 'Coming soon', disabled: true, canCheckout: false, canChangePlan: false };
  }

  return {
    label: planCheckoutButtonLabel(currentPlanKey, planKey as PaidPlanCheckoutKey, { isTrialPlan }),
    disabled: false,
    canCheckout: true,
    canChangePlan: false,
  };
}

export function isBillingCheckoutConfigured(
  planCatalog: Array<{ checkoutAvailable?: boolean }> | undefined,
): boolean {
  return Boolean(planCatalog?.some((p) => p.checkoutAvailable));
}

const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  billing_provider_not_configured: 'Checkout is not configured yet.',
  workspace_owner_required: 'Only the workspace owner can manage billing.',
  billing_paid_plan_required: 'Add-ons are available on paid plans.',
  plan_limit_paid_plan_required: 'Add-ons are available on paid plans.',
  billing_no_active_subscription: 'An active paid subscription is required.',
  billing_cancel_confirmation_required: 'Please confirm cancellation.',
  billing_checkout_required: 'Use checkout to subscribe or upgrade.',
  billing_downgrade_not_allowed: 'Downgrading to Free is not supported in-app.',
  plan_already_active: 'You are already on this plan.',
  billing_provider_action_failed: 'Could not update your subscription. Please try again.',
  billing_plan_change_not_allowed: 'This plan change is not supported.',
  billing_plan_change_required: 'Use plan change to upgrade to Pro.',
  billing_restore_not_allowed: 'This subscription cannot be restored.',
  billing_portal_not_available: 'Billing portal is not available right now.',
};

export function mapBillingPortalError(
  result: CheckoutErrorResult | { ok: false; error?: string; errorCode?: string },
): string {
  return mapBillingCheckoutError(result);
}

export function mapBillingSubscriptionActionError(
  result: CheckoutErrorResult | { ok: false; error?: string; errorCode?: string },
): string {
  return mapBillingCheckoutError(result);
}

export function mapBillingCheckoutError(result: CheckoutErrorResult | { ok: false; error?: string; errorCode?: string }): string {
  const code = result.errorCode?.trim();
  if (code && CHECKOUT_ERROR_MESSAGES[code]) {
    return CHECKOUT_ERROR_MESSAGES[code];
  }
  return result.error?.trim() || 'Could not start checkout. Please try again.';
}

export function isTopUpAddonKey(addonKey: string): boolean {
  return addonKey === 'ai_credits_1000';
}
