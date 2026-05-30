import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsageLedger } from '../models/usage-ledger.schema';
import { getServerLocalMonthlyBillingPeriod } from '../chat/chat-billing-period.util';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import type { WorkspaceAiCreditsUsageSummary } from './workspace-ai-credits-usage.types';

@Injectable()
export class WorkspaceAiCreditsUsageService {
  constructor(
    @InjectModel(UsageLedger.name) private readonly usageLedgerModel: Model<UsageLedger>,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  /**
   * Read-only AI credit usage for a workspace (no enforcement).
   * Free trial sums ledger rows across the trial window; paid plans use the current calendar month.
   */
  async getWorkspaceAiCreditsUsage(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<WorkspaceAiCreditsUsageSummary> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);

    let billingPeriodStart: Date;
    let billingPeriodEnd: Date;

    if (entitlements.isTrialPlan && entitlements.trialStartedAt && entitlements.trialEndsAt) {
      billingPeriodStart = new Date(entitlements.trialStartedAt);
      billingPeriodEnd = new Date(entitlements.trialEndsAt);
    } else {
      const period = getServerLocalMonthlyBillingPeriod(now);
      billingPeriodStart = period.billingPeriodStart;
      billingPeriodEnd = period.billingPeriodEnd;
    }

    let monthlyCreditsUsed = 0;
    let byBot: WorkspaceAiCreditsUsageSummary['byBot'] = [];

    if (Types.ObjectId.isValid(workspaceId)) {
      const wsOid = new Types.ObjectId(workspaceId);
      const periodMatch = {
        workspaceId: wsOid,
        chargedAt: { $gte: billingPeriodStart, $lt: billingPeriodEnd },
      };

      const [totalAgg, byBotAgg] = await Promise.all([
        this.usageLedgerModel
          .aggregate<{ total: number }>([
            { $match: periodMatch },
            { $group: { _id: null, total: { $sum: '$creditsUsed' } } },
          ])
          .exec(),
        this.usageLedgerModel
          .aggregate<{ _id: Types.ObjectId; creditsUsed: number }>([
            { $match: periodMatch },
            { $group: { _id: '$botId', creditsUsed: { $sum: '$creditsUsed' } } },
            { $sort: { creditsUsed: -1 } },
          ])
          .exec(),
      ]);

      monthlyCreditsUsed = totalAgg[0]?.total ?? 0;
      byBot = byBotAgg.map((row) => ({
        botId: String(row._id),
        creditsUsed: row.creditsUsed ?? 0,
      }));
    }

    const monthlyAiCredits = entitlements.monthlyAiCredits;
    const isTrialExpired = entitlements.isTrialExpired;
    const topUpCreditsRemaining = isTrialExpired ? 0 : entitlements.topUpCreditsRemaining;
    const monthlyCreditsRemaining = isTrialExpired
      ? 0
      : Math.max(0, monthlyAiCredits - monthlyCreditsUsed);
    const isOverLimit =
      isTrialExpired ||
      (monthlyCreditsUsed >= monthlyAiCredits && topUpCreditsRemaining <= 0);

    return {
      workspaceId,
      billingPeriod: {
        start: billingPeriodStart.toISOString(),
        end: billingPeriodEnd.toISOString(),
      },
      planKey: entitlements.planKey,
      planName: entitlements.planName,
      monthlyAiCredits,
      monthlyCreditsUsed,
      monthlyCreditsRemaining,
      topUpCreditsRemaining,
      totalCreditsAvailable: isTrialExpired ? 0 : monthlyAiCredits + topUpCreditsRemaining,
      isOverLimit,
      isTrialPlan: entitlements.isTrialPlan,
      isTrialExpired,
      creditsRenewMonthly: entitlements.creditsRenewMonthly,
      byBot,
    };
  }
}
