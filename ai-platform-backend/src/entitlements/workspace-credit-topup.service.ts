import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WorkspaceCreditTopUp } from '../models/workspace-credit-top-up.schema';

/**
 * Non-expired top-up pool for a workspace (FIFO debit by createdAt).
 * Debit after usage ledger append is best-effort; concurrent chat may briefly overspend top-ups.
 */
@Injectable()
export class WorkspaceCreditTopUpService {
  constructor(
    @InjectModel(WorkspaceCreditTopUp.name)
    private readonly topUpModel: Model<WorkspaceCreditTopUp>,
  ) {}

  async sumRemainingCredits(workspaceId: string, now: Date = new Date()): Promise<number> {
    if (!Types.ObjectId.isValid(workspaceId)) return 0;

    const rows = await this.topUpModel
      .find({
        workspaceId: new Types.ObjectId(workspaceId),
        expiresAt: { $gt: now },
        creditsRemaining: { $gt: 0 },
      })
      .select('creditsRemaining')
      .lean()
      .exec();

    return rows.reduce((sum, row) => sum + Math.max(0, row.creditsRemaining ?? 0), 0);
  }

  /**
   * Debits credits from oldest non-expired top-ups. Returns amount actually debited.
   */
  async debitCredits(workspaceId: string, amount: number, now: Date = new Date()): Promise<number> {
    const toDebit = Math.floor(amount);
    if (!Types.ObjectId.isValid(workspaceId) || toDebit <= 0) return 0;

    let remaining = toDebit;
    let debited = 0;

    while (remaining > 0) {
      const row = await this.topUpModel
        .findOne({
          workspaceId: new Types.ObjectId(workspaceId),
          expiresAt: { $gt: now },
          creditsRemaining: { $gt: 0 },
        })
        .sort({ createdAt: 1 })
        .exec();

      if (!row) break;

      const available = Math.max(0, row.creditsRemaining ?? 0);
      const take = Math.min(remaining, available);
      if (take <= 0) break;

      const updated = await this.topUpModel
        .findOneAndUpdate(
          { _id: row._id, creditsRemaining: { $gte: take } },
          { $inc: { creditsRemaining: -take } },
          { new: true },
        )
        .exec();

      if (!updated) break;

      remaining -= take;
      debited += take;
    }

    return debited;
  }

  /**
   * When monthly usage exceeds the plan cap, debit the spill from top-up credits (this message only).
   */
  async debitSpillAfterMonthlyUsed(
    workspaceId: string,
    monthlyLimit: number,
    monthlyCreditsUsedBeforeMessage: number,
    creditsThisMessage: number,
    now: Date = new Date(),
  ): Promise<number> {
    const spill = Math.max(
      0,
      monthlyCreditsUsedBeforeMessage + creditsThisMessage - monthlyLimit,
    );
    if (spill <= 0) return 0;
    return this.debitCredits(workspaceId, spill, now);
  }
}
