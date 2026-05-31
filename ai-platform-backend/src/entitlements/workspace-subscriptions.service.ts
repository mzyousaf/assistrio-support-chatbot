import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { computeFreeTrialPeriod } from './plan-trial-period.util';
import type { BillingInterval } from '../billing/billing-interval.types';
import type { BillingProvider } from '../billing/billing-provider.types';
import {
  WorkspaceSubscription,
  type WorkspaceSubscriptionStatus,
} from '../models/workspace-subscription.schema';
import type { PlanKey } from './plan-catalog';
import {
  shouldApplyScheduledPlanChange,
  type ScheduledPlanChangeRecord,
} from './workspace-scheduled-plan-change.util';
import { TrialEmailService } from './trial-email.service';

export type WorkspaceSubscriptionLean = {
  workspaceId: Types.ObjectId;
  planKey: PlanKey;
  billingInterval?: BillingInterval;
  status: WorkspaceSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  provider?: BillingProvider | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerVariantId?: string | null;
  cancelAtPeriodEnd?: boolean;
  scheduledPlanChange?: ScheduledPlanChangeRecord | null;
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
  creditAutoTopUpEnabled?: boolean;
  aiCreditsAutoTopUpEnabled?: boolean;
  maxAutoTopUpsPerBillingPeriod?: number;
  aiCreditsAutoTopUpPromptEnabled?: boolean;
  autoTopUpThresholdCredits?: number;
};

@Injectable()
export class WorkspaceSubscriptionsService {
  private readonly logger = new Logger(WorkspaceSubscriptionsService.name);

  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    private readonly trialEmailService: TrialEmailService,
  ) {}

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceSubscriptionLean | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const doc = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .lean();
    return doc as WorkspaceSubscriptionLean | null;
  }

  async applyPendingScheduledPlanChanges(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<WorkspaceSubscriptionLean | null> {
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    const sub = await this.findByWorkspaceId(workspaceId);
    const pending = sub ? shouldApplyScheduledPlanChange(sub, now) : null;
    if (!pending) return sub;

    await this.subscriptionModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          planKey: pending.toPlanKey,
          ...(pending.toBillingInterval ? { billingInterval: pending.toBillingInterval } : {}),
          scheduledPlanChange: {
            ...pending,
            effectiveAt: pending.effectiveAt instanceof Date ? pending.effectiveAt : new Date(pending.effectiveAt),
            status: 'applied',
            appliedAt: now,
          },
        },
      },
    );

    return this.findByWorkspaceId(workspaceId);
  }

  async upsertScheduledPlanChange(
    workspaceId: string,
    change: ScheduledPlanChangeRecord,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;
    await this.subscriptionModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          scheduledPlanChange: {
            fromPlanKey: change.fromPlanKey,
            toPlanKey: change.toPlanKey,
            fromBillingInterval: change.fromBillingInterval ?? null,
            toBillingInterval: change.toBillingInterval ?? null,
            effectiveAt: change.effectiveAt,
            status: change.status,
          },
        },
      },
    );
  }

  async cancelScheduledPlanChange(workspaceId: string): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) return;
    const sub = await this.findByWorkspaceId(workspaceId);
    if (!sub?.scheduledPlanChange || sub.scheduledPlanChange.status !== 'scheduled') return;

    await this.subscriptionModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          scheduledPlanChange: {
            ...sub.scheduledPlanChange,
            status: 'canceled',
          },
        },
      },
    );
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
      void this.trialEmailService.notifyTrialStarted(String(workspaceId)).catch((err) => {
        this.logger.warn(
          `Trial started email failed for workspace ${String(workspaceId)}: ${String(err)}`,
        );
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
