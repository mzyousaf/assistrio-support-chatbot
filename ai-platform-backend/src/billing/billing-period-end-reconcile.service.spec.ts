import { Types } from 'mongoose';
import { BillingPeriodEndReconcileService } from './billing-period-end-reconcile.service';
import { BillingPeriodEndReconcileCron } from './billing-period-end-reconcile.cron';
import {
  countActiveExtraBotAddons,
  isWorkspaceAddonEntitlementActive,
} from '../entitlements/workspace-addon-entitlements.util';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import { mockStarterWorkspaceEntitlements } from '../entitlements/test/workspace-entitlements.fixture';

type SubscriptionDoc = {
  workspaceId: Types.ObjectId;
  planKey: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
  scheduledPlanChange?: {
    fromPlanKey: string;
    toPlanKey: string;
    effectiveAt: Date;
    status: string;
    appliedAt?: Date | null;
  } | null;
};

type AddonDoc = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  addonKey: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd?: boolean;
  expiredAt?: Date | null;
};

type TopUpDoc = {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  creditsRemaining: number;
  expiresAt: Date;
  expiredAt?: Date | null;
};

function matchesScheduledDowngradeQuery(doc: SubscriptionDoc, query: Record<string, unknown>): boolean {
  const scheduled = doc.scheduledPlanChange;
  if (!scheduled) return false;
  if (query['scheduledPlanChange.status'] === 'scheduled' && scheduled.status !== 'scheduled') return false;
  const effectiveAtLte = (query['scheduledPlanChange.effectiveAt'] as { $lte?: Date })?.$lte;
  if (effectiveAtLte && scheduled.effectiveAt > effectiveAtLte) return false;
  return true;
}

function matchesSubscriptionExpiryQuery(doc: SubscriptionDoc, query: Record<string, unknown>): boolean {
  const paidKeys = (query.planKey as { $in?: string[] })?.$in ?? [];
  if (paidKeys.length > 0 && !paidKeys.includes(doc.planKey)) return false;
  const periodEndLte = (query.currentPeriodEnd as { $lte?: Date })?.$lte;
  if (periodEndLte && doc.currentPeriodEnd > periodEndLte) return false;
  const or = query.$or as Array<Record<string, unknown>> | undefined;
  if (!or) return true;
  return or.some((clause) => {
    if ('cancelAtPeriodEnd' in clause) return doc.cancelAtPeriodEnd === clause.cancelAtPeriodEnd;
    const statuses = (clause.status as { $in?: string[] })?.$in;
    if (statuses) return statuses.includes(doc.status);
    return false;
  });
}

function matchesAddonExpiryQuery(doc: AddonDoc, query: Record<string, unknown>): boolean {
  if (query._id && String(doc._id) !== String(query._id)) return false;
  const statuses = (query.status as { $in?: string[] })?.$in ?? [];
  if (statuses.length > 0 && !statuses.includes(doc.status)) return false;
  const periodEnd = query.currentPeriodEnd as { $lte?: Date; $ne?: null } | undefined;
  if (periodEnd?.$lte && (!doc.currentPeriodEnd || doc.currentPeriodEnd > periodEnd.$lte)) return false;
  const or = query.$or as Array<Record<string, unknown>> | undefined;
  if (!or) return true;
  return or.some((clause) => {
    if ('cancelAtPeriodEnd' in clause) return doc.cancelAtPeriodEnd === clause.cancelAtPeriodEnd;
    if (clause.status === 'cancelled') return doc.status === 'cancelled';
    return false;
  });
}

function matchesTopUpExpiryQuery(doc: TopUpDoc, query: Record<string, unknown>): boolean {
  if (query._id && String(doc._id) !== String(query._id)) return false;
  const expiresAtLte = (query.expiresAt as { $lte?: Date })?.$lte;
  if (expiresAtLte && doc.expiresAt > expiresAtLte) return false;
  const creditsGt = (query.creditsRemaining as { $gt?: number })?.$gt;
  if (creditsGt != null && doc.creditsRemaining <= creditsGt) return false;
  if ('expiredAt' in query && query.expiredAt === null && doc.expiredAt != null) return false;
  return true;
}

