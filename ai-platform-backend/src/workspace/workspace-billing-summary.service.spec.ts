import { Types } from 'mongoose';
import { megabytesToBytes } from '../entitlements/plan-catalog';
import { WorkspaceBillingSummaryService } from './workspace-billing-summary.service';
import { TRAINED_KNOWLEDGE_USAGE_NOTE } from './workspace-billing-summary.util';

describe('WorkspaceBillingSummaryService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botId = '507f1f77bcf86cd799439013';
  const periodStart = new Date('2026-05-01T00:00:00.000Z');
  const periodEnd = new Date('2026-06-01T00:00:00.000Z');

  function createService(options?: {
    planKey?: 'free' | 'starter' | 'pro';
    subscription?: {
      planKey: 'free' | 'starter' | 'pro';
      status: 'free' | 'active';
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
    } | null;
    memberUsage?: {
      memberCount: number;
      pendingInviteCount: number;
    };
    botCount?: number;
    aiCreditsUsed?: number;
    knowledgeUsage?: {
      totalBytes: number;
      maxBytes: number;
      percentUsed: number;
    };
  }) {
    const planKey = options?.planKey ?? 'free';
    const planDefs = {
      free: {
        planKey: 'free' as const,
        planName: 'Free',
        subscriptionStatus: 'free' as const,
        botLimit: 1,
        memberLimit: 3,
        monthlyAiCredits: 50,
        kbStorageMbPerBot: 5,
        kbStorageBytesPerBot: megabytesToBytes(5),
        maxKbStorageMbPerBot: 40,
        maxKbStorageBytesPerBot: megabytesToBytes(40),
        analyticsHistoryDays: 7,
        canExportReports: false,
        showPoweredByAssistrio: true,
        canRemoveBranding: false,
        activeAddons: [] as string[],
        topUpCreditsRemaining: 0,
      },
      starter: {
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
        activeAddons: [] as string[],
        topUpCreditsRemaining: 0,
      },
      pro: {
        planKey: 'pro' as const,
        planName: 'Pro',
        subscriptionStatus: 'active' as const,
        botLimit: 1,
        memberLimit: 5,
        monthlyAiCredits: 3000,
        kbStorageMbPerBot: 30,
        kbStorageBytesPerBot: megabytesToBytes(30),
        maxKbStorageMbPerBot: 40,
        maxKbStorageBytesPerBot: megabytesToBytes(40),
        analyticsHistoryDays: null,
        canExportReports: true,
        showPoweredByAssistrio: true,
        canRemoveBranding: false,
        activeAddons: [] as string[],
        topUpCreditsRemaining: 0,
      },
    };
    const entitlements = { workspaceId, ...planDefs[planKey] };

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue(entitlements),
    };
    const subscriptionsService = {
      findByWorkspaceId: jest.fn().mockResolvedValue(
        options?.subscription ??
          (planKey === 'free'
            ? null
            : {
                workspaceId: new Types.ObjectId(workspaceId),
                planKey,
                status: 'active',
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              }),
      ),
    };
    const memberUsage = options?.memberUsage ?? { memberCount: 1, pendingInviteCount: 1 };
    const memberLimitService = {
      getWorkspaceMemberUsage: jest.fn().mockResolvedValue({
        current: memberUsage.memberCount + memberUsage.pendingInviteCount,
        limit: entitlements.memberLimit,
        planKey: entitlements.planKey,
        planName: entitlements.planName,
        memberCount: memberUsage.memberCount,
        pendingInviteCount: memberUsage.pendingInviteCount,
      }),
    };
    const botCount = options?.botCount ?? 1;
    const botLimitService = {
      getWorkspaceBotUsage: jest.fn().mockResolvedValue({
        current: botCount,
        limit: entitlements.botLimit,
        planKey: entitlements.planKey,
        planName: entitlements.planName,
      }),
    };
    const aiCreditsUsed = options?.aiCreditsUsed ?? 12;
    const aiCreditsUsageService = {
      getWorkspaceAiCreditsUsage: jest.fn().mockResolvedValue({
        workspaceId,
        billingPeriod: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
        planKey: entitlements.planKey,
        planName: entitlements.planName,
        monthlyAiCredits: entitlements.monthlyAiCredits,
        monthlyCreditsUsed: aiCreditsUsed,
        monthlyCreditsRemaining: Math.max(0, entitlements.monthlyAiCredits - aiCreditsUsed),
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: entitlements.monthlyAiCredits,
        isOverLimit: aiCreditsUsed > entitlements.monthlyAiCredits,
        byBot: [{ botId, creditsUsed: aiCreditsUsed }],
      }),
    };
    const knowledgeUsage = options?.knowledgeUsage ?? {
      totalBytes: 2 * 1024 * 1024,
      maxBytes: megabytesToBytes(5),
      percentUsed: 40,
    };
    const knowledgeUsageService = {
      getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({
        totalBytes: knowledgeUsage.totalBytes,
        trainableBytes: knowledgeUsage.totalBytes,
        maxBytes: knowledgeUsage.maxBytes,
        remainingBytes: knowledgeUsage.maxBytes - knowledgeUsage.totalBytes,
        percentUsed: knowledgeUsage.percentUsed,
        documentBytes: knowledgeUsage.totalBytes,
        faqBytes: 0,
        noteBytes: 0,
        tableBytes: 0,
        suggestionBytes: 0,
        otherBytes: 0,
        itemCount: 1,
        documentCount: 1,
        faqCount: 0,
        noteCount: 0,
        tableCount: 0,
        suggestionCount: 0,
      }),
    };
    const botModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              {
                _id: new Types.ObjectId(botId),
                name: 'Support Agent',
                workspaceId: new Types.ObjectId(workspaceId),
                botConfig: {},
              },
            ]),
          }),
        }),
      }),
    };
    const workspaceModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ name: 'Acme Workspace' }),
          }),
        }),
      }),
    };
    const membershipModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ userId: new Types.ObjectId('507f1f77bcf86cd799439014') }),
          }),
        }),
      }),
    };
    const userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ email: 'owner@example.com' }),
          }),
        }),
      }),
    };
    const subscriptionModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              _id: new Types.ObjectId('507f1f77bcf86cd799439015'),
              createdAt: periodStart,
              updatedAt: periodEnd,
            }),
          }),
        }),
      }),
    };
    const usageLedgerModel = {
      countDocuments: jest.fn().mockResolvedValue(42),
    };

    const service = new WorkspaceBillingSummaryService(
      entitlementsService as never,
      subscriptionsService as never,
      memberLimitService as never,
      botLimitService as never,
      aiCreditsUsageService as never,
      knowledgeUsageService as never,
      botModel as never,
      workspaceModel as never,
      membershipModel as never,
      userModel as never,
      subscriptionModel as never,
      usageLedgerModel as never,
    );

    return {
      service,
      entitlementsService,
      memberLimitService,
      botLimitService,
      aiCreditsUsageService,
      knowledgeUsageService,
    };
  }

  it('returns Free plan data when subscription is missing', async () => {
    const { service } = createService({ planKey: 'free', subscription: null });
    const summary = await service.getSummary(workspaceId);

    expect(summary.workspaceId).toBe(workspaceId);
    expect(summary.plan).toMatchObject({
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      status: 'free',
    });
    expect(summary.entitlements.kbStorageMbPerBot).toBe(5);
    expect(summary.entitlements.maxKbStorageMbPerBot).toBe(40);
  });

  it('includes Starter and Pro trained knowledge limits in entitlements', async () => {
    const starter = await createService({ planKey: 'starter' }).service.getSummary(workspaceId);
    const pro = await createService({ planKey: 'pro' }).service.getSummary(workspaceId);

    expect(starter.entitlements.kbStorageMbPerBot).toBe(15);
    expect(pro.entitlements.kbStorageMbPerBot).toBe(30);
  });

  it('counts active members and pending invites in member usage', async () => {
    const { service } = createService({
      memberUsage: { memberCount: 2, pendingInviteCount: 1 },
    });
    const summary = await service.getSummary(workspaceId);

    expect(summary.usage.members).toEqual({
      current: 2,
      pendingInvites: 1,
      used: 3,
      limit: 3,
    });
  });

  it('includes bot usage from workspace bot limit service', async () => {
    const { service, botLimitService } = createService({ botCount: 1 });
    const summary = await service.getSummary(workspaceId);

    expect(botLimitService.getWorkspaceBotUsage).toHaveBeenCalledWith(workspaceId);
    expect(summary.usage.bots).toEqual({ current: 1, limit: 1 });
  });

  it('includes AI credit usage from existing service', async () => {
    const { service, aiCreditsUsageService } = createService({ aiCreditsUsed: 25 });
    const summary = await service.getSummary(workspaceId);

    expect(aiCreditsUsageService.getWorkspaceAiCreditsUsage).toHaveBeenCalledWith(
      workspaceId,
      expect.any(Date),
    );
    expect(summary.usage.aiCredits).toMatchObject({
      monthlyCredits: 50,
      monthlyCreditsUsed: 25,
      monthlyCreditsRemaining: 25,
      topUpCreditsRemaining: 0,
      totalCreditsAvailable: 50,
      totalCreditsRemaining: 25,
      isOverLimit: false,
      byBot: [{ botId, creditsUsed: 25 }],
    });
    expect(summary.usage.aiCredits.periodStart).toBe(periodStart.toISOString());
  });

  it('includes trained knowledge per-bot usage', async () => {
    const { service, knowledgeUsageService } = createService({
      knowledgeUsage: {
        totalBytes: 3 * 1024 * 1024,
        maxBytes: megabytesToBytes(5),
        percentUsed: 60,
      },
    });
    const summary = await service.getSummary(workspaceId);

    expect(knowledgeUsageService.getActiveBotKnowledgeUsage).toHaveBeenCalled();
    expect(summary.usage.trainedKnowledge.perBot).toEqual([
      expect.objectContaining({
        botId,
        botName: 'Support Agent',
        usedBytes: 3 * 1024 * 1024,
        maxBytes: megabytesToBytes(5),
        usedMb: 3,
        maxMb: 5,
        percentUsed: 60,
      }),
    ]);
    expect(summary.usage.trainedKnowledge.totalUsedBytes).toBe(3 * 1024 * 1024);
    expect(summary.usage.trainedKnowledge.note).toBe(TRAINED_KNOWLEDGE_USAGE_NOTE);
  });

  it('includes public plan catalog snapshot for Free, Starter, and Pro', async () => {
    const { service } = createService();
    const summary = await service.getSummary(workspaceId);

    expect(summary.planCatalog.map((p) => p.key)).toEqual(['free', 'starter', 'pro']);
    expect(summary.planCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'free', kbStorageMbPerBot: 5, priceMonthly: 0 }),
        expect.objectContaining({ key: 'starter', kbStorageMbPerBot: 15, priceMonthly: 49 }),
        expect.objectContaining({ key: 'pro', kbStorageMbPerBot: 30, priceMonthly: 99 }),
      ]),
    );
  });

  it('marks add-on catalog checkout as unavailable', async () => {
    const { service } = createService();
    const summary = await service.getSummary(workspaceId);

    expect(summary.addonCatalog.map((a) => a.key)).toEqual([
      'ai_credits_1000',
      'extra_bot',
      'remove_branding',
      'kb_storage_5mb',
      'kb_storage_10mb',
    ]);
    expect(summary.addonCatalog.every((addon) => addon.checkoutAvailable === false)).toBe(true);
  });

  it('returns admin metadata with plan, usage, entitlements, and Free fallback', async () => {
    const { service } = createService({ planKey: 'free', subscription: null });
    const summary = await service.getAdminSummary(workspaceId);

    expect(summary.plan).toMatchObject({ key: 'free', name: 'Free', status: 'free' });
    expect(summary.entitlements).toMatchObject({
      monthlyAiCredits: 50,
      canExportReports: false,
      canRemoveBranding: false,
    });
    expect(summary.usage.aiCredits).toMatchObject({ monthlyCreditsUsed: 12, monthlyCredits: 50 });
    expect(summary.admin).toMatchObject({
      workspaceName: 'Acme Workspace',
      workspaceOwnerEmail: 'owner@example.com',
      subscriptionId: '507f1f77bcf86cd799439015',
      usageLedgerCount: 42,
    });
  });
});
