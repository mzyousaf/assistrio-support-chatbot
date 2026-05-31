import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WorkspaceMemberOverLimitReconcileService } from '../entitlements/workspace-member-over-limit-reconcile.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { isPaidSubscriptionEntitled } from '../entitlements/workspace-effective-subscription.util';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import type { PlanKey } from '../entitlements/plan-catalog';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { BillingWorkspacePaymentNotificationService } from './billing-workspace-payment-notification.service';
import { parseBillingInterval, isBillingInterval, type BillingInterval } from './billing-interval.types';
import {
  BillingProviderActionError,
  isBillingPlanCheckoutKey,
  type BillingPlanCheckoutKey,
} from './billing-provider.types';
import {
  isScheduledPlanIntervalChangeOnly,
  readScheduledPlanChange,
} from '../entitlements/workspace-scheduled-plan-change.util';

export type BillingSubscriptionActionKind =
  | 'cancel'
  | 'change_plan'
  | 'schedule_interval'
  | 'restore'
  | 'cancel_scheduled_downgrade';

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
    private readonly memberOverLimitReconcileService: WorkspaceMemberOverLimitReconcileService,
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
      billingInterval?: BillingInterval;
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
        billingInterval: snapshot.billingInterval as BillingInterval | undefined,
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

    if (subscription.scheduledPlanChange?.status === 'scheduled') {
      await this.subscriptionsService.cancelScheduledPlanChange(workspaceId);
    }

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
      message: `Cancellation scheduled. Your plan remains active until ${this.formatPeriodEndLabel(periodEnd)}.`,
    };
  }

  async changePlan(
    workspaceId: string,
    planKey: string,
    billingInterval?: BillingInterval,
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
      return this.upgradeStarterToPro(
        workspaceId,
        currentPlanKey,
        billingInterval,
        now,
      );
    }

    if (currentPlanKey !== 'pro' || planKey !== 'starter') {
      throw new BadRequestException({
        error: 'This plan change is not supported.',
        errorCode: 'billing_plan_change_not_allowed',
      });
    }

    return this.scheduleProToStarterDowngrade(workspaceId, currentPlanKey, billingInterval, now);
  }

  private async upgradeStarterToPro(
    workspaceId: string,
    _currentPlanKey: PlanKey,
    billingInterval: BillingInterval | undefined,
    now: Date,
  ): Promise<BillingSubscriptionActionOutcome> {
    const { subscription, providerSubscriptionId } = await this.loadPaidProviderSubscription(workspaceId);
    const currentBillingInterval = parseBillingInterval(subscription.billingInterval);
    const targetBillingInterval = billingInterval ?? currentBillingInterval;

    if (subscription.scheduledPlanChange?.status === 'scheduled') {
      await this.subscriptionsService.cancelScheduledPlanChange(workspaceId);
    }

    let remote: Awaited<ReturnType<BillingProviderService['changeSubscriptionPlan']>>;
    try {
      remote = await this.billingProviderService.changeSubscriptionPlan({
        providerSubscriptionId,
        planKey: 'pro',
        billingInterval: targetBillingInterval,
      });
    } catch (err) {
      this.mapProviderError(err);
    }

    await this.syncFromProviderSnapshot(
      workspaceId,
      {
        ...remote,
        providerSubscriptionId,
        planKey: 'pro',
        billingInterval: targetBillingInterval,
      },
      now,
    );

    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId, now, {
      skipMemberReconcile: true,
    });
    await this.memberOverLimitReconcileService.reconcileWorkspaceMembersAgainstLimit(workspaceId, {
      now,
      memberLimit: entitlements.memberLimit,
    });

    return {
      ok: true,
      action: 'change_plan',
      ...this.toActionFields(updated ?? subscription),
      planKey: 'pro',
      message:
        'Upgraded to Pro. Lemon Squeezy will calculate any prorated charge automatically.',
    };
  }

  private async scheduleProToStarterDowngrade(
    workspaceId: string,
    currentPlanKey: PlanKey,
    billingInterval: BillingInterval | undefined,
    now: Date,
  ): Promise<BillingSubscriptionActionOutcome> {
    const { subscription, providerSubscriptionId } = await this.loadPaidProviderSubscription(workspaceId);
    const effectiveAt = subscription.currentPeriodEnd ?? now;
    const currentBillingInterval = parseBillingInterval(subscription.billingInterval);
    const targetBillingInterval = billingInterval ?? currentBillingInterval;
    const planKey = 'starter' as const;

    try {
      await this.billingProviderService.changeSubscriptionPlan({
        providerSubscriptionId,
        planKey,
        billingInterval: targetBillingInterval,
        disableProrations: true,
      });
    } catch (err) {
      this.mapProviderError(err);
    }

    await this.subscriptionsService.upsertScheduledPlanChange(workspaceId, {
      fromPlanKey: currentPlanKey,
      toPlanKey: planKey,
      fromBillingInterval: currentBillingInterval,
      toBillingInterval: targetBillingInterval,
      effectiveAt,
      status: 'scheduled',
    });

    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const dateLabel = this.formatPeriodEndLabel(effectiveAt);
    return {
      ok: true,
      action: 'change_plan',
      ...this.toActionFields(updated ?? subscription),
      planKey: currentPlanKey,
      message: `Downgrade scheduled. Your workspace will switch to Starter on ${dateLabel}.`,
    };
  }

  async scheduleBillingIntervalChange(
    workspaceId: string,
    billingInterval: BillingInterval,
    now: Date = new Date(),
  ): Promise<BillingSubscriptionActionOutcome> {
    this.assertBillingConfigured();

    if (!isBillingInterval(billingInterval)) {
      throw new BadRequestException({
        error: 'Invalid billing interval.',
        errorCode: 'invalid_billing_interval',
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
    if (currentPlanKey !== 'starter' && currentPlanKey !== 'pro') {
      throw new BadRequestException({
        error: 'Billing interval changes require an active paid plan.',
        errorCode: 'billing_plan_change_not_allowed',
      });
    }

    const { subscription, providerSubscriptionId } = await this.loadPaidProviderSubscription(workspaceId);
    const currentBillingInterval = parseBillingInterval(subscription.billingInterval);
    if (currentBillingInterval === billingInterval) {
      throw new BadRequestException({
        error: 'Workspace is already on this billing interval.',
        errorCode: 'billing_interval_already_active',
      });
    }

    const effectiveAt = subscription.currentPeriodEnd ?? now;

    try {
      await this.billingProviderService.changeSubscriptionPlan({
        providerSubscriptionId,
        planKey: currentPlanKey as BillingPlanCheckoutKey,
        billingInterval,
        disableProrations: true,
      });
    } catch (err) {
      this.mapProviderError(err);
    }

    await this.subscriptionsService.upsertScheduledPlanChange(workspaceId, {
      fromPlanKey: currentPlanKey as PlanKey,
      toPlanKey: currentPlanKey as PlanKey,
      fromBillingInterval: currentBillingInterval,
      toBillingInterval: billingInterval,
      effectiveAt,
      status: 'scheduled',
    });

    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const dateLabel = this.formatPeriodEndLabel(effectiveAt);
    return {
      ok: true,
      action: 'schedule_interval',
      ...this.toActionFields(updated ?? subscription),
      planKey: currentPlanKey as PlanKey,
      message: `Billing interval change scheduled. Your workspace will switch to ${billingInterval} billing on ${dateLabel}.`,
    };
  }

  async cancelScheduledDowngrade(
    workspaceId: string,
    now: Date = new Date(),
  ): Promise<BillingSubscriptionActionOutcome> {
    this.assertBillingConfigured();

    const { subscription, providerSubscriptionId } = await this.loadPaidProviderSubscription(workspaceId);
    const scheduled = readScheduledPlanChange(subscription.scheduledPlanChange ?? null);
    if (!scheduled || scheduled.status !== 'scheduled') {
      throw new BadRequestException({
        error: 'No scheduled plan change is active.',
        errorCode: 'billing_no_scheduled_downgrade',
      });
    }

    const revertBillingInterval = parseBillingInterval(
      scheduled.fromBillingInterval ?? subscription.billingInterval,
    );

    try {
      await this.billingProviderService.changeSubscriptionPlan({
        providerSubscriptionId,
        planKey: scheduled.fromPlanKey as BillingPlanCheckoutKey,
        billingInterval: revertBillingInterval,
        disableProrations: true,
      });
    } catch (err) {
      this.mapProviderError(err);
    }

    await this.subscriptionsService.cancelScheduledPlanChange(workspaceId);
    const updated = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId, now, {
      skipMemberReconcile: true,
    });
    await this.memberOverLimitReconcileService.reconcileWorkspaceMembersAgainstLimit(workspaceId, {
      now,
      memberLimit: entitlements.memberLimit,
    });

    const intervalOnly = isScheduledPlanIntervalChangeOnly(scheduled);
    return {
      ok: true,
      action: 'cancel_scheduled_downgrade',
      ...this.toActionFields(updated ?? subscription),
      planKey: scheduled.fromPlanKey,
      message: intervalOnly
        ? 'Scheduled billing interval change canceled.'
        : 'Scheduled downgrade canceled. Your Pro plan will continue.',
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
