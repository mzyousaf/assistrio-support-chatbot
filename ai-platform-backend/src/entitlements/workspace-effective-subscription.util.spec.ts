import {
  isPaidSubscriptionEntitled,
  resolveEffectivePlanKey,
  resolveIsTrialExpiredForEffectivePlan,
} from './workspace-effective-subscription.util';

describe('workspace-effective-subscription.util', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('treats active Starter as entitled', () => {
    expect(
      isPaidSubscriptionEntitled({
        planKey: 'starter',
        status: 'active',
        currentPeriodEnd: new Date('2026-07-01'),
      }),
    ).toBe(true);
    expect(
      resolveEffectivePlanKey(
        { planKey: 'starter', status: 'active', currentPeriodEnd: new Date('2026-07-01') },
        now,
      ),
    ).toBe('starter');
  });

  it('falls back to free when canceled and period ended', () => {
    const sub = {
      planKey: 'pro',
      status: 'canceled' as const,
      currentPeriodEnd: new Date('2026-06-01'),
    };
    expect(isPaidSubscriptionEntitled(sub, now)).toBe(false);
    expect(resolveEffectivePlanKey(sub, now)).toBe('free');
    expect(resolveIsTrialExpiredForEffectivePlan(sub, 'free', now)).toBe(true);
  });

  it('keeps paid entitlements during cancel-at-period-end grace', () => {
    const sub = {
      planKey: 'starter',
      status: 'canceled' as const,
      currentPeriodEnd: new Date('2026-07-01'),
    };
    expect(isPaidSubscriptionEntitled(sub, now)).toBe(true);
    expect(resolveEffectivePlanKey(sub, now)).toBe('starter');
  });
});
