import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsageLedger } from '../models/usage-ledger.schema';
import { WorkspaceSubscription } from '../models/workspace-subscription.schema';
import { getPlanByKey } from './plan-catalog';
import { TrialEmailService } from './trial-email.service';

const ENDING_SOON_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrialReminderService {
  private readonly logger = new Logger(TrialReminderService.name);

  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(UsageLedger.name)
    private readonly usageLedgerModel: Model<UsageLedger>,
    private readonly trialEmailService: TrialEmailService,
  ) {}

  async runReminders(now: Date = new Date()): Promise<void> {
    await Promise.all([
      this.processEndingSoon(now),
      this.processExpired(now),
      this.processCreditsUsed(now),
    ]);
  }

  private async processEndingSoon(now: Date): Promise<void> {
    const endingBefore = new Date(now.getTime() + ENDING_SOON_MS);
    const rows = await this.subscriptionModel
      .find({
        planKey: 'free',
        status: 'trialing',
        trialEndingSoonEmailSentAt: null,
        providerSubscriptionId: null,
        currentPeriodEnd: { $gt: now, $lte: endingBefore },
      })
      .select('_id workspaceId currentPeriodEnd')
      .lean()
      .exec();

    for (const row of rows) {
      const workspaceId = String(row.workspaceId);
      try {
        await this.trialEmailService.notifyTrialEndingSoon(
          workspaceId,
          row.currentPeriodEnd instanceof Date
            ? row.currentPeriodEnd
            : new Date(row.currentPeriodEnd),
        );
      } catch (err) {
        this.logger.warn(
          `Trial ending soon email failed for workspace ${workspaceId}: ${String(err)}`,
        );
      }
    }
  }

  private async processExpired(now: Date): Promise<void> {
    const rows = await this.subscriptionModel
      .find({
        planKey: 'free',
        status: { $in: ['trialing', 'free'] },
        trialExpiredEmailSentAt: null,
        providerSubscriptionId: null,
        currentPeriodEnd: { $lte: now },
      })
      .select('_id workspaceId')
      .lean()
      .exec();

    for (const row of rows) {
      const workspaceId = String(row.workspaceId);
      try {
        await this.trialEmailService.notifyTrialExpired(workspaceId);
      } catch (err) {
        this.logger.warn(
          `Trial expired email failed for workspace ${workspaceId}: ${String(err)}`,
        );
      }
    }
  }

  private async processCreditsUsed(now: Date): Promise<void> {
    const trialCredits = getPlanByKey('free').monthlyAiCredits;
    const rows = await this.subscriptionModel
      .find({
        planKey: 'free',
        status: 'trialing',
        trialCreditsUsedEmailSentAt: null,
        providerSubscriptionId: null,
        currentPeriodEnd: { $gt: now },
      })
      .select('_id workspaceId currentPeriodStart currentPeriodEnd')
      .lean()
      .exec();

    for (const row of rows) {
      const workspaceId = String(row.workspaceId);
      if (!Types.ObjectId.isValid(workspaceId)) continue;

      const periodStart =
        row.currentPeriodStart instanceof Date
          ? row.currentPeriodStart
          : new Date(row.currentPeriodStart);
      const periodEnd =
        row.currentPeriodEnd instanceof Date
          ? row.currentPeriodEnd
          : new Date(row.currentPeriodEnd);

      const used = await this.sumTrialCreditsUsed(
        new Types.ObjectId(workspaceId),
        periodStart,
        periodEnd,
      );
      if (used < trialCredits) continue;

      try {
        await this.trialEmailService.notifyTrialCreditsUsed(workspaceId);
      } catch (err) {
        this.logger.warn(
          `Trial credits used email failed for workspace ${workspaceId}: ${String(err)}`,
        );
      }
    }
  }

  private async sumTrialCreditsUsed(
    workspaceObjectId: Types.ObjectId,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const agg = await this.usageLedgerModel
      .aggregate<{ total: number }>([
        {
          $match: {
            workspaceId: workspaceObjectId,
            chargedAt: { $gte: periodStart, $lt: periodEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$creditsUsed' } } },
      ])
      .exec();

    return agg[0]?.total ?? 0;
  }
}
