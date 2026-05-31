import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { getPlanByKey, type PlanKey } from '../entitlements/plan-catalog';
import { parseBillingInterval, type BillingInterval } from './billing-interval.types';
import { getServerLocalMonthlyBillingPeriod } from '../chat/chat-billing-period.util';
import {
  WorkspaceSubscription,
  type WorkspaceSubscriptionStatus,
} from '../models/workspace-subscription.schema';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { WorkspaceCreditTopUp } from '../models/workspace-credit-top-up.schema';
import { WorkspaceBillingOrder } from '../models/workspace-billing-order.schema';
import type { BillingWebhookAction } from './billing-provider.types';
import { BillingAiCreditsAutoTopUpService } from './billing-ai-credits-auto-topup.service';
import { toProviderPaymentMethodSummary } from './billing-payment-method.util';

const TOP_UP_CREDITS = 1000;
const TOP_UP_EXPIRY_MONTHS = 12;

@Injectable()
export class BillingWebhookProcessingService {
  private readonly logger = new Logger(BillingWebhookProcessingService.name);

  constructor(
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    @InjectModel(WorkspaceCreditTopUp.name)
    private readonly topUpModel: Model<WorkspaceCreditTopUp>,
    @InjectModel(WorkspaceBillingOrder.name)
    private readonly billingOrderModel: Model<WorkspaceBillingOrder>,
    private readonly billingAiCreditsAutoTopUpService: BillingAiCreditsAutoTopUpService,
  ) {}

  async applyAction(action: BillingWebhookAction, now: Date = new Date()): Promise<void> {
    switch (action.kind) {
      case 'subscription_sync':
        await this.syncSubscription(action, now);
        return;
      case 'top_up_credit':
        await this.createTopUp(action, now);
        return;
      case 'addon_sync':
        await this.syncAddon(action);
        return;
      case 'order_record':
        await this.storeOrderRecord(action);
        return;
      case 'auto_top_up_subscription_sync':
        await this.billingAiCreditsAutoTopUpService.syncFromWebhook(action, now);
        return;
      case 'ignored':
        return;
      default:
        return;
    }
  }

  private normalizeSubscriptionStatus(raw: string): WorkspaceSubscriptionStatus {
    const s = raw.trim().toLowerCase();
    if (
      s === 'free' ||
      s === 'active' ||
      s === 'trialing' ||
      s === 'past_due' ||
      s === 'canceled' ||
      s === 'unpaid'
    ) {
      return s;
    }
    return 'active';
  }

  private defaultPeriod(now: Date): { start: Date; end: Date } {
    const period = getServerLocalMonthlyBillingPeriod(now);
    return {
      start: period.billingPeriodStart,
      end: period.billingPeriodEnd,
    };
  }

  private async syncSubscription(
    action: Extract<BillingWebhookAction, { kind: 'subscription_sync' }>,
    now: Date,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(action.workspaceId)) return;

    const existing = await this.subscriptionModel
      .findOne({ workspaceId: new Types.ObjectId(action.workspaceId) })
      .lean();

    const status = this.normalizeSubscriptionStatus(action.status);
    const defaults = this.defaultPeriod(now);

    const currentPeriodStart = action.currentPeriodStart ?? existing?.currentPeriodStart ?? defaults.start;
    const currentPeriodEnd = action.currentPeriodEnd ?? existing?.currentPeriodEnd ?? defaults.end;

    let planKey: PlanKey =
      action.planKey && (action.planKey === 'starter' || action.planKey === 'pro')
        ? action.planKey
        : existing?.planKey && existing.planKey !== 'free'
          ? (existing.planKey as PlanKey)
          : 'starter';

    let billingInterval: BillingInterval = action.billingInterval
      ? parseBillingInterval(action.billingInterval)
      : existing?.billingInterval
        ? parseBillingInterval(existing.billingInterval)
        : 'monthly';

    const pendingScheduledChange =
      existing?.scheduledPlanChange?.status === 'scheduled' &&
      existing.scheduledPlanChange.effectiveAt > now;

    if (pendingScheduledChange && existing.scheduledPlanChange) {
      const scheduled = existing.scheduledPlanChange;
      let deferred = false;
      if (action.planKey === scheduled.toPlanKey) {
        planKey = scheduled.fromPlanKey as PlanKey;
        deferred = true;
      }
      if (
        action.billingInterval &&
        scheduled.toBillingInterval &&
        action.billingInterval === scheduled.toBillingInterval
      ) {
        billingInterval = parseBillingInterval(scheduled.fromBillingInterval ?? existing.billingInterval);
        deferred = true;
      }
      if (deferred) {
        this.logger.log(
          `Deferred early provider subscription update for workspace ${action.workspaceId} until scheduled plan change effectiveAt`,
        );
      }
    }

    const periodEnded = Boolean(currentPeriodEnd && currentPeriodEnd <= now);
    if (
      (status === 'canceled' || status === 'unpaid') &&
      periodEnded &&
      !action.cancelAtPeriodEnd
    ) {
      planKey = 'free';
    }

    const plan = getPlanByKey(planKey);

    const actionPlanKey =
      action.planKey === 'starter' || action.planKey === 'pro' ? action.planKey : undefined;

    const $set: Record<string, unknown> = {
      planKey,
      billingInterval,
      status: plan.isTrialPlan ? 'trialing' : status,
      currentPeriodStart,
      currentPeriodEnd,
      provider: 'lemon_squeezy',
      providerCustomerId: action.providerCustomerId ?? existing?.providerCustomerId ?? null,
      cancelAtPeriodEnd: action.cancelAtPeriodEnd ?? false,
    };

    if (actionPlanKey) {
      $set.providerSubscriptionId = action.providerSubscriptionId;
      $set.providerVariantId = action.providerVariantId ?? existing?.providerVariantId ?? null;
    }

