import { Types } from 'mongoose';
import { BillingWebhookProcessingService } from './billing-webhook-processing.service';
import { WorkspaceEntitlementsService } from '../entitlements/workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from '../entitlements/workspace-subscriptions.service';

describe('billing webhook → entitlements (integration)', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  it('subscription_created Starter yields Starter entitlements', async () => {
    const subscriptionStore = {
      planKey: 'free',
      status: 'free',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
    };

    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockImplementation(async (_filter, update) => {
        Object.assign(subscriptionStore, update.$set);
        return subscriptionStore;
      }),
    };
    const addonModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    };
    const topUpModel = { create: jest.fn() };
    const billingOrderModel = { findOneAndUpdate: jest.fn().mockResolvedValue({}) };

    const webhook = new BillingWebhookProcessingService(
      subscriptionModel as never,
      addonModel as never,
      topUpModel as never,
      billingOrderModel as never,
    );

    await webhook.applyAction({
      kind: 'subscription_sync',
      workspaceId,
      planKey: 'starter',
      providerSubscriptionId: 'sub-starter',
      status: 'active',
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-06-01'),
      cancelAtPeriodEnd: false,
    });

    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue({
        workspaceId: new Types.ObjectId(workspaceId),
        ...subscriptionStore,
      }),
    } as unknown as WorkspaceSubscriptionsService;

    const topUpService = { sumRemainingCredits: jest.fn().mockResolvedValue(0) };
    const entitlements = new WorkspaceEntitlementsService(
      subscriptionsService,
      topUpService as never,
      addonModel as never,
    );

    const resolved = await entitlements.resolveForWorkspace(workspaceId);

    expect(resolved.planKey).toBe('starter');
    expect(resolved.memberLimit).toBe(5);
    expect(resolved.monthlyAiCredits).toBe(500);
    expect(resolved.isTrialExpired).toBe(false);
  });
});
