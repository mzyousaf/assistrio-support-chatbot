import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { computeFreeTrialPeriod } from './plan-trial-period.util';
import type { BillingProvider } from '../billing/billing-provider.types';
import {
  WorkspaceSubscription,
  type WorkspaceSubscriptionStatus,
} from '../models/workspace-subscription.schema';
import type { PlanKey } from './plan-catalog';

export type WorkspaceSubscriptionLean = {
  workspaceId: Types.ObjectId;
  planKey: PlanKey;
  status: WorkspaceSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  provider?: BillingProvider | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerVariantId?: string | null;
  cancelAtPeriodEnd?: boolean;
  paymentMethod?: {
    brand?: string | null;
    last4?: string | null;
    label?: string | null;
  } | null;
  paymentFailure?: {
    failedAt: Date;
    invoiceId?: string | null;
    invoiceUrl?: string | null;
    amount?: number | null;
    currency?: string | null;
    cardBrand?: string | null;
    cardLastFour?: string | null;
    notifiedWebhookEventId?: string | null;
    notifiedInvoiceId?: string | null;
  } | null;
};

@Injectable()
export class WorkspaceSubscriptionsService {
  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
  ) {}

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscriptionLean | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const doc = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .lean();
    return doc as WorkspaceSubscriptionLean | null;
  }

  /**
   * Ensures exactly one subscription row per workspace. New workspaces receive Free plan + status.
   * Idempotent: returns existing row when present.
   */
  async ensureFreeSubscriptionForWorkspace(workspaceId: Types.ObjectId): Promise<WorkspaceSubscriptionLean> {
    const existing = await this.subscriptionModel.findOne({ workspaceId }).lean();
    if (existing) {
      return existing as WorkspaceSubscriptionLean;
    }

    const { periodStart, periodEnd } = computeFreeTrialPeriod();

    try {
      const created = await this.subscriptionModel.create({
        workspaceId,
        planKey: 'free' satisfies PlanKey,
        status: 'trialing' satisfies WorkspaceSubscriptionStatus,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });
      return created.toObject() as WorkspaceSubscriptionLean;
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN;
      if (code === 11000) {
        const raced = await this.subscriptionModel.findOne({ workspaceId }).lean();
        if (raced) return raced as WorkspaceSubscriptionLean;
      }
      throw err;
    }
  }
}
