import { describe, expect, it } from 'vitest';
import {
  canUpgradeToPlan,
  mapBillingCheckoutError,
  mapBillingSubscriptionActionError,
  planCheckoutButtonLabel,
  resolvePlanCardCheckoutAction,
} from './billingCheckout';

describe('billingCheckout', () => {
  it('allows free trial upgrades to paid plans only', () => {
    expect(canUpgradeToPlan('free', 'starter')).toBe(true);
    expect(canUpgradeToPlan('free', 'pro')).toBe(true);
    expect(canUpgradeToPlan('free', 'free')).toBe(false);
    expect(canUpgradeToPlan('starter', 'pro')).toBe(true);
    expect(canUpgradeToPlan('pro', 'starter')).toBe(false);
  });

  it('resolves upgrade button labels', () => {
    expect(planCheckoutButtonLabel('free', 'starter', { isTrialPlan: true })).toBe('Upgrade to Starter');
    expect(planCheckoutButtonLabel('free', 'pro', { isTrialPlan: true })).toBe('Upgrade to Pro');
    expect(planCheckoutButtonLabel('starter', 'pro')).toBe('Upgrade to Pro');
  });

  it('enables owner checkout when checkoutAvailable', () => {
    const action = resolvePlanCardCheckoutAction({
      planKey: 'starter',
      currentPlanKey: 'free',
      isTrialPlan: true,
      checkoutAvailable: true,
      isOwner: true,
    });
    expect(action.canCheckout).toBe(true);
    expect(action.label).toBe('Upgrade to Starter');
    expect(action.disabled).toBe(false);
  });

  it('offers in-app downgrade from Pro to Starter for owner', () => {
    const action = resolvePlanCardCheckoutAction({
      planKey: 'starter',
      currentPlanKey: 'pro',
      isTrialPlan: false,
      checkoutAvailable: true,
      isOwner: true,
    });
    expect(action.canChangePlan).toBe(true);
    expect(action.canCheckout).toBe(false);
    expect(action.label).toBe('Downgrade to Starter');
  });

  it('disables downgrade for non-owner', () => {
    const action = resolvePlanCardCheckoutAction({
      planKey: 'starter',
      currentPlanKey: 'pro',
      isTrialPlan: false,
      checkoutAvailable: true,
      isOwner: false,
    });
    expect(action.canChangePlan).toBe(false);
    expect(action.disabled).toBe(true);
  });

  it('maps billing checkout error codes', () => {
    expect(
      mapBillingCheckoutError({ ok: false, status: 503, error: 'x', errorCode: 'billing_provider_not_configured' }),
    ).toBe('Checkout is not configured yet.');
    expect(
      mapBillingCheckoutError({ ok: false, status: 403, error: 'x', errorCode: 'workspace_owner_required' }),
    ).toBe('Only the workspace owner can manage billing.');
    expect(
      mapBillingSubscriptionActionError({
        ok: false,
        status: 400,
        error: 'Cancellation must be confirmed.',
        errorCode: 'billing_cancel_confirmation_required',
      }),
    ).toBe('Please confirm cancellation.');
  });
});