function createInMemoryReconcileHarness(
  subscriptions: SubscriptionDoc[],
  addons: AddonDoc[],
  topUps: TopUpDoc[],
) {
  const subscriptionModel = {
    find: jest.fn((query: Record<string, unknown>) => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn(async () => {
            if ('scheduledPlanChange.status' in query) {
              return subscriptions.filter((doc) => matchesScheduledDowngradeQuery(doc, query));
            }
            return subscriptions.filter((doc) => matchesSubscriptionExpiryQuery(doc, query));
          }),
        })),
      })),
    })),
    updateOne: jest.fn(async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const idx = subscriptions.findIndex((doc) => {
        if ('scheduledPlanChange.status' in filter) return matchesScheduledDowngradeQuery(doc, filter);
        return matchesSubscriptionExpiryQuery(doc, filter) && doc.workspaceId.equals(filter.workspaceId as Types.ObjectId);
      });
      if (idx === -1) return { modifiedCount: 0 };
      subscriptions[idx] = { ...subscriptions[idx], ...update.$set } as SubscriptionDoc;
      if (update.$set.scheduledPlanChange) {
        subscriptions[idx].scheduledPlanChange = update.$set.scheduledPlanChange as SubscriptionDoc['scheduledPlanChange'];
      }
      return { modifiedCount: 1 };
    }),
  };

  const addonModel = {
    find: jest.fn((query: Record<string, unknown>) => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn(async () => addons.filter((doc) => matchesAddonExpiryQuery(doc, query))),
        })),
      })),
    })),
    updateOne: jest.fn(async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const idx = addons.findIndex((doc) => matchesAddonExpiryQuery(doc, filter));
      if (idx === -1) return { modifiedCount: 0 };
      addons[idx] = { ...addons[idx], ...update.$set } as AddonDoc;
      return { modifiedCount: 1 };
    }),
  };

  const topUpModel = {
    find: jest.fn((query: Record<string, unknown>) => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn(async () => topUps.filter((doc) => matchesTopUpExpiryQuery(doc, query))),
        })),
      })),
    })),
    updateOne: jest.fn(async (filter: Record<string, unknown>, update: { $set: Record<string, unknown> }) => {
      const idx = topUps.findIndex((doc) => matchesTopUpExpiryQuery(doc, filter));
      if (idx === -1) return { modifiedCount: 0 };
      topUps[idx] = { ...topUps[idx], ...update.$set } as TopUpDoc;
      return { modifiedCount: 1 };
    }),
  };

  const memberOverLimitReconcileService = {
    reconcileWorkspaceMembersAgainstLimit: jest.fn().mockResolvedValue({
      activeKept: 5,
      deactivated: 0,
      reactivated: 0,
    }),
  };

  const service = new BillingPeriodEndReconcileService(
    subscriptionModel as never,
    addonModel as never,
    topUpModel as never,
    memberOverLimitReconcileService as never,
  );

  return { service, subscriptions, addons, topUps, memberOverLimitReconcileService };
}

