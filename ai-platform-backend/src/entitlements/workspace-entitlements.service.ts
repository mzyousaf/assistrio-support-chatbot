import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { getPlanByKey, megabytesToBytes } from './plan-catalog';
import type { WorkspaceEntitlements } from './workspace-entitlements.types';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';

@Injectable()
export class WorkspaceEntitlementsService {
  constructor(private readonly subscriptionsService: WorkspaceSubscriptionsService) {}

  /**
   * Resolves effective entitlements for a workspace from its subscription plan.
   * Missing subscription falls back to Free (no enforcement side effects).
   */
  async resolveForWorkspace(workspaceId: string): Promise<WorkspaceEntitlements> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      return this.buildEntitlements(workspaceId, null);
    }

    const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    return this.buildEntitlements(workspaceId, subscription);
  }

  private buildEntitlements(
    workspaceId: string,
    subscription: {
      planKey: string;
      status: WorkspaceEntitlements['subscriptionStatus'];
    } | null,
  ): WorkspaceEntitlements {
    const plan = getPlanByKey(subscription?.planKey);
    const subscriptionStatus = subscription?.status ?? 'free';

    return {
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
      canRemoveBranding: false,
      activeAddons: [],
      topUpCreditsRemaining: 0,
    };
  }
}
