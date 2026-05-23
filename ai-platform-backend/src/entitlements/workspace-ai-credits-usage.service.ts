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
   * Read-only monthly AI credit usage for a workspace (no enforcement).
   * Sums ledger rows in the current server-local billing period.
   */
  async getWorkspaceAiCreditsUsage(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<WorkspaceAiCreditsUsageSummary> {
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    const { billingPeriodStart, billingPeriodEnd } = getServerLocalMonthlyBillingPeriod(now);

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
    const topUpCreditsRemaining = 0;
    const isOverLimit = monthlyCreditsUsed > monthlyAiCredits;
    const monthlyCreditsRemaining = Math.max(0, monthlyAiCredits - monthlyCreditsUsed);

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
      totalCreditsAvailable: monthlyAiCredits + topUpCreditsRemaining,
      isOverLimit,
      byBot,
    };
  }
}