describe('BillingPeriodEndReconcileService', () => {
  const workspaceId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('calls member reconcile after scheduled downgrade is applied', async () => {
    const { service, memberOverLimitReconcileService } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'active',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-06-15'),
          scheduledPlanChange: {
            fromPlanKey: 'pro',
            toPlanKey: 'starter',
            effectiveAt: new Date('2026-06-15T00:00:00.000Z'),
            status: 'scheduled',
          },
        },
      ],
      [],
      [],
    );

    memberOverLimitReconcileService.reconcileWorkspaceMembersAgainstLimit.mockResolvedValue({
      activeKept: 5,
      deactivated: 5,
      reactivated: 0,
    });

    const stats = await service.reconcile(now);

    expect(stats.scheduledDowngradesApplied).toBe(1);
    expect(stats.membersDeactivated).toBe(5);
    expect(memberOverLimitReconcileService.reconcileWorkspaceMembersAgainstLimit).toHaveBeenCalledWith(
      String(workspaceId),
      expect.objectContaining({ now }),
    );
  });

  it('applies scheduled downgrade when effectiveAt is due', async () => {
    const { service, subscriptions } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'active',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-06-15'),
          scheduledPlanChange: {
            fromPlanKey: 'pro',
            toPlanKey: 'starter',
            effectiveAt: new Date('2026-06-15T00:00:00.000Z'),
            status: 'scheduled',
          },
        },
      ],
      [],
      [],
    );

    const stats = await service.reconcile(now);

    expect(stats.scheduledDowngradesApplied).toBe(1);
    expect(subscriptions[0].planKey).toBe('starter');
    expect(subscriptions[0].scheduledPlanChange?.status).toBe('applied');
    expect(subscriptions[0].scheduledPlanChange?.appliedAt).toEqual(now);
  });

  it('does not apply scheduled downgrade before effectiveAt', async () => {
    const { service, subscriptions } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'active',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-07-01'),
          scheduledPlanChange: {
            fromPlanKey: 'pro',
            toPlanKey: 'starter',
            effectiveAt: new Date('2026-07-01T00:00:00.000Z'),
            status: 'scheduled',
          },
        },
      ],
      [],
      [],
    );

    const stats = await service.reconcile(now);

    expect(stats.scheduledDowngradesApplied).toBe(0);
    expect(subscriptions[0].planKey).toBe('pro');
    expect(subscriptions[0].scheduledPlanChange?.status).toBe('scheduled');
  });

  it('does not expire canceled subscription before period end', async () => {
    const { service, subscriptions } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'canceled',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-07-01'),
          cancelAtPeriodEnd: true,
        },
      ],
      [],
      [],
    );

    const stats = await service.reconcile(now);

    expect(stats.subscriptionsExpired).toBe(0);
    expect(subscriptions[0].planKey).toBe('pro');
  });

  it('expires canceled subscription after period end to free trialing', async () => {
    const { service, subscriptions } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'canceled',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-06-01'),
          cancelAtPeriodEnd: true,
        },
      ],
      [],
      [],
    );

    const stats = await service.reconcile(now);

    expect(stats.subscriptionsExpired).toBe(1);
    expect(subscriptions[0].planKey).toBe('free');
    expect(subscriptions[0].status).toBe('trialing');
    expect(subscriptions[0].cancelAtPeriodEnd).toBe(false);
  });

  it('keeps extra_bot active before addon period end when cancelled', async () => {
    const periodEnd = new Date('2026-07-01T00:00:00.000Z');
    const addon: AddonDoc = {
      _id: new Types.ObjectId(),
      workspaceId,
      addonKey: 'extra_bot',
      status: 'cancelled',
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: true,
    };

    expect(isWorkspaceAddonEntitlementActive(addon, now)).toBe(true);
    expect(countActiveExtraBotAddons([addon], now)).toBe(1);
  });

  it('expires extra_bot after period end and drops bot entitlement count', async () => {
    const addonId = new Types.ObjectId();
    const periodEnd = new Date('2026-06-01T00:00:00.000Z');
    const { service, addons } = createInMemoryReconcileHarness(
      [],
      [
        {
          _id: addonId,
          workspaceId,
          addonKey: 'extra_bot',
          status: 'cancelled',
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: true,
        },
      ],
      [],
    );

    const stats = await service.reconcile(now);

    expect(stats.addonsExpired).toBe(1);
    expect(addons[0].status).toBe('expired');
    expect(addons[0].expiredAt).toEqual(now);
    expect(isWorkspaceAddonEntitlementActive(addons[0], now)).toBe(false);
    expect(countActiveExtraBotAddons([addons[0]], now)).toBe(0);
  });

  it('expires remove_branding addon after period end', async () => {
    const { service, addons } = createInMemoryReconcileHarness(
      [],
      [
        {
          _id: new Types.ObjectId(),
          workspaceId,
          addonKey: 'remove_branding',
          status: 'active',
          currentPeriodEnd: new Date('2026-06-01'),
          cancelAtPeriodEnd: true,
        },
      ],
      [],
    );

    const stats = await service.reconcile(now);

    expect(stats.addonsExpired).toBe(1);
    expect(addons[0].status).toBe('expired');
    expect(isWorkspaceAddonEntitlementActive(addons[0], now)).toBe(false);
  });

  it('marks expired top-up with expiredAt without deleting credits', async () => {
    const topUpId = new Types.ObjectId();
    const { service, topUps } = createInMemoryReconcileHarness(
      [],
      [],
      [
        {
          _id: topUpId,
          workspaceId,
          creditsRemaining: 500,
          expiresAt: new Date('2026-06-01'),
          expiredAt: null,
        },
      ],
    );

    const stats = await service.reconcile(now);

    expect(stats.topupsExpired).toBe(1);
    expect(topUps[0].expiredAt).toEqual(now);
    expect(topUps[0].creditsRemaining).toBe(500);
  });

  it('is idempotent on second run', async () => {
    const { service } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'canceled',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-06-01'),
          cancelAtPeriodEnd: true,
          scheduledPlanChange: {
            fromPlanKey: 'pro',
            toPlanKey: 'starter',
            effectiveAt: new Date('2026-06-01'),
            status: 'scheduled',
          },
        },
      ],
      [
        {
          _id: new Types.ObjectId(),
          workspaceId,
          addonKey: 'extra_bot',
          status: 'cancelled',
          currentPeriodEnd: new Date('2026-06-01'),
          cancelAtPeriodEnd: true,
        },
      ],
      [
        {
          _id: new Types.ObjectId(),
          workspaceId,
          creditsRemaining: 100,
          expiresAt: new Date('2026-06-01'),
          expiredAt: null,
        },
      ],
    );

    const first = await service.reconcile(now);
    expect(first.scheduledDowngradesApplied + first.subscriptionsExpired + first.addonsExpired + first.topupsExpired).toBeGreaterThan(0);

    const second = await service.reconcile(now);
    expect(second).toMatchObject({
      scheduledDowngradesApplied: 0,
      subscriptionsExpired: 0,
      addonsExpired: 0,
      topupsExpired: 0,
      errors: 0,
    });
  });

  it('continues after per-item failure', async () => {
    const subscriptionModel = {
      find: jest.fn((query: Record<string, unknown>) => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn(async () => {
              if ('scheduledPlanChange.status' in query) {
                return [
                  {
                    workspaceId,
                    scheduledPlanChange: {
                      fromPlanKey: 'pro',
                      toPlanKey: 'starter',
                      effectiveAt: new Date('2026-06-01'),
                      status: 'scheduled',
                    },
                  },
                ];
              }
              return [];
            }),
          })),
        })),
      })),
      updateOne: jest.fn().mockRejectedValue(new Error('db unavailable')),
    };
    const addonModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({ exec: jest.fn(async () => []) })),
        })),
      })),
      updateOne: jest.fn(),
    };
    const topUpModel = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({
          lean: jest.fn(() => ({ exec: jest.fn(async () => []) })),
        })),
      })),
      updateOne: jest.fn(),
    };

    const memberOverLimitReconcileService = {
      reconcileWorkspaceMembersAgainstLimit: jest.fn().mockResolvedValue({
        activeKept: 0,
        deactivated: 0,
        reactivated: 0,
      }),
    };

    const service = new BillingPeriodEndReconcileService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      memberOverLimitReconcileService as never,
    );

    const stats = await service.reconcile(now);
    expect(stats.errors).toBe(1);
    expect(stats.scheduledDowngradesApplied).toBe(0);
  });

  it('post-reconcile subscription yields free expired entitlements', async () => {
    const { service, subscriptions } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'starter',
          status: 'canceled',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-06-01'),
          cancelAtPeriodEnd: true,
        },
      ],
      [],
      [],
    );

    await service.reconcile(now);

    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(subscriptions[0]),
      applyPendingScheduledPlanChanges: jest.fn().mockImplementation(async () => subscriptions[0]),
    } as unknown as WorkspaceSubscriptionsService;

    const entitlementsService = new WorkspaceEntitlementsService(
      subscriptionsService,
      { sumRemainingCredits: jest.fn().mockResolvedValue(250) } as never,
      { find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) }) } as never,
      { reconcileIfNeeded: jest.fn().mockResolvedValue(null) } as never,
    );

    const entitlements = await entitlementsService.resolveForWorkspace(String(workspaceId), now);

    expect(entitlements.planKey).toBe('free');
    expect(entitlements.isTrialExpired).toBe(true);
    expect(entitlements.topUpCreditsRemaining).toBe(250);
  });

  it('starter limits apply after scheduled downgrade for entitlements baseline', async () => {
    const { service, subscriptions } = createInMemoryReconcileHarness(
      [
        {
          workspaceId,
          planKey: 'pro',
          status: 'active',
          currentPeriodStart: new Date('2026-05-01'),
          currentPeriodEnd: new Date('2026-06-15'),
          scheduledPlanChange: {
            fromPlanKey: 'pro',
            toPlanKey: 'starter',
            effectiveAt: new Date('2026-06-15T00:00:00.000Z'),
            status: 'scheduled',
          },
        },
      ],
      [],
      [],
    );

    await service.reconcile(now);

    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(subscriptions[0]),
      applyPendingScheduledPlanChanges: jest.fn().mockImplementation(async () => subscriptions[0]),
    } as unknown as WorkspaceSubscriptionsService;

    const entitlementsService = new WorkspaceEntitlementsService(
      subscriptionsService,
      { sumRemainingCredits: jest.fn().mockResolvedValue(0) } as never,
      { find: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) }) } as never,
      { reconcileIfNeeded: jest.fn().mockResolvedValue(null) } as never,
    );

    const entitlements = await entitlementsService.resolveForWorkspace(String(workspaceId), now);
    const starter = mockStarterWorkspaceEntitlements({ workspaceId: String(workspaceId) });

    expect(entitlements.planKey).toBe('starter');
    expect(entitlements.memberLimit).toBe(starter.memberLimit);
    expect(entitlements.monthlyAiCredits).toBe(starter.monthlyAiCredits);
  });
});

