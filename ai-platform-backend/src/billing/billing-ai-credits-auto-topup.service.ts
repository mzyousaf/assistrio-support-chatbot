import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AUTO_TOPUP_CHECKOUT_KEY,
  AUTO_TOPUP_CREDIT_SOURCE,
  AUTO_TOPUP_LIMIT_REACHED_CODE,
  AUTO_TOPUP_LIMIT_REACHED_MESSAGE,
  AUTO_TOPUP_PACK_CREDITS,
  AUTO_TOPUP_PAYMENT_ISSUE_CODE,
  AUTO_TOPUP_PAYMENT_ISSUE_MESSAGE,
  DEFAULT_MAX_AUTO_TOPUPS_PER_BILLING_PERIOD,
} from './billing-auto-topup.constants';
import { BillingProviderService } from './billing-provider.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import {
  WorkspaceAutoTopUpSubscription,
  type WorkspaceAutoTopUpStatus,
} from '../models/workspace-auto-top-up-subscription.schema';
import { WorkspaceCreditTopUp } from '../models/workspace-credit-top-up.schema';
import { WorkspaceSubscription } from '../models/workspace-subscription.schema';
import { getServerLocalMonthlyBillingPeriod } from '../chat/chat-billing-period.util';

const TOP_UP_EXPIRY_MONTHS = 12;

export type WorkspaceAutoTopUpSummaryStatus =
  | 'off'
  | 'pending'
  | 'active'
  | 'payment_issue'
  | 'scheduled_disable';

export type WorkspaceAutoTopUpSummary = {
  status: WorkspaceAutoTopUpSummaryStatus;
  enabled: boolean;
  checkoutAvailable: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  packsThisBillingPeriod: number;
  maxPacksPerBillingPeriod: number;
  packCredits: number;
  packPriceUsd: number;
};

export type AutoTopUpFulfillResult =
  | { ok: true; creditsAdded: number }
  | { ok: false; reason: 'not_enabled' | 'not_active' | 'limit_reached' | 'payment_issue' | 'not_allowed' };

@Injectable()
export class BillingAiCreditsAutoTopUpService {
  constructor(
    @InjectModel(WorkspaceAutoTopUpSubscription.name)
    private readonly autoTopUpModel: Model<WorkspaceAutoTopUpSubscription>,
    @InjectModel(WorkspaceSubscription.name)
    private readonly subscriptionModel: Model<WorkspaceSubscription>,
    @InjectModel(WorkspaceCreditTopUp.name)
    private readonly topUpModel: Model<WorkspaceCreditTopUp>,
    private readonly billingProviderService: BillingProviderService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
  ) {}

  isCheckoutAvailable(): boolean {
    return this.billingProviderService.isAutoTopUpCheckoutAvailable();
  }

  async beginEnableCheckout(
    workspaceId: string,
    userId: string,
  ): Promise<{ checkoutUrl: string; provider: string }> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    if (entitlements.isTrialExpired || !entitlements.addonsAllowed) {
      throw new BadRequestException({
        error: 'Auto top-up is available on active paid plans only.',
        errorCode: 'billing_auto_topup_not_allowed',
      });
    }

    if (!this.isCheckoutAvailable()) {
      throw new BadRequestException({
        error: 'Auto top-up checkout is not configured.',
        errorCode: 'billing_auto_topup_checkout_unavailable',
      });
    }

    const existing = await this.autoTopUpModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .lean()
      .exec();
    if (existing?.status === 'active') {
      throw new BadRequestException({
        error: 'Auto top-up is already active.',
        errorCode: 'billing_auto_topup_already_active',
      });
    }

