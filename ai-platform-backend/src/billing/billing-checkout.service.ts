import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getPlanByKey } from '../entitlements/plan-catalog';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import type { WorkspaceSubscriptionStatus } from '../models/workspace-subscription.schema';
import { BillingProviderService } from './billing-provider.service';
import { parseBillingInterval, isBillingInterval } from './billing-interval.types';
import {
  isBillingAddonCheckoutKey,
  isBillingPlanCheckoutKey,
  isBillingTopUpCheckoutKey,
} from './billing-provider.types';

const PAID_SUBSCRIPTION_STATUSES: WorkspaceSubscriptionStatus[] = ['active', 'trialing', 'past_due'];

@Injectable()
export class BillingCheckoutService {
  constructor(
    private readonly billingProviderService: BillingProviderService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
  ) {}

  private async assertPaidPlanForPurchases(workspaceId: string): Promise<void> {
    const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const plan = getPlanByKey(subscription?.planKey);
    if (!plan.addonsAllowed) {
      throw new ForbiddenException({
        error: 'Add-ons and top-ups require a paid plan.',
        errorCode: 'billing_paid_plan_required',
      });
    }
    const status = subscription?.status ?? 'free';
    if (!PAID_SUBSCRIPTION_STATUSES.includes(status)) {
      throw new ForbiddenException({
        error: 'Add-ons and top-ups require an active paid subscription.',
        errorCode: 'billing_paid_plan_required',
      });
    }
  }

  async createPlanCheckout(
    workspaceId: string,
    userId: string,
    planKey: string,
    billingIntervalRaw?: string,
  ) {
    if (!isBillingPlanCheckoutKey(planKey)) {
      throw new BadRequestException({ error: 'Invalid plan key.', errorCode: 'invalid_plan_key' });
    }

    const billingInterval = parseBillingInterval(billingIntervalRaw);
    if (billingIntervalRaw && !isBillingInterval(billingIntervalRaw)) {
      throw new BadRequestException({
        error: 'Invalid billing interval.',
        errorCode: 'invalid_billing_interval',
      });
    }

    const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
    if (entitlements.planKey === planKey && !entitlements.isTrialPlan) {
      const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
      if (subscription && PAID_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
        throw new BadRequestException({
          error: 'Workspace is already on this plan.',
          errorCode: 'plan_already_active',
        });
      }
    }

    if (
      !entitlements.isTrialPlan &&
      entitlements.planKey === 'starter' &&
      planKey === 'pro'
    ) {
      const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
      if (
        subscription?.providerSubscriptionId &&
        PAID_SUBSCRIPTION_STATUSES.includes(subscription.status)
      ) {
        throw new BadRequestException({
          error: 'Use plan change to upgrade to Pro.',
          errorCode: 'billing_plan_change_required',
        });
      }
    }

    const internalRequestId = randomUUID();
    return this.billingProviderService.createSubscriptionCheckout({
      workspaceId,
      userId,
      planKey,
      billingInterval,
      internalRequestId,
    });
  }

  async createAddonCheckout(
    workspaceId: string,
    userId: string,
    addonKey: string,
    billingIntervalRaw?: string,
  ) {
    if (!isBillingAddonCheckoutKey(addonKey)) {
      throw new BadRequestException({ error: 'Invalid add-on key.', errorCode: 'invalid_addon_key' });
    }

    const billingInterval = parseBillingInterval(billingIntervalRaw);
    if (billingIntervalRaw && !isBillingInterval(billingIntervalRaw)) {
      throw new BadRequestException({
        error: 'Invalid billing interval.',
        errorCode: 'invalid_billing_interval',
      });
    }

    await this.assertPaidPlanForPurchases(workspaceId);

    if (addonKey === 'remove_branding') {
      const entitlements = await this.entitlementsService.resolveForWorkspace(workspaceId);
      if (entitlements.canRemoveBranding) {
        throw new BadRequestException({
          error: 'Remove branding add-on is already active for this workspace.',
          errorCode: 'billing_addon_already_active',
        });
      }
    }

    const internalRequestId = randomUUID();
    return this.billingProviderService.createAddonCheckout({
      workspaceId,
      userId,
      addonKey,
      billingInterval,
      internalRequestId,
    });
  }

  async createTopUpCheckout(workspaceId: string, userId: string, topUpKey: string) {
    if (!isBillingTopUpCheckoutKey(topUpKey)) {
      throw new BadRequestException({ error: 'Invalid top-up key.', errorCode: 'invalid_top_up_key' });
    }

    await this.assertPaidPlanForPurchases(workspaceId);

    const internalRequestId = randomUUID();
    return this.billingProviderService.createTopUpCheckout({
      workspaceId,
      userId,
      topUpKey,
      internalRequestId,
    });
  }
}
