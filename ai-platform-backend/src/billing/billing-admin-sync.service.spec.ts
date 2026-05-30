import { BillingAdminSyncService } from './billing-admin-sync.service';

describe('BillingAdminSyncService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  function createService(options: {
    checkoutConfigured?: boolean;
    subscription?: {
      providerSubscriptionId: string | null;
      planKey?: string;
      providerCustomerId?: string | null;
    } | null;
    remote?: Record<string, unknown> | null;
    addons?: Array<{ providerSubscriptionId?: string | null }>;
    planOrders?: Array<{ providerSubscriptionId?: string | null }>;
    customerPlans?: Array<{ providerSubscriptionId: string; planKey?: string }>;
  }) {
    const billingProviderService = {
      isCheckoutConfigured: jest.fn().mockReturnValue(options.checkoutConfigured ?? true),
      fetchProviderSubscription: jest.fn().mockResolvedValue(options.remote ?? null),
      listCustomerPlanSubscriptions: jest
        .fn()
        .mockResolvedValue(options.customerPlans ?? []),
    };
    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(options.subscription ?? null),
    };
    const webhookProcessingService = {
      applyAction: jest.fn().mockResolvedValue(undefined),
    };
    const addonModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(options.addons ?? []),
          }),
        }),
      }),
    };
    const billingOrderModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(
                (options.planOrders ?? []).map((row) => ({
                  providerSubscriptionId: row.providerSubscriptionId,
                  checkoutType: 'plan',
                })),
              ),
            }),
          }),
        }),
      }),
    };

    return {
      service: new BillingAdminSyncService(
        billingProviderService as never,
        subscriptionsService as never,
        webhookProcessingService as never,
        addonModel as never,
        billingOrderModel as never,
      ),
      webhookProcessingService,
      billingProviderService,
    };
  }

  it('returns message when provider not configured', async () => {
    const { service } = createService({ checkoutConfigured: false });
    const result = await service.syncWorkspaceBilling(workspaceId);
    expect(result).toEqual({
      synced: false,
      message: 'Billing provider is not configured.',
    });
  });

  it('returns message when no plan provider subscription id can be resolved', async () => {
    const { service } = createService({ subscription: { providerSubscriptionId: null } });
    const result = await service.syncWorkspaceBilling(workspaceId);
    expect(result.synced).toBe(false);
    expect(result.message).toContain('No plan provider subscription ID');
  });

  it('syncs subscription from provider', async () => {
    const { service, webhookProcessingService } = createService({
      subscription: { providerSubscriptionId: 'sub-99', planKey: 'starter' },
      remote: {
        status: 'active',
        providerCustomerId: 'cust-1',
        providerVariantId: '111',
        planKey: 'starter',
        currentPeriodStart: new Date('2026-05-01'),
        currentPeriodEnd: new Date('2026-06-01'),
        cancelAtPeriodEnd: false,
      },
    });

    const result = await service.syncWorkspaceBilling(workspaceId);
    expect(result.synced).toBe(true);
    expect(webhookProcessingService.applyAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'subscription_sync',
        workspaceId,
        providerSubscriptionId: 'sub-99',
      }),
      expect.any(Date),
    );
  });

  it('recovers plan subscription id from billing order when workspace row points at add-on', async () => {
    const { service, billingProviderService } = createService({
      subscription: {
        providerSubscriptionId: 'sub-addon',
        planKey: 'starter',
        providerCustomerId: 'cust-1',
      },
      addons: [{ providerSubscriptionId: 'sub-addon' }],
      planOrders: [{ providerSubscriptionId: 'sub-plan' }],
      remote: {
        status: 'active',
        providerCustomerId: 'cust-1',
        providerVariantId: '111',
        planKey: 'starter',
        currentPeriodStart: new Date('2026-05-01'),
        currentPeriodEnd: new Date('2026-06-01'),
        cancelAtPeriodEnd: false,
      },
    });

    const result = await service.syncWorkspaceBilling(workspaceId);
    expect(result.synced).toBe(true);
    expect(billingProviderService.fetchProviderSubscription).toHaveBeenCalledWith('sub-plan');
  });
});
