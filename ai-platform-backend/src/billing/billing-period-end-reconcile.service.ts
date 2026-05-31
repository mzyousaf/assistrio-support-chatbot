import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { PlanKey } from '../entitlements/plan-catalog';
import { WorkspaceMemberOverLimitReconcileService } from '../entitlements/workspace-member-over-limit-reconcile.service';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { WorkspaceCreditTopUp } from '../models/workspace-credit-top-up.schema';
import { WorkspaceSubscription } from '../models/workspace-subscription.schema';
import {
  logBillingReconcileAddonExpired,
  logBillingReconcileCompleted,
  logBillingReconcileItemError,
  logBillingReconcileScheduledDowngradeApplied,
  logBillingReconcileScheduledPlanIntervalChangesApplied,
  logBillingReconcileScheduledAddonIntervalChangesApplied,
  logBillingReconcileStarted,
  logBillingReconcileSubscriptionExpired,
  logBillingReconcileTopUpExpired,
  logBillingReconcileMembersAdjusted,
} from './billing-reconcile-log.util';

const PAID_PLAN_KEYS: readonly PlanKey[] = ['starter', 'pro'];

export type BillingPeriodEndReconcileStats = {
  scheduledDowngradesApplied: number;
  scheduledPlanIntervalChangesApplied: number;
  scheduledAddonIntervalChangesApplied: number;
  subscriptionsExpired: number;
  addonsExpired: number;
  topupsExpired: number;
  membersDeactivated: number;
  membersReactivated: number;
  errors: number;
  durationMs: number;
};

type ReconcileCounters = Omit<BillingPeriodEndReconcileStats, 'durationMs'>;

