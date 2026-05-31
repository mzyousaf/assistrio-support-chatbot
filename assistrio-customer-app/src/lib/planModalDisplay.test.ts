import { describe, expect, it } from 'vitest';
import {
  filterPlansForModal,
  isAllowedBillingAddonKey,
  isKbStorageAddonKey,
  shouldHideFreePlanForCurrentPlan,
  shouldShowHighestPlanPanel,
  shouldShowPlanInModal,
} from '@/lib/planModalDisplay';

describe('planModalDisplay', () => {
  it('hides Free for paid users', () => {
    expect(shouldHideFreePlanForCurrentPlan('starter')).toBe(true);
    expect(shouldHideFreePlanForCurrentPlan('pro')).toBe(true);
    expect(shouldHideFreePlanForCurrentPlan('free')).toBe(false);
  });

  it('upgrade mode on free shows Starter only', () => {
    expect(
      shouldShowPlanInModal('starter', {
        mode: 'upgrade',
        currentPlanKey: 'free',
        isTrialPlan: true,
      }),
    ).toBe(true);
    expect(
      shouldShowPlanInModal('pro', {
        mode: 'upgrade',
        currentPlanKey: 'free',
        isTrialPlan: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPlanInModal('free', {
        mode: 'upgrade',
        currentPlanKey: 'free',
        isTrialPlan: true,
      }),
    ).toBe(false);
  });

  it('upgrade mode on Starter shows Pro only', () => {
    expect(
      filterPlansForModal(
        [
          { key: 'starter', name: 'Starter' },
          { key: 'pro', name: 'Pro' },
        ] as never,
        { mode: 'upgrade', currentPlanKey: 'starter', isTrialPlan: false },
      ).map((plan) => plan.key),
    ).toEqual(['pro']);
  });

  it('billing mode on Pro shows Starter and Pro', () => {
    expect(
      filterPlansForModal(
        [
          { key: 'free', name: 'Free' },
          { key: 'starter', name: 'Starter' },
          { key: 'pro', name: 'Pro' },
        ] as never,
        { mode: 'billing', currentPlanKey: 'pro', isTrialPlan: false },
      ).map((plan) => plan.key),
    ).toEqual(['starter', 'pro']);
  });

  it('billing mode on free hides Pro', () => {
    expect(
      shouldShowPlanInModal('pro', {
        mode: 'billing',
        currentPlanKey: 'free',
        isTrialPlan: true,
      }),
    ).toBe(false);
  });

  it('shows highest plan panel for Pro upgrade mode', () => {
    expect(shouldShowHighestPlanPanel({ mode: 'upgrade', currentPlanKey: 'pro' })).toBe(true);
    expect(shouldShowHighestPlanPanel({ mode: 'billing', currentPlanKey: 'pro' })).toBe(false);
  });

  it('filters KB storage addon keys', () => {
    expect(isKbStorageAddonKey('kb_storage_5mb')).toBe(true);
    expect(isAllowedBillingAddonKey('extra_bot')).toBe(true);
    expect(isAllowedBillingAddonKey('kb_storage_5mb')).toBe(false);
  });
});