    if (action.paymentFailure) {
      $set.paymentFailure = {
        failedAt: action.paymentFailure.failedAt ?? now,
        invoiceId: action.paymentFailure.invoiceId ?? null,
        invoiceUrl: action.paymentFailure.invoiceUrl ?? null,
        amount: action.paymentFailure.amount ?? null,
        currency: action.paymentFailure.currency ?? null,
        cardBrand: action.paymentFailure.cardBrand ?? null,
        cardLastFour: action.paymentFailure.cardLastFour ?? null,
        notifiedWebhookEventId: existing?.paymentFailure?.notifiedWebhookEventId ?? null,
        notifiedInvoiceId: existing?.paymentFailure?.notifiedInvoiceId ?? null,
      };
    }

    if (action.clearPaymentFailure) {
      $set.paymentFailure = null;
    }

    if (action.paymentMethod) {
      const method = toProviderPaymentMethodSummary({
        brand: action.paymentMethod.brand,
        last4: action.paymentMethod.last4,
      });
      if (method) {
        $set.paymentMethod = method;
      }
    }

    await this.subscriptionModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(action.workspaceId) },
      { $set },
      { upsert: true, new: true },
    );
  }

  private async createTopUp(
    action: Extract<BillingWebhookAction, { kind: 'top_up_credit' }>,
    now: Date,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(action.workspaceId)) return;

    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + TOP_UP_EXPIRY_MONTHS);

    try {
      await this.topUpModel.create({
        workspaceId: new Types.ObjectId(action.workspaceId),
        creditsPurchased: action.creditsPurchased || TOP_UP_CREDITS,
        creditsRemaining: action.creditsPurchased || TOP_UP_CREDITS,
        provider: 'lemon_squeezy',
        providerOrderId: action.providerOrderId,
        source: action.source ?? 'manual',
        expiresAt,
      });
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN;
      if (code === 11000) return;
      throw err;
    }
  }

  private async syncAddon(action: Extract<BillingWebhookAction, { kind: 'addon_sync' }>): Promise<void> {
    if (!Types.ObjectId.isValid(action.workspaceId)) return;

    const providerSubscriptionId = action.providerSubscriptionId?.trim() ?? '';
    if (!providerSubscriptionId) {
      const err = new Error('Add-on sync requires providerSubscriptionId.');
      Object.assign(err, { errorCode: 'billing_addon_provider_subscription_missing' });
      throw err;
    }

    const targetBotId =
      action.targetBotId && Types.ObjectId.isValid(action.targetBotId)
        ? new Types.ObjectId(action.targetBotId)
        : null;

    const filter = {
      provider: 'lemon_squeezy' as const,
      providerSubscriptionId,
    };

    const existing = await this.addonModel.findOne(filter).lean();

    let billingInterval: BillingInterval = action.billingInterval
      ? parseBillingInterval(action.billingInterval)
      : existing?.billingInterval
        ? parseBillingInterval(existing.billingInterval)
        : 'monthly';

    const pendingScheduledIntervalChange =
      existing?.scheduledIntervalChange?.status === 'scheduled' &&
      existing.scheduledIntervalChange.effectiveAt > new Date();

    if (pendingScheduledIntervalChange && existing?.scheduledIntervalChange) {
      const scheduled = existing.scheduledIntervalChange;
      if (
        action.billingInterval &&
        action.billingInterval === scheduled.toBillingInterval
      ) {
        billingInterval = parseBillingInterval(scheduled.fromBillingInterval);
        this.logger.log(
          `Deferred early provider add-on interval update for subscription ${providerSubscriptionId} until scheduled interval change effectiveAt`,
        );
      }
    }

    try {
      await this.addonModel.findOneAndUpdate(
        filter,
        {
          $set: {
            workspaceId: new Types.ObjectId(action.workspaceId),
            addonKey: action.addonKey,
            targetBotId,
            status: action.status,
            billingInterval,
            provider: 'lemon_squeezy',
            providerSubscriptionId,
            providerVariantId: action.providerVariantId?.trim() || null,
            providerCustomerId: action.providerCustomerId?.trim() || null,
            providerOrderId: action.providerOrderId ?? null,
            currentPeriodStart: action.currentPeriodStart ?? null,
            currentPeriodEnd: action.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: Boolean(action.cancelAtPeriodEnd),
          },
        },
        { upsert: true, new: true },
      );
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN;
      if (code === 11000) return;
      throw err;
    }
  }

  private async storeOrderRecord(
    action: Extract<BillingWebhookAction, { kind: 'order_record' }>,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(action.workspaceId)) return;

    const targetBotId =
      action.targetBotId && Types.ObjectId.isValid(action.targetBotId)
        ? new Types.ObjectId(action.targetBotId)
        : null;

    try {
      await this.billingOrderModel.findOneAndUpdate(
        { providerOrderId: action.providerOrderId },
        {
          $set: {
            workspaceId: new Types.ObjectId(action.workspaceId),
            provider: 'lemon_squeezy',
            providerOrderId: action.providerOrderId,
            checkoutType: action.checkoutType,
            planKey: action.planKey ?? null,
            addonKey: action.addonKey ?? null,
            topUpKey: action.topUpKey ?? null,
            targetBotId,
            providerSubscriptionId: action.providerSubscriptionId ?? null,
            amountCents: action.amountCents,
            currency: action.currency,
            status: action.status,
            invoiceUrl: action.invoiceUrl ?? null,
            receiptUrl: action.receiptUrl ?? null,
            orderCreatedAt: action.orderCreatedAt ?? new Date(),
          },
        },
        { upsert: true, new: true },
      );
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN;
      if (code === 11000) return;
      throw err;
    }
  }
}
