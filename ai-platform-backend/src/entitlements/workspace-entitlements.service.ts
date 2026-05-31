import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { getPlanByKey, megabytesToBytes } from './plan-catalog';
import { isTrialPeriodExpired } from './plan-trial-period.util';
import {
  applyWorkspaceAddonEntitlements,
  type ActiveWorkspaceAddonRow,
} from './workspace-addon-entitlements.util';
import {
  resolveEffectivePlanKey,
  resolveIsTrialExpiredForEffectivePlan,
  type SubscriptionForEffectivePlan,
} from './workspace-effective-subscription.util';
import { WorkspaceCreditTopUpService } from './workspace-credit-topup.service';
import type { WorkspaceEntitlements } from './workspace-entitlements.types';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';
import { WorkspaceMemberOverLimitReconcileService } from './workspace-member-over-limit-reconcile.service';

export type ResolveWorkspaceEntitlementsOptions = {
  skipMemberReconcile?: boolean;
};

@Injectable()
export class WorkspaceEntitlementsService {
  constructor(
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
    private readonly topUpService: WorkspaceCreditTopUpService,
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    @Inject(forwardRef(() => WorkspaceMemberOverLimitReconcileService))
    private readonly memberOverLimitReconcileService: WorkspaceMemberOverLimitReconcileService,
  ) {}

  /**
   * Resolves effective entitlements for a workspace from subscription, add-ons, and top-ups.
   */
  async resolveForWorkspace(
    workspaceId: string,
    now: Date = new Date(),
    options?: ResolveWorkspaceEntitlementsOptions,
  ): Promise<WorkspaceEntitlements> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return this.buildEntitlements(workspaceId, null, [], 0, now);
    }

    await this.subscriptionsService.applyPendingScheduledPlanChanges(workspaceId, now);

    const [subscription, addonRows, topUpCreditsRemaining] = await Promise.all([
      this.subscriptionsService.findByWorkspaceId(workspaceId),
      this.addonModel
        .find({
          workspaceId: new Types.ObjectId(workspaceId),
          $or: [
            { status: 'active' },
            { status: 'past_due' },
            { status: 'cancelled', currentPeriodEnd: { $gt: now } },
          ],
        })
        .select('addonKey targetBotId status cancelAtPeriodEnd currentPeriodEnd')
        .lean()
        .exec(),
      this.topUpService.sumRemainingCredits(workspaceId, now),
    ]);

    const activeAddons: ActiveWorkspaceAddonRow[] = addonRows.map((row) => ({
      addonKey: String(row.addonKey),
      targetBotId: row.targetBotId,
      status: String(row.status),
      cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
      currentPeriodEnd: row.currentPeriodEnd ?? null,
    }));

    const entitlements = this.buildEntitlements(workspaceId, subscription, activeAddons, topUpCreditsRemaining, now);

    if (!options?.skipMemberReconcile) {
      await this.memberOverLimitReconcileService.reconcileIfNeeded(
        workspaceId,
        entitlements.memberLimit,
        now,
      );
    }

    return entitlements;
  }

  private buildEntitlements(
    workspaceId: string,
    subscription: {
      planKey: string;
      status: WorkspaceEntitlements['subscriptionStatus'];
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      scheduledPlanChange?: SubscriptionForEffectivePlan['scheduledPlanChange'];
    } | null,
    activeAddons: ActiveWorkspaceAddonRow[],
    topUpCreditsRemaining: number,
    now: Date,
  ): WorkspaceEntitlements {
    const subForPlan: SubscriptionForEffectivePlan = subscription ?? {
      planKey: 'free',
      status: 'free',
    };
    const effectivePlanKey = resolveEffectivePlanKey(subForPlan, now);
    const plan = getPlanByKey(effectivePlanKey);
    const subscriptionStatus = subscription?.status ?? 'free';

    const trialStartedAt =
      plan.isTrialPlan && subscription?.currentPeriodStart
        ? subscription.currentPeriodStart.toISOString()
        : null;
    const trialEndsAt =
      plan.isTrialPlan && subscription?.currentPeriodEnd
        ? subscription.currentPeriodEnd.toISOString()
        : null;

    const isTrialExpired =
      plan.isTrialPlan && subscription?.currentPeriodEnd
        ? resolveIsTrialExpiredForEffectivePlan(subForPlan, effectivePlanKey, now) ||
          isTrialPeriodExpired(subscription.currentPeriodEnd)
        : resolveIsTrialExpiredForEffectivePlan(subForPlan, effectivePlanKey, now);

    const base: WorkspaceEntitlements = {
      workspaceId,
      planKey: plan.key,
      planName: plan.name,
      subscriptionStatus,
      botLimit: plan.botLimit,
      memberLimit: plan.memberLimit,
      monthlyAiCredits: plan.monthlyAiCredits,
      kbStorageMbPerBot: plan.kbStorageMbPerBot,
      kbStorageBytesPerBot: megabytesToBytes(plan.kbStorageMbPerBot),
      maxKbStorageMbPerBot: plan.maxKbStorageMbPerBot,
      maxKbStorageBytesPerBot: megabytesToBytes(plan.maxKbStorageMbPerBot),
      analyticsHistoryDays: plan.analyticsHistoryDays,
      canExportReports: plan.canExportReports,
      showPoweredByAssistrio: plan.showPoweredByAssistrio,
      isTrialPlan: plan.isTrialPlan,
      trialDays: plan.trialDays,
      trialStartedAt,
      trialEndsAt,
      isTrialExpired,
      creditsRenewMonthly: plan.creditsRenewMonthly,
      autoTrainAllowed: !isTrialExpired && plan.autoTrainAllowed,
      addonsAllowed: !isTrialExpired && plan.addonsAllowed,
      memberInvitesAllowed: !isTrialExpired && plan.memberInvitesAllowed,
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining,
      kbStorageBonusMbByBotId: {},
    };

    const addonApplied = applyWorkspaceAddonEntitlements(base, activeAddons, now);

    return {
      ...base,
      botLimit: addonApplied.botLimit,
      canRemoveBranding: addonApplied.canRemoveBranding,
      activeAddons: addonApplied.activeAddons,
      kbStorageBonusMbByBotId: addonApplied.kbStorageBonusMbByBotId,
    };
  }
}
