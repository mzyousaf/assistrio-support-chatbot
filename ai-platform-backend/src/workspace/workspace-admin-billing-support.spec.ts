import { Types } from 'mongoose';
import { megabytesToBytes } from '../entitlements/plan-catalog';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';

describe('WorkspaceBillingSummaryService admin support', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  it('includes provider IDs, addons, top-ups, and webhook events', async () => {
    const entitlements = {
      workspaceId,
      planKey: 'starter' as const,
      planName: 'Starter',
      subscriptionStatus: 'active' as const,
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 500,
      kbStorageMbPerBot: 15,
      kbStorageBytesPerBot: megabytesToBytes(15),
      maxKbStorageMbPerBot: 40,
      maxKbStorageBytesPerBot: megabytesToBytes(40),
      analyticsHistoryDays: null,
      canExportReports: true,
      showPoweredByAssistrio: true,
      canRemoveBranding: false,
      activeAddons: ['extra_bot'],
      topUpCreditsRemaining: 250,
      kbStorageBonusMbByBotId: {},
      isTrialPlan: false,
      trialDays: null,
      trialStartedAt: null,
      trialEndsAt: null,
      isTrialExpired: false,
      creditsRenewMonthly: true,
      autoTrainAllowed: true,
      addonsAllowed: true,
      memberInvitesAllowed: true,
    };

    const periodStart = new Date('2026-05-01');
    const periodEnd = new Date('2026-06-01');

    const service = new WorkspaceBillingSummaryService(
      { resolveForWorkspace: jest.fn().mockResolvedValue(entitlements) } as never,
      {
        findByWorkspaceId: jest.fn().mockResolvedValue({
          workspaceId: new Types.ObjectId(workspaceId),
          planKey: 'starter',
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          provider: 'lemon_squeezy',
          providerCustomerId: 'cust-1',
          providerSubscriptionId: 'sub-99',
          providerVariantId: '111',
          cancelAtPeriodEnd: false,
        }),
        applyPendingScheduledPlanChanges: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        isCheckoutConfigured: jest.fn().mockReturnValue(true),
        isPlanCheckoutAvailable: jest.fn().mockReturnValue(true),
        isAddonCheckoutAvailable: jest.fn().mockReturnValue(true),
        isTopUpCheckoutAvailable: jest.fn().mockReturnValue(true),
      } as never,
      {
        getWorkspaceMemberUsage: jest.fn().mockResolvedValue({
          current: 1,
          limit: 3,
          memberCount: 1,
          pendingInviteCount: 0,
        }),
      } as never,
      {
        getWorkspaceBotUsage: jest.fn().mockResolvedValue({ current: 1, limit: 1 }),
      } as never,
      {
        getWorkspaceAiCreditsUsage: jest.fn().mockResolvedValue({
          workspaceId,
          billingPeriod: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
          planKey: 'starter',
          planName: 'Starter',
          monthlyAiCredits: 500,
          monthlyCreditsUsed: 0,
          monthlyCreditsRemaining: 500,
          topUpCreditsRemaining: 250,
          totalCreditsAvailable: 750,
          isOverLimit: false,
          isTrialPlan: false,
          isTrialExpired: false,
          creditsRenewMonthly: true,
          byBot: [],
        }),
      } as never,
      {
        getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({
          totalBytes: 0,
          maxBytes: 1000,
          percentUsed: 0,
        }),
      } as never,
      {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
          }),
        }),
      } as never,
      {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ name: 'Acme Workspace' }),
            }),
          }),
        }),
      } as never,
      {
        findOne: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ userId: new Types.ObjectId('507f1f77bcf86cd799439014') }),
            }),
          }),
        }),
      } as never,
      {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ email: 'owner@example.com' }),
            }),
          }),
        }),
      } as never,
      {
        findOne: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: new Types.ObjectId(),
                createdAt: periodStart,
                updatedAt: periodEnd,
                status: 'active',
                provider: 'lemon_squeezy',
                providerCustomerId: 'cust-1',
                providerSubscriptionId: 'sub-99',
                providerVariantId: '111',
                cancelAtPeriodEnd: false,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              }),
            }),
          }),
        }),
      } as never,
      { countDocuments: jest.fn().mockResolvedValue(5) } as never,
      {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  addonKey: 'extra_bot',
                  targetBotId: null,
                  status: 'active',
                  providerSubscriptionId: 'sub-addon',
                  providerOrderId: null,
                },
              ]),
            }),
          }),
        }),
      } as never,
      {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  creditsPurchased: 1000,
                  creditsRemaining: 250,
                  expiresAt: new Date('2027-01-01'),
                  providerOrderId: 'order-1',
                  createdAt: new Date('2026-05-10'),
                },
              ]),
            }),
          }),
        }),
      } as never,
      {
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                {
                  providerOrderId: 'order-1',
                  amountCents: 3000,
                  currency: 'USD',
                  receiptUrl: 'https://receipt.example/order-1',
                  invoiceUrl: null,
                },
              ]),
            }),
          }),
        }),
      } as never,
      {
        findRecentForWorkspace: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            eventName: 'subscription_created',
            status: 'processed',
            processingError: null,
            processedAt: new Date('2026-05-02'),
            createdAt: new Date('2026-05-02'),
          },
        ]),
      } as never,
      {
        buildSummary: jest.fn().mockResolvedValue({
          status: 'off',
          enabled: false,
          checkoutAvailable: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
          packsThisBillingPeriod: 0,
          maxPacksPerBillingPeriod: 5,
          packCredits: 1000,
          packPriceUsd: 30,
        }),
      } as never,
    );

    const summary = await service.getAdminSummary(workspaceId);

    expect(summary.support.provider).toMatchObject({
      provider: 'lemon_squeezy',
      providerCustomerId: 'cust-1',
      providerSubscriptionId: 'sub-99',
      providerVariantId: '111',
      cancelAtPeriodEnd: false,
    });
    expect(summary.support.addons).toHaveLength(1);
    expect(summary.support.topUps[0]).toMatchObject({
      creditsPurchased: 1000,
      creditsRemaining: 250,
      providerOrderId: 'order-1',
    });
    expect(summary.support.webhookEvents[0].eventName).toBe('subscription_created');
    expect(JSON.stringify(summary)).not.toMatch(/api[_-]?key/i);
  });
});