function reconcileErrorReason(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

@Injectable()
export class BillingPeriodEndReconcileService {
  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    @InjectModel(WorkspaceCreditTopUp.name)
    private readonly topUpModel: Model<WorkspaceCreditTopUp>,
    private readonly memberOverLimitReconcileService: WorkspaceMemberOverLimitReconcileService,
  ) {}

  async reconcile(now: Date = new Date()): Promise<BillingPeriodEndReconcileStats> {
    const t0 = Date.now();
    logBillingReconcileStarted({ at: now.toISOString() });

    const counters: ReconcileCounters = {
      scheduledDowngradesApplied: 0,
      scheduledPlanIntervalChangesApplied: 0,
      scheduledAddonIntervalChangesApplied: 0,
      subscriptionsExpired: 0,
      addonsExpired: 0,
      topupsExpired: 0,
      membersDeactivated: 0,
      membersReactivated: 0,
      errors: 0,
    };

    const memberReconcileWorkspaceIds = new Set<string>();

    counters.scheduledDowngradesApplied = await this.reconcileScheduledPlanDowngrades(
      now,
      counters,
      memberReconcileWorkspaceIds,
    );
    counters.subscriptionsExpired = await this.reconcileEndedSubscriptions(
      now,
      counters,
      memberReconcileWorkspaceIds,
    );
    counters.addonsExpired = await this.reconcileExpiredAddons(now, counters);
    counters.scheduledAddonIntervalChangesApplied = await this.reconcileScheduledAddonIntervalChanges(
      now,
      counters,
    );
    counters.topupsExpired = await this.reconcileExpiredTopUps(now, counters);

    await this.reconcileMembersForWorkspaces(memberReconcileWorkspaceIds, now, counters);

    const durationMs = Date.now() - t0;
    logBillingReconcileCompleted({ durationMs, ...counters });
    return { durationMs, ...counters };
  }

  private async reconcileMembersForWorkspaces(
    workspaceIds: Set<string>,
    now: Date,
    counters: ReconcileCounters,
  ): Promise<void> {
    for (const workspaceId of workspaceIds) {
      try {
        const result = await this.memberOverLimitReconcileService.reconcileWorkspaceMembersAgainstLimit(
          workspaceId,
          { now },
        );
        counters.membersDeactivated += result.deactivated;
        counters.membersReactivated += result.reactivated;
        if (result.deactivated > 0 || result.reactivated > 0) {
          logBillingReconcileMembersAdjusted(workspaceId, {
            members_deactivated_count: result.deactivated,
            members_reactivated_count: result.reactivated,
            activeKept: result.activeKept,
          });
        }
      } catch (err) {
        counters.errors += 1;
        logBillingReconcileItemError('member_over_limit', workspaceId, reconcileErrorReason(err));
      }
    }
  }

  private async reconcileScheduledPlanDowngrades(
    now: Date,
    counters: ReconcileCounters,
    memberReconcileWorkspaceIds: Set<string>,
  ): Promise<number> {
    const due = await this.subscriptionModel
      .find({
        'scheduledPlanChange.status': 'scheduled',
        'scheduledPlanChange.effectiveAt': { $lte: now },
      })
      .select('workspaceId scheduledPlanChange planKey')
      .lean()
      .exec();

    let applied = 0;
    for (const row of due) {
      const workspaceId = String(row.workspaceId ?? '');
      const scheduled = row.scheduledPlanChange;
      if (!scheduled || scheduled.status !== 'scheduled') continue;

      try {
        const effectiveAt =
          scheduled.effectiveAt instanceof Date
            ? scheduled.effectiveAt
            : new Date(scheduled.effectiveAt);
        if (Number.isNaN(effectiveAt.getTime()) || effectiveAt > now) continue;

        const result = await this.subscriptionModel.updateOne(
          {
            workspaceId: row.workspaceId,
            'scheduledPlanChange.status': 'scheduled',
            'scheduledPlanChange.effectiveAt': { $lte: now },
          },
          {
            $set: {
              planKey: scheduled.toPlanKey,
              ...(scheduled.toBillingInterval ? { billingInterval: scheduled.toBillingInterval } : {}),
              scheduledPlanChange: {
                fromPlanKey: scheduled.fromPlanKey,
                toPlanKey: scheduled.toPlanKey,
                fromBillingInterval: scheduled.fromBillingInterval ?? null,
                toBillingInterval: scheduled.toBillingInterval ?? null,
                effectiveAt,
                status: 'applied',
                appliedAt: now,
              },
            },
          },
        );

        if (result.modifiedCount > 0) {
          applied += 1;
          memberReconcileWorkspaceIds.add(workspaceId);
          const intervalOnly =
            scheduled.fromPlanKey === scheduled.toPlanKey &&
            scheduled.fromBillingInterval &&
            scheduled.toBillingInterval &&
            scheduled.fromBillingInterval !== scheduled.toBillingInterval;
          if (intervalOnly) {
            counters.scheduledPlanIntervalChangesApplied += 1;
            logBillingReconcileScheduledPlanIntervalChangesApplied(workspaceId, {
              fromBillingInterval: scheduled.fromBillingInterval,
              toBillingInterval: scheduled.toBillingInterval,
              effectiveAt: effectiveAt.toISOString(),
            });
          } else {
            logBillingReconcileScheduledDowngradeApplied(workspaceId, {
              fromPlanKey: scheduled.fromPlanKey,
              toPlanKey: scheduled.toPlanKey,
              effectiveAt: effectiveAt.toISOString(),
            });
          }
        }
      } catch (err) {
        counters.errors += 1;
        logBillingReconcileItemError('scheduled_downgrade', workspaceId, reconcileErrorReason(err));
      }
    }

    return applied;
  }

  private async reconcileEndedSubscriptions(
    now: Date,
    counters: ReconcileCounters,
    memberReconcileWorkspaceIds: Set<string>,
  ): Promise<number> {
    const due = await this.subscriptionModel
      .find({
        planKey: { $in: PAID_PLAN_KEYS },
        currentPeriodEnd: { $lte: now },
        $or: [
          { cancelAtPeriodEnd: true },
          { status: { $in: ['canceled', 'unpaid'] } },
        ],
      })
      .select('workspaceId planKey status cancelAtPeriodEnd currentPeriodEnd')
      .lean()
      .exec();

    let expired = 0;
    for (const row of due) {
      const workspaceId = String(row.workspaceId ?? '');
      try {
        const result = await this.subscriptionModel.updateOne(
          {
            workspaceId: row.workspaceId,
            planKey: { $in: PAID_PLAN_KEYS },
            currentPeriodEnd: { $lte: now },
            $or: [
              { cancelAtPeriodEnd: true },
              { status: { $in: ['canceled', 'unpaid'] } },
            ],
          },
          {
            $set: {
              planKey: 'free',
              status: 'trialing',
              cancelAtPeriodEnd: false,
            },
          },
        );

        if (result.modifiedCount > 0) {
          expired += 1;
          memberReconcileWorkspaceIds.add(workspaceId);
          logBillingReconcileSubscriptionExpired(workspaceId, {
            previousPlanKey: row.planKey,
            previousStatus: row.status,
            currentPeriodEnd:
              row.currentPeriodEnd instanceof Date
                ? row.currentPeriodEnd.toISOString()
                : String(row.currentPeriodEnd),
          });
        }
      } catch (err) {
        counters.errors += 1;
        logBillingReconcileItemError('subscription_expired', workspaceId, reconcileErrorReason(err));
      }
    }

    return expired;
  }

  private async reconcileExpiredAddons(now: Date, counters: ReconcileCounters): Promise<number> {
    const due = await this.addonModel
      .find({
        status: { $in: ['active', 'past_due', 'cancelled'] },
        currentPeriodEnd: { $lte: now, $ne: null },
        $or: [{ cancelAtPeriodEnd: true }, { status: 'cancelled' }],
      })
      .select('_id workspaceId addonKey status cancelAtPeriodEnd currentPeriodEnd')
      .lean()
      .exec();

    let expired = 0;
    for (const row of due) {
      const workspaceId = String(row.workspaceId ?? '');
      const addonId = String(row._id ?? '');
      try {
        const result = await this.addonModel.updateOne(
          {
            _id: row._id,
            status: { $in: ['active', 'past_due', 'cancelled'] },
            currentPeriodEnd: { $lte: now, $ne: null },
            $or: [{ cancelAtPeriodEnd: true }, { status: 'cancelled' }],
          },
          {
            $set: {
              status: 'expired',
              cancelAtPeriodEnd: false,
              expiredAt: now,
            },
          },
        );

        if (result.modifiedCount > 0) {
          expired += 1;
          logBillingReconcileAddonExpired(workspaceId, addonId, {
            addonKey: row.addonKey,
            previousStatus: row.status,
          });
        }
      } catch (err) {
        counters.errors += 1;
        logBillingReconcileItemError('addon_expired', workspaceId, reconcileErrorReason(err), {
          addonId,
        });
      }
    }

    return expired;
  }

  private async reconcileScheduledAddonIntervalChanges(
    now: Date,
    counters: ReconcileCounters,
  ): Promise<number> {
    const due = await this.addonModel
      .find({
        'scheduledIntervalChange.status': 'scheduled',
        'scheduledIntervalChange.effectiveAt': { $lte: now },
      })
      .select('_id workspaceId scheduledIntervalChange billingInterval')
      .lean()
      .exec();

    let applied = 0;
    for (const row of due) {
      const workspaceId = String(row.workspaceId ?? '');
      const addonId = String(row._id ?? '');
      const scheduled = row.scheduledIntervalChange;
      if (!scheduled || scheduled.status !== 'scheduled') continue;

      try {
        const effectiveAt =
          scheduled.effectiveAt instanceof Date
            ? scheduled.effectiveAt
            : new Date(scheduled.effectiveAt);
        if (Number.isNaN(effectiveAt.getTime()) || effectiveAt > now) continue;

        const result = await this.addonModel.updateOne(
          {
            _id: row._id,
            'scheduledIntervalChange.status': 'scheduled',
            'scheduledIntervalChange.effectiveAt': { $lte: now },
          },
          {
            $set: {
              billingInterval: scheduled.toBillingInterval,
              scheduledIntervalChange: {
                fromBillingInterval: scheduled.fromBillingInterval,
                toBillingInterval: scheduled.toBillingInterval,
                effectiveAt,
                status: 'applied',
                appliedAt: now,
              },
            },
          },
        );

        if (result.modifiedCount > 0) {
          applied += 1;
          logBillingReconcileScheduledAddonIntervalChangesApplied(workspaceId, addonId, {
            fromBillingInterval: scheduled.fromBillingInterval,
            toBillingInterval: scheduled.toBillingInterval,
            effectiveAt: effectiveAt.toISOString(),
          });
        }
      } catch (err) {
        counters.errors += 1;
        logBillingReconcileItemError('scheduled_addon_interval', workspaceId, reconcileErrorReason(err), {
          addonId,
        });
      }
    }

    return applied;
  }

  private async reconcileExpiredTopUps(now: Date, counters: ReconcileCounters): Promise<number> {
    const due = await this.topUpModel
      .find({
        expiresAt: { $lte: now },
        creditsRemaining: { $gt: 0 },
        expiredAt: null,
      })
      .select('_id workspaceId creditsRemaining expiresAt')
      .lean()
      .exec();

    let expired = 0;
    for (const row of due) {
      const workspaceId = String(row.workspaceId ?? '');
      const topUpId = String(row._id ?? '');
      try {
        const result = await this.topUpModel.updateOne(
          {
            _id: row._id,
            expiresAt: { $lte: now },
            creditsRemaining: { $gt: 0 },
            expiredAt: null,
          },
          {
            $set: {
              expiredAt: now,
            },
          },
        );

        if (result.modifiedCount > 0) {
          expired += 1;
          logBillingReconcileTopUpExpired(workspaceId, topUpId, {
            creditsRemaining: row.creditsRemaining,
            expiresAt:
              row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
          });
        }
      } catch (err) {
        counters.errors += 1;
        logBillingReconcileItemError('topup_expired', workspaceId, reconcileErrorReason(err), {
          topUpId,
        });
      }
    }

    return expired;
  }
}