    await this.autoTopUpModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          status: 'pending',
          provider: 'lemon_squeezy',
          cancelAtPeriodEnd: false,
        },
      },
      { upsert: true, new: true },
    );

    const internalRequestId = randomUUID();
    const checkout = await this.billingProviderService.createAutoTopUpCheckout({
      workspaceId,
      userId,
      internalRequestId,
    });

    return checkout;
  }

  async disableAutoTopUp(workspaceId: string, now: Date = new Date()): Promise<{ ok: true }> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw new NotFoundException({ error: 'Workspace not found.' });
    }

    const record = await this.autoTopUpModel
      .findOne({ workspaceId: new Types.ObjectId(workspaceId) })
      .lean()
      .exec();
    if (!record?.providerSubscriptionId) {
      await this.subscriptionModel.findOneAndUpdate(
        { workspaceId: new Types.ObjectId(workspaceId) },
        { $set: { aiCreditsAutoTopUpEnabled: false } },
      );
      await this.autoTopUpModel.updateOne(
        { workspaceId: new Types.ObjectId(workspaceId) },
        { $set: { status: 'canceled', disabledAt: now, cancelAtPeriodEnd: false } },
      );
      return { ok: true };
    }

    const snapshot = await this.billingProviderService.cancelSubscription({
      providerSubscriptionId: record.providerSubscriptionId,
    });

    const cancelAtPeriodEnd = Boolean(snapshot.cancelAtPeriodEnd);
    const status: WorkspaceAutoTopUpStatus = cancelAtPeriodEnd ? 'scheduled_disable' : 'canceled';

    await this.autoTopUpModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          status,
          cancelAtPeriodEnd,
          currentPeriodEnd: snapshot.currentPeriodEnd ?? record.currentPeriodEnd ?? null,
          disabledAt: cancelAtPeriodEnd ? null : now,
        },
      },
    );

    if (!cancelAtPeriodEnd) {
      await this.subscriptionModel.findOneAndUpdate(
        { workspaceId: new Types.ObjectId(workspaceId) },
        { $set: { aiCreditsAutoTopUpEnabled: false } },
      );
    }

    return { ok: true };
  }

  async syncFromWebhook(
    action: {
      workspaceId: string;
      status: WorkspaceAutoTopUpStatus;
      providerSubscriptionId: string;
      providerSubscriptionItemId?: string;
      providerCustomerId?: string;
      providerVariantId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
      enableAutoTopUp?: boolean;
      disableAutoTopUp?: boolean;
    },
    now: Date = new Date(),
  ): Promise<void> {
    if (!Types.ObjectId.isValid(action.workspaceId)) return;

    const wsOid = new Types.ObjectId(action.workspaceId);
    const $set: Record<string, unknown> = {
      status: action.status,
      provider: 'lemon_squeezy',
      providerSubscriptionId: action.providerSubscriptionId,
      providerSubscriptionItemId: action.providerSubscriptionItemId ?? null,
      providerCustomerId: action.providerCustomerId ?? null,
      providerVariantId: action.providerVariantId ?? null,
      currentPeriodStart: action.currentPeriodStart ?? null,
      currentPeriodEnd: action.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(action.cancelAtPeriodEnd),
    };

    if (action.status === 'active' && action.enableAutoTopUp) {
      $set.activatedAt = now;
      $set.packsThisBillingPeriod = 0;
      $set.billingPeriodStart = action.currentPeriodStart ?? now;
      $set.billingPeriodEnd = action.currentPeriodEnd ?? null;
    }

    if (action.disableAutoTopUp) {
      $set.disabledAt = now;
    }

    await this.autoTopUpModel.findOneAndUpdate(
      { workspaceId: wsOid },
      { $set },
      { upsert: true, new: true },
    );

    const subscriptionUpdate: Record<string, unknown> = {};
    if (action.enableAutoTopUp) {
      subscriptionUpdate.aiCreditsAutoTopUpEnabled = true;
    }
    if (action.disableAutoTopUp) {
      subscriptionUpdate.aiCreditsAutoTopUpEnabled = false;
    }

    if (Object.keys(subscriptionUpdate).length > 0) {
      await this.subscriptionModel.findOneAndUpdate(
        { workspaceId: wsOid },
        { $set: subscriptionUpdate },
        { upsert: true },
      );
    }
  }

  async buildSummary(
    workspaceId: string,
    subscription: {
      aiCreditsAutoTopUpEnabled?: boolean | null;
      maxAutoTopUpsPerBillingPeriod?: number | null;
    } | null,
    now: Date = new Date(),
  ): Promise<WorkspaceAutoTopUpSummary> {
    const checkoutAvailable = this.isCheckoutAvailable();
    const record = Types.ObjectId.isValid(workspaceId)
      ? await this.autoTopUpModel.findOne({ workspaceId: new Types.ObjectId(workspaceId) }).lean().exec()
      : null;

    const enabled = Boolean(subscription?.aiCreditsAutoTopUpEnabled);
    const maxPacks =
      Number(subscription?.maxAutoTopUpsPerBillingPeriod ?? DEFAULT_MAX_AUTO_TOPUPS_PER_BILLING_PERIOD) ||
      DEFAULT_MAX_AUTO_TOPUPS_PER_BILLING_PERIOD;

    let status: WorkspaceAutoTopUpSummaryStatus = 'off';
    if (record?.status === 'pending') status = 'pending';
    else if (record?.status === 'past_due') status = 'payment_issue';
    else if (record?.status === 'scheduled_disable') status = 'scheduled_disable';
    else if (enabled && record?.status === 'active') status = 'active';
    else if (enabled) status = 'active';

    return {
      status,
      enabled,
      checkoutAvailable,
      cancelAtPeriodEnd: Boolean(record?.cancelAtPeriodEnd),
      currentPeriodEnd: record?.currentPeriodEnd
        ? new Date(record.currentPeriodEnd).toISOString()
        : null,
      packsThisBillingPeriod: record?.packsThisBillingPeriod ?? 0,
      maxPacksPerBillingPeriod: maxPacks,
      packCredits: AUTO_TOPUP_PACK_CREDITS,
      packPriceUsd: 30,
    };
  }

  async tryFulfillAtCreditGate(
    workspaceId: string,
    estimatedCredits: number,
    now: Date = new Date(),
  ): Promise<AutoTopUpFulfillResult> {
    if (!Types.ObjectId.isValid(workspaceId)) return { ok: false, reason: 'not_allowed' };

    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId, now);
    if (entitlements.isTrialExpired || !entitlements.addonsAllowed || entitlements.isTrialPlan) {
      return { ok: false, reason: 'not_allowed' };
    }

    const [subscription, autoTopUp] = await Promise.all([
      this.subscriptionModel.findOne({ workspaceId: new Types.ObjectId(workspaceId) }).lean().exec(),
      this.autoTopUpModel.findOne({ workspaceId: new Types.ObjectId(workspaceId) }).lean().exec(),
    ]);

    if (!subscription?.aiCreditsAutoTopUpEnabled) {
      return { ok: false, reason: 'not_enabled' };
    }

    if (!autoTopUp || autoTopUp.status === 'past_due') {
      throw new HttpException(
        {
          message: AUTO_TOPUP_PAYMENT_ISSUE_MESSAGE,
          errorCode: AUTO_TOPUP_PAYMENT_ISSUE_CODE,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (autoTopUp.status !== 'active') {
      return { ok: false, reason: 'not_active' };
    }

    if (autoTopUp.cancelAtPeriodEnd && autoTopUp.currentPeriodEnd && autoTopUp.currentPeriodEnd <= now) {
      return { ok: false, reason: 'not_active' };
    }

    const maxPacks =
      Number(subscription.maxAutoTopUpsPerBillingPeriod ?? DEFAULT_MAX_AUTO_TOPUPS_PER_BILLING_PERIOD) ||
      DEFAULT_MAX_AUTO_TOPUPS_PER_BILLING_PERIOD;

    const period = getServerLocalMonthlyBillingPeriod(now);
    let packsThisPeriod = autoTopUp.packsThisBillingPeriod ?? 0;
    const periodStart = autoTopUp.billingPeriodStart
      ? new Date(autoTopUp.billingPeriodStart)
      : period.billingPeriodStart;
    if (periodStart.getTime() !== period.billingPeriodStart.getTime()) {
      packsThisPeriod = 0;
    }

    if (packsThisPeriod >= maxPacks) {
      throw new HttpException(
        {
          message: AUTO_TOPUP_LIMIT_REACHED_MESSAGE,
          errorCode: AUTO_TOPUP_LIMIT_REACHED_CODE,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const providerOrderId = `auto_topup:${autoTopUp.providerSubscriptionId ?? workspaceId}:${Date.now()}`;
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + TOP_UP_EXPIRY_MONTHS);

    try {
      await this.topUpModel.create({
        workspaceId: new Types.ObjectId(workspaceId),
        creditsPurchased: AUTO_TOPUP_PACK_CREDITS,
        creditsRemaining: AUTO_TOPUP_PACK_CREDITS,
        provider: 'lemon_squeezy',
        providerOrderId,
        source: AUTO_TOPUP_CREDIT_SOURCE,
        expiresAt,
      });
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? Number((err as { code: unknown }).code) : NaN;
      if (code !== 11000) throw err;
    }

    await this.autoTopUpModel.updateOne(
      { workspaceId: new Types.ObjectId(workspaceId) },
      {
        $set: {
          packsThisBillingPeriod: packsThisPeriod + 1,
          billingPeriodStart: period.billingPeriodStart,
          billingPeriodEnd: period.billingPeriodEnd,
        },
      },
    );

    if (autoTopUp.providerSubscriptionItemId) {
      await this.billingProviderService
        .recordAutoTopUpUsage({
          providerSubscriptionItemId: autoTopUp.providerSubscriptionItemId,
          quantity: 1,
        })
        .catch(() => undefined);
    }

    if (estimatedCredits <= AUTO_TOPUP_PACK_CREDITS) {
      return { ok: true, creditsAdded: AUTO_TOPUP_PACK_CREDITS };
    }

    return { ok: true, creditsAdded: AUTO_TOPUP_PACK_CREDITS };
  }
}

export { AUTO_TOPUP_CHECKOUT_KEY };
