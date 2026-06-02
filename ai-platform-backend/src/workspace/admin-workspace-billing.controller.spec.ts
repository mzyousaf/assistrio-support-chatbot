import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminWorkspaceBillingController } from './admin-workspace-billing.controller';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';

describe('AdminWorkspaceBillingController', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  const supportStub = {
    provider: {
      provider: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
      providerVariantId: null,
      subscriptionStatus: 'free' as const,
      cancelAtPeriodEnd: false,
      currentPeriodStart: '',
      currentPeriodEnd: '',
    },
    addons: [],
    topUps: [],
    webhookEvents: [],
  };

  function buildController() {
    const billingSummaryService = {
      getAdminSummary: jest.fn().mockResolvedValue({
        workspaceId,
        plan: { key: 'free', name: 'Free', status: 'free' },
        subscription: {
          provider: null,
          subscriptionStatus: 'free',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: '',
          hasActivePaidSubscription: false,
          customerPortalAvailable: false,
          manageBillingAvailable: false,
        },
        entitlements: {
          botLimit: 1,
          memberLimit: 3,
          monthlyAiCredits: 50,
          canExportReports: false,
          canRemoveBranding: false,
          activeAddons: [],
          topUpCreditsRemaining: 0,
        },
        usage: {
          bots: { current: 0, limit: 1 },
          members: { current: 1, pendingInvites: 0, used: 1, limit: 3 },
          aiCredits: { monthlyCreditsUsed: 0, monthlyCredits: 50 },
        },
        planCatalog: [],
        addonCatalog: [],
        admin: {
          workspaceName: 'Acme',
          workspaceOwnerEmail: 'owner@example.com',
          subscriptionId: null,
          subscriptionStatus: 'free',
          providerSubscriptionId: null,
          providerCustomerId: null,
          activeAddons: [],
          topUpCreditsRemaining: 0,
          usageLedgerCount: 0,
        },
        support: supportStub,
      }),
    };
    const billingAdminSyncService = {
      syncWorkspaceBilling: jest.fn().mockResolvedValue({
        synced: true,
        message: 'Subscription synced from billing provider.',
      }),
    };
    const adminWorkspaceSupportService = {
      getSupportSummary: jest.fn().mockResolvedValue({
        workspace: { id: workspaceId, name: 'Acme', onboardingStatus: null, createdAt: null },
        owner: { userId: 'u1', name: 'Owner', email: 'owner@example.com' },
        subscription: { subscriptionStatus: 'free' },
        entitlements: { monthlyAiCredits: 50 },
        usage: { lockedAgentsCount: 0, inactiveMembersCount: 0 },
        agents: [],
        members: [],
        invites: [],
        knowledge: [],
        conversations: [],
        billing: { workspaceId },
        webhookHealth: { failedCount: 0, recentFailureCount: 0, lastProcessedAt: null },
        recentEvents: [],
      }),
      getUsageAnalytics: jest.fn().mockResolvedValue({
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-31' },
        usageTrend: [],
        aiCreditsByAgent: [],
        trainedKnowledgeByAgent: [],
      }),
    };

    const controller = new AdminWorkspaceBillingController(
      billingSummaryService as never,
      billingAdminSyncService as never,
      adminWorkspaceSupportService as never,
    );
    return { controller, billingSummaryService, billingAdminSyncService, adminWorkspaceSupportService };
  }

  it('returns admin billing summary for superadmin route', async () => {
    const { controller, billingSummaryService } = buildController();

    const result = await controller.getBillingSummary(workspaceId);

    expect(billingSummaryService.getAdminSummary).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({
      workspaceId,
      plan: { key: 'free', name: 'Free' },
      entitlements: expect.objectContaining({ monthlyAiCredits: 50 }),
      admin: expect.objectContaining({ workspaceName: 'Acme' }),
    });
  });

  it('blocks non-superadmin via SuperAdminGuard', () => {
    const guard = new SuperAdminGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'operator' } }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('sync billing delegates to BillingAdminSyncService', async () => {
    const { controller, billingAdminSyncService } = buildController();
    const result = await controller.syncBilling(workspaceId);
    expect(billingAdminSyncService.syncWorkspaceBilling).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({ synced: true });
  });

  it('returns support summary for superadmin route', async () => {
    const { controller, adminWorkspaceSupportService } = buildController();
    const result = await controller.getSupportSummary(workspaceId);
    expect(adminWorkspaceSupportService.getSupportSummary).toHaveBeenCalledWith(workspaceId);
    expect(result).toMatchObject({
      workspace: { id: workspaceId, name: 'Acme' },
      owner: { email: 'owner@example.com' },
    });
  });

  it('returns usage analytics for superadmin route', async () => {
    const { controller, adminWorkspaceSupportService } = buildController();
    const result = await controller.getUsageAnalytics(
      workspaceId,
      '2026-05-01',
      '2026-05-31',
      '507f1f77bcf86cd799439012',
    );
    expect(adminWorkspaceSupportService.getUsageAnalytics).toHaveBeenCalledWith(workspaceId, {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      botIds: '507f1f77bcf86cd799439012',
    });
    expect(result.dateRange.endDate).toBe('2026-05-31');
  });
});
