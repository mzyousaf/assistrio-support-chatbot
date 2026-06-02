import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminWorkspaceSupportService } from './admin-workspace-support.service';

describe('AdminWorkspaceSupportService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439012';

  const billingSummary = {
    workspaceId,
    plan: { key: 'starter', name: 'Starter', status: 'active' },
    subscription: {
      provider: 'lemon_squeezy',
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      hasActivePaidSubscription: true,
      customerPortalAvailable: true,
      manageBillingAvailable: true,
    },
    entitlements: {
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 500,
      topUpCreditsRemaining: 100,
    },
    usage: {
      bots: { current: 2, limit: 1 },
      members: { current: 2, pendingInvites: 1, used: 3, limit: 3, isOverMemberLimit: true },
      aiCredits: {
        monthlyCreditsUsed: 120,
        monthlyCredits: 500,
        topUpCreditsRemaining: 100,
        byBot: [{ botId, creditsUsed: 80 }],
      },
      trainedKnowledge: {
        perBot: [{ botId, botName: 'Support Bot', usedMb: 5, maxMb: 15, percentUsed: 33 }],
      },
    },
    admin: {
      workspaceName: 'Acme Workspace',
      workspaceOwnerEmail: 'owner@example.com',
    },
    support: {
      provider: {
        provider: 'lemon_squeezy',
        providerCustomerId: 'cust-1',
        providerSubscriptionId: 'sub-1',
      },
      addons: [],
      topUps: [],
      webhookEvents: [
        {
          id: 'evt-1',
          eventName: 'subscription_updated',
          status: 'failed',
          createdAt: '2026-05-20T12:00:00.000Z',
          processedAt: null,
          processingError: 'Invalid payload',
        },
      ],
    },
  };

  function buildService(overrides?: {
    workspaceDoc?: Record<string, unknown> | null;
    bots?: Array<Record<string, unknown>>;
    members?: Array<Record<string, unknown>>;
    invites?: Array<Record<string, unknown>>;
    conversations?: Array<Record<string, unknown>>;
    lockedBotIds?: Set<string>;
  }) {
    const billingSummaryService = {
      getAdminSummary: jest.fn().mockResolvedValue(billingSummary),
    };
    const botLimitService = {
      resolveOverLimitLockedBotIdSet: jest
        .fn()
        .mockResolvedValue(overrides?.lockedBotIds ?? new Set([botId])),
    };
    const workspacesService = {
      listWorkspaceMembers: jest.fn().mockResolvedValue(
        overrides?.members ?? [
          {
            userId: '507f1f77bcf86cd799439014',
            email: 'owner@example.com',
            displayName: 'Owner User',
            role: 'owner',
            membershipStatus: 'active',
            joinedAt: new Date('2026-01-01'),
          },
          {
            userId: '507f1f77bcf86cd799439015',
            email: 'member@example.com',
            displayName: 'Member User',
            role: 'member',
            membershipStatus: 'inactive_over_limit',
            joinedAt: new Date('2026-02-01'),
          },
        ],
      ),
    };
    const inviteService = {
      listInvitesForWorkspace: jest.fn().mockResolvedValue(
        overrides?.invites ?? [
          {
            id: 'inv-1',
            email: 'pending@example.com',
            role: 'member',
            status: 'pending',
            createdAt: '2026-05-01T00:00:00.000Z',
            expiresAt: '2026-06-01T00:00:00.000Z',
          },
        ],
      ),
    };
    const usageAnalyticsService = {
      getAnalytics: jest.fn().mockResolvedValue({
        dateRange: { startDate: '2026-05-01', endDate: '2026-05-31' },
        usageTrend: [],
        aiCreditsByAgent: [],
        trainedKnowledgeByAgent: [],
      }),
    };

    const workspaceModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest
              .fn()
              .mockResolvedValue(
                overrides?.workspaceDoc === null
                  ? null
                  : (overrides?.workspaceDoc ?? {
                      name: 'Acme Workspace',
                      onboardingStatus: 'completed',
                      createdAt: new Date('2026-01-01'),
                    }),
              ),
          }),
        }),
      }),
    };

    const botModel = {
      find: jest.fn().mockImplementation((query: Record<string, unknown>) => {
        if (query._id) {
          return {
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(botId), name: 'Support Bot' }]),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(
                  overrides?.bots ?? [
                    {
                      _id: new Types.ObjectId(botId),
                      name: 'Support Bot',
                      status: 'published',
                      visibility: 'private',
                      createdAt: new Date('2026-01-15'),
                      updatedAt: new Date('2026-05-01'),
                      shareChat: { enabled: true, slug: 'abc', tokenHash: 'hash' },
                    },
                  ],
                ),
              }),
            }),
          }),
        };
      }),
    };

    const conversationModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(botId), count: 12 }]),
      }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(
                  overrides?.conversations ?? [
                    {
                      _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
                      botId: new Types.ObjectId(botId),
                      startedFrom: 'runtime_widget',
                      totalMessages: 8,
                      totalCreditsUsed: 4,
                      lastActivityAt: new Date('2026-05-20'),
                      hasLead: true,
                      location: { countryCode: 'US' },
                      deviceInfo: { deviceType: 'mobile' },
                    },
                  ],
                ),
              }),
            }),
          }),
        }),
      }),
    };

    const service = new AdminWorkspaceSupportService(
      billingSummaryService as never,
      botLimitService as never,
      workspacesService as never,
      inviteService as never,
      usageAnalyticsService as never,
      workspaceModel as never,
      botModel as never,
      conversationModel as never,
    );

    return {
      service,
      billingSummaryService,
      usageAnalyticsService,
    };
  }

  it('returns workspace support summary with billing, agents, members, and webhooks', async () => {
    const { service } = buildService();
    const result = await service.getSupportSummary(workspaceId);

    expect(result.workspace).toMatchObject({
      id: workspaceId,
      name: 'Acme Workspace',
    });
    expect(result.owner).toMatchObject({
      email: 'owner@example.com',
      name: 'Owner User',
    });
    expect(result.subscription).toEqual(billingSummary.subscription);
    expect(result.billing.support?.provider.providerCustomerId).toBe('cust-1');
    expect(result.usage.lockedAgentsCount).toBe(1);
    expect(result.usage.inactiveMembersCount).toBe(1);
    expect(result.agents[0]).toMatchObject({
      id: botId,
      isOverLimitLocked: true,
      conversationCount: 12,
      creditsUsedThisPeriod: 80,
    });
    expect(result.members).toHaveLength(2);
    expect(result.invites).toHaveLength(1);
    expect(result.webhookHealth.failedCount).toBe(1);
    expect(result.recentEvents).toHaveLength(1);
    expect(result.conversations[0]).toMatchObject({
      botName: 'Support Bot',
      leadCaptured: true,
      country: 'US',
      device: 'mobile',
    });
  });

  it('returns safe nulls when workspace has no billing provider data', async () => {
    const { service, billingSummaryService } = buildService();
    billingSummaryService.getAdminSummary.mockResolvedValue({
      ...billingSummary,
      subscription: {
        provider: null,
        subscriptionStatus: 'free',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '',
        hasActivePaidSubscription: false,
        customerPortalAvailable: false,
        manageBillingAvailable: false,
      },
      support: {
        provider: {
          provider: null,
          providerCustomerId: null,
          providerSubscriptionId: null,
          providerVariantId: null,
          subscriptionStatus: 'free',
          cancelAtPeriodEnd: false,
          currentPeriodStart: '',
          currentPeriodEnd: '',
        },
        addons: [],
        topUps: [],
        webhookEvents: [],
      },
    });

    const result = await service.getSupportSummary(workspaceId);
    expect(result.subscription.provider).toBeNull();
    expect(result.billing.support?.provider.providerCustomerId).toBeNull();
    expect(result.webhookHealth.failedCount).toBe(0);
    expect(result.recentEvents).toEqual([]);
  });

  it('throws 404 for missing workspace', async () => {
    const { service } = buildService({ workspaceDoc: null });
    await expect(service.getSupportSummary(workspaceId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 404 for invalid workspace id', async () => {
    const { service } = buildService();
    await expect(service.getSupportSummary('not-an-id')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates usage analytics to WorkspaceUsageAnalyticsService', async () => {
    const { service, usageAnalyticsService } = buildService();
    const result = await service.getUsageAnalytics(workspaceId, {
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      botIds: botId,
    });

    expect(usageAnalyticsService.getAnalytics).toHaveBeenCalledWith(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-31', botIds: botId },
      expect.any(Date),
    );
    expect(result.dateRange.startDate).toBe('2026-05-01');
  });
});