describe('BillingPeriodEndReconcileCron', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  function createCron(appMode: string, enableFlag?: string) {
    process.env.APP_MODE = appMode;
    if (enableFlag !== undefined) process.env.ENABLE_BILLING_RECONCILE_CRON = enableFlag;
    else delete process.env.ENABLE_BILLING_RECONCILE_CRON;

    const reconcileService = {
      reconcile: jest.fn().mockResolvedValue({
        scheduledDowngradesApplied: 0,
        subscriptionsExpired: 0,
        addonsExpired: 0,
        topupsExpired: 0,
        membersDeactivated: 0,
        membersReactivated: 0,
        errors: 0,
        durationMs: 1,
      }),
    };

    const cron = new BillingPeriodEndReconcileCron(reconcileService as never);
    return { cron, reconcile: reconcileService.reconcile };
  }

  it('runs reconcile in APP_MODE=all', async () => {
    const { cron, reconcile } = createCron('all');
    await cron.runBillingPeriodEndReconcileCron();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('runs reconcile in APP_MODE=worker', async () => {
    const { cron, reconcile } = createCron('worker');
    await cron.runBillingPeriodEndReconcileCron();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('does not run in APP_MODE=runtime', async () => {
    const { cron, reconcile } = createCron('runtime');
    await cron.runBillingPeriodEndReconcileCron();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('does not run in APP_MODE=api', async () => {
    const { cron, reconcile } = createCron('api');
    await cron.runBillingPeriodEndReconcileCron();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('respects ENABLE_BILLING_RECONCILE_CRON=false in all mode', async () => {
    const { cron, reconcile } = createCron('all', 'false');
    await cron.runBillingPeriodEndReconcileCron();
    expect(reconcile).not.toHaveBeenCalled();
  });
});
