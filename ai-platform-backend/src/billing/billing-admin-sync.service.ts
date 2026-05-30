import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BillingProviderService } from './billing-provider.service';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';
import { WorkspaceAddon } from '../models/workspace-addon.schema';
import { WorkspaceBillingOrder } from '../models/workspace-billing-order.schema';
import { resolveMainPlanProviderSubscriptionId } from './billing-invoice-main-subscription.util';
import type { PlanKey } from '../entitlements/plan-catalog';

export type BillingAdminSyncResult = {
  synced: boolean;
  message: string;
};

@Injectable()
export class BillingAdminSyncService {
  constructor(
    private readonly billingProviderService: BillingProviderService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
    private readonly webhookProcessingService: BillingWebhookProcessingService,
    @InjectModel(WorkspaceAddon.name)
    private readonly addonModel: Model<WorkspaceAddon>,
    @InjectModel(WorkspaceBillingOrder.name)
    private readonly billingOrderModel: Model<WorkspaceBillingOrder>,
  ) {}

  async syncWorkspaceBilling(workspaceId: string, now: Date = new Date()): Promise<BillingAdminSyncResult> {
    if (!this.billingProviderService.isCheckoutConfigured()) {
      return {
        synced: false,
        message: 'Billing provider is not configured.',
      };
    }

    const subscription = await this.subscriptionsService.findByWorkspaceId(workspaceId);
    const providerSubscriptionId = await this.resolvePlanProviderSubscriptionId(workspaceId, subscription);
    if (!providerSubscriptionId) {
      return {
        synced: false,
        message: 'No plan provider subscription ID on file for this workspace.',
      };
    }

    const remote = await this.billingProviderService.fetchProviderSubscription(providerSubscriptionId);
    if (!remote) {
      return {
        synced: false,
        message: 'Could not fetch subscription from the billing provider.',
      };
    }

    const planKey: PlanKey =
      remote.planKey && (remote.planKey === 'starter' || remote.planKey === 'pro')
        ? remote.planKey
        : subscription?.planKey && subscription.planKey !== 'free'
          ? (subscription.planKey as PlanKey)
          : 'starter';

    await this.webhookProcessingService.applyAction(
      {
        kind: 'subscription_sync',
        workspaceId,
        planKey,
        providerCustomerId: remote.providerCustomerId,
        providerSubscriptionId,
        providerVariantId: remote.providerVariantId,
        status: remote.status,
        currentPeriodStart: remote.currentPeriodStart,
        currentPeriodEnd: remote.currentPeriodEnd,
        cancelAtPeriodEnd: remote.cancelAtPeriodEnd,
      },
      now,
    );

    return {
      synced: true,
      message: 'Subscription synced from billing provider.',
    };
  }

  private async resolvePlanProviderSubscriptionId(
    workspaceId: string,
    subscription: Awaited<ReturnType<WorkspaceSubscriptionsService['findByWorkspaceId']>>,
  ): Promise<string> {
    if (!Types.ObjectId.isValid(workspaceId)) return '';

    const workspaceObjectId = new Types.ObjectId(workspaceId);
    const [addons, planOrders] = await Promise.all([
      this.addonModel
        .find({ workspaceId: workspaceObjectId })
        .select('providerSubscriptionId')
        .lean()
        .exec(),
      this.billingOrderModel
        .find({ workspaceId: workspaceObjectId, checkoutType: 'plan' })
        .sort({ orderCreatedAt: -1 })
        .select('providerSubscriptionId')
        .lean()
        .exec(),
    ]);

    const addonSubscriptionIds = new Set(
      (addons as Array<{ providerSubscriptionId?: string | null }>)
        .map((row) => String(row.providerSubscriptionId ?? '').trim())
        .filter(Boolean),
    );

    const resolved = resolveMainPlanProviderSubscriptionId({
      subscriptionProviderSubscriptionId: subscription?.providerSubscriptionId,
      addonSubscriptionIds,
      planOrderProviderSubscriptionIds: (planOrders as Array<{ providerSubscriptionId?: string | null }>).map(
        (row) => String(row.providerSubscriptionId ?? ''),
      ),
    });

    if (resolved.id) return resolved.id;

    const customerId = subscription?.providerCustomerId?.trim() ?? '';
    if (!customerId) return '';

    const remotePlans = await this.billingProviderService.listCustomerPlanSubscriptions(customerId);
    return remotePlans[0]?.providerSubscriptionId?.trim() ?? '';
  }
}
