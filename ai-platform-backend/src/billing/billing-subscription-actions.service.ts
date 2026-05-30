import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { isPaidSubscriptionEntitled } from '../entitlements/workspace-effective-subscription.util';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import type { PlanKey } from '../entitlements/plan-catalog';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { BillingWorkspacePaymentNotificationService } from './billing-workspace-payment-notification.service';
import {
  BillingProviderActionError,
  isBillingPlanCheckoutKey,
  type BillingPlanCheckoutKey,
} from './billing-provider.types';

export type BillingSubscriptionActionKind = 'cancel' | 'change_plan' | 'restore';

export type BillingSubscriptionActionOutcome = {
  ok: true;
  action: BillingSubscriptionActionKind;
  message: string;
  planKey?: PlanKey;
  status?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
};

@Injectable()
export class BillingSubscriptionActionsService {
  constructor(
    private readonly billingProviderService: BillingProviderService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly webhookProcessingService: BillingWebhookProcessingService,
    private readonly paymentNotificationService: BillingWorkspacePaymentNotificationService,
  ) {}

  private assertBillingConfigured(): void {
    if (!this.billingProviderService.isCheckoutConfigured()) {
      throw new ServiceUnavailableException({
        error: 'Billing provider is not configured.',
        errorCode: 'billing_provider_not_configured',
      });
    }
  }

  private formatPeriodEndLabel(periodEnd: Date | null | undefined): string {
    return periodEnd?.toISOString() ?? 'the end of your billing period';
  }

