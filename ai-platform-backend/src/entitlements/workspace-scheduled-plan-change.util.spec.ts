import {
  resolveActiveScheduledPlanChangeForSummary,
  resolveEntitlementPlanKey,
  shouldApplyScheduledPlanChange,
} from './workspace-scheduled-plan-change.util';

describe('workspace-scheduled-plan-change.util', () => {
  const now = new Date('2026-06-15T00:00:00.000Z');

  it('keeps Pro entitlements before scheduled downgrade effectiveAt', () => {
    const planKey = resolveEntitlementPlanKey(
      {
        planKey: 'pro',
        scheduledPlanChange: {
          fromPlanKey: 'pro',
          toPlanKey: 'starter',
          effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'scheduled',
        },
      },
      now,
    );
    expect(planKey).toBe('pro');
  });

  it('uses Starter entitlements after scheduled downgrade effectiveAt', () => {
    const planKey = resolveEntitlementPlanKey(
      {
        planKey: 'pro',
        scheduledPlanChange: {
          fromPlanKey: 'pro',
          toPlanKey: 'starter',
          effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
          status: 'scheduled',
        },
      },
      new Date('2026-06-02T00:00:00.000Z'),
    );
    expect(planKey).toBe('starter');
  });

  it('detects pending apply after effectiveAt', () => {
    const pending = shouldApplyScheduledPlanChange(
      {
        scheduledPlanChange: {
          fromPlanKey: 'pro',
          toPlanKey: 'starter',
          effectiveAt: new Date('2026-06-01T00:00:00.000Z'),
          status: 'scheduled',
        },
      },
      new Date('2026-06-02T00:00:00.000Z'),
    );
    expect(pending?.toPlanKey).toBe('starter');
  });

  it('returns scheduled change for billing summary before effectiveAt', () => {
    const scheduled = resolveActiveScheduledPlanChangeForSummary(
      {
        scheduledPlanChange: {
          fromPlanKey: 'pro',
          toPlanKey: 'starter',
          effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'scheduled',
        },
      },
      now,
    );
    expect(scheduled?.toPlanKey).toBe('starter');
  });
});