  private toActionFields(subscription: {
    planKey?: string;
    status?: string;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
  }): Pick<
    BillingSubscriptionActionOutcome,
    'planKey' | 'status' | 'currentPeriodEnd' | 'cancelAtPeriodEnd'
  > {
    return {
      planKey: subscription.planKey as PlanKey | undefined,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  private async loadPaidProviderSubscription(workspaceId: string) {
    const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    if (!subscription) {
      throw new NotFoundException({
        error: 'Workspace subscription not found.',
        errorCode: 'billing_no_active_subscription',
      });
    }

    const providerSubscriptionId = subscription.providerSubscriptionId?.trim() ?? '';
    if (!providerSubscriptionId || subscription.provider !== 'lemon_squeezy') {
      throw new BadRequestException({
        error: 'No billing provider subscription is linked to this workspace.',
        errorCode: 'billing_no_active_subscription',
      });
    }

    if (!isPaidSubscriptionEntitled(subscription)) {
      throw new BadRequestException({
        error: 'An active paid subscription is required.',
        errorCode: 'billing_no_active_subscription',
      });
    }

    return { subscription, providerSubscriptionId };
  }

  private async syncFromProviderSnapshot(
    workspaceId: string,
    snapshot: {
      planKey?: PlanKey;
      providerCustomerId?: string;
      providerSubscriptionId: string;
      providerVariantId?: string;
      status: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
    },
    now: Date,
  ): Promise<void> {
    await this.webhookProcessingService.applyAction(
      {
        kind: 'subscription_sync',
        workspaceId,
        planKey: snapshot.planKey,
        providerCustomerId: snapshot.providerCustomerId,
        providerSubscriptionId: snapshot.providerSubscriptionId,
        providerVariantId: snapshot.providerVariantId,
        status: snapshot.status,
        currentPeriodStart: snapshot.currentPeriodStart,
        currentPeriodEnd: snapshot.currentPeriodEnd,
        cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
      },
      now,
    );
  }

  private mapProviderError(err: unknown): never {
    if (err instanceof BillingProviderActionError) {
      throw new BadRequestException({
        error: err.message,
        errorCode: err.errorCode,
      });
    }
    throw err;
  }

  async cancelSubscription(
    workspaceId: string,
    confirm: boolean,
    now: Date = new Date(),
  ): Promise<BillingSubscriptionActionOutcome> {
    this.assertBillingConfigured();

    if (!confirm) {
      throw new BadRequestException({
        error: 'Cancellation must be confirmed.',
        errorCode: 'billing_cancel_confirmation_required',
      });
    }

    const { subscription, providerSubscriptionId } = await this.loadPaidProviderSubscription(workspaceId);

    if (subscription.cancelAtPeriodEnd) {
      return {
        ok: true,
        action: 'cancel',
        ...this.toActionFields(subscription),
        message: 'Subscription cancellation is already scheduled.',
      };
    }

    try {
      const remote = await this.billingProviderService.cancelSubscription({
        providerSubscriptionId,
      });

      await this.syncFromProviderSnapshot(
        workspaceId,
        {
          ...remote,
          providerSubscriptionId,
          planKey: remote.planKey ?? (subscription.planKey as PlanKey),
          cancelAtPeriodEnd: true,
        },
        now,
      );
    } catch (err) {
      this.mapProviderError(err);
    }

    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const periodEnd = updated?.currentPeriodEnd ?? subscription.currentPeriodEnd;
    await this.paymentNotificationService.notifySubscriptionCancelScheduled(workspaceId);
    return {
      ok: true,
      action: 'cancel',
      ...this.toActionFields(updated ?? { ...subscription, cancelAtPeriodEnd: true }),
      message: `Subscription cancellation scheduled. Your plan remains active until ${this.formatPeriodEndLabel(periodEnd)}.`,
    };
  }

  async changePlan(
    workspaceId: string,
    planKey: string,
    now: Date = new Date(),
  ): Promise<BillingSubscriptionActionOutcome> {
    this.assertBillingConfigured();

    if (planKey === 'free') {
      throw new BadRequestException({
        error: 'Downgrading to Free is not supported in-app. Cancel your subscription instead.',
        errorCode: 'billing_downgrade_not_allowed',
      });
    }

    if (!isBillingPlanCheckoutKey(planKey)) {
      throw new BadRequestException({
        error: 'Invalid plan key.',
        errorCode: 'invalid_plan_key',
      });
    }

    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId, now);
    if (entitlements.isTrialPlan || entitlements.planKey === 'free') {
      throw new BadRequestException({
        error: 'Use checkout to subscribe from the Free trial.',
        errorCode: 'billing_checkout_required',
      });
    }

    const currentPlanKey = entitlements.planKey;
    if (currentPlanKey === planKey) {
      throw new BadRequestException({
        error: 'Workspace is already on this plan.',
        errorCode: 'plan_already_active',
      });
    }

    if (currentPlanKey === 'starter' && planKey === 'pro') {
      throw new BadRequestException({
        error: 'Use checkout to upgrade to Pro.',
        errorCode: 'billing_checkout_required',
      });
    }

    if (currentPlanKey !== 'pro' || planKey !== 'starter') {
      throw new BadRequestException({
        error: 'This plan change is not supported.',
        errorCode: 'billing_plan_change_not_allowed',
      });
    }

    const { providerSubscriptionId } = await this.loadPaidProviderSubscription(workspaceId);

    try {
      const remote = await this.billingProviderService.changeSubscriptionPlan({
        providerSubscriptionId,
        planKey: planKey as BillingPlanCheckoutKey,
        disableProrations: true,
      });

      await this.syncFromProviderSnapshot(
        workspaceId,
        {
          ...remote,
          providerSubscriptionId,
          planKey: 'starter',
        },
        now,
      );
    } catch (err) {
      this.mapProviderError(err);
    }

    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    return {
      ok: true,
      action: 'change_plan',
      ...this.toActionFields(updated ?? { planKey: 'starter', status: 'active' }),
      planKey: 'starter',
      message:
        'Your workspace is now on the Starter plan. Your next invoice will reflect the Starter price.',
    };
  }

  private async loadRestorableSubscription(workspaceId: string, now: Date = new Date()) {
    const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    if (!subscription) {
      throw new NotFoundException({
        error: 'Workspace subscription not found.',
        errorCode: 'billing_no_active_subscription',
      });
    }

    const providerSubscriptionId = subscription.providerSubscriptionId?.trim() ?? '';
    if (!providerSubscriptionId || subscription.provider !== 'lemon_squeezy') {
      throw new BadRequestException({
        error: 'No billing provider subscription is linked to this workspace.',
        errorCode: 'billing_no_active_subscription',
      });
    }

    const periodEnd = subscription.currentPeriodEnd;
    if (!periodEnd || periodEnd <= now) {
      throw new BadRequestException({
        error: 'Subscription billing period has already ended.',
        errorCode: 'billing_restore_not_allowed',
      });
    }

    const scheduledToCancel =
      Boolean(subscription.cancelAtPeriodEnd) || subscription.status === 'canceled';
    if (!scheduledToCancel) {
      throw new BadRequestException({
        error: 'Subscription is not scheduled for cancellation.',
        errorCode: 'billing_restore_not_allowed',
      });
    }

    if (!isPaidSubscriptionEntitled(subscription, now)) {
      throw new BadRequestException({
        error: 'Subscription cannot be restored.',
        errorCode: 'billing_restore_not_allowed',
      });
    }

    return { subscription, providerSubscriptionId };
  }

  async restoreSubscription(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<BillingSubscriptionActionOutcome> {
    this.assertBillingConfigured();

    const { subscription, providerSubscriptionId } = await this.loadRestorableSubscription(
      workspaceId,
      now,
    );

    try {
      const remote = await this.billingProviderService.restoreSubscription({
        providerSubscriptionId,
      });

      await this.syncFromProviderSnapshot(
        workspaceId,
        {
          ...remote,
          providerSubscriptionId,
          planKey: remote.planKey ?? (subscription.planKey as PlanKey),
          cancelAtPeriodEnd: false,
        },
        now,
      );
    } catch (err) {
      this.mapProviderError(err);
    }

    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    await this.paymentNotificationService.notifySubscriptionRestored(workspaceId);
    return {
      ok: true,
      action: 'restore',
      ...this.toActionFields(updated ?? { ...subscription, cancelAtPeriodEnd: false }),
      cancelAtPeriodEnd: false,
      message: 'Subscription restored.',
    };
  }
}
