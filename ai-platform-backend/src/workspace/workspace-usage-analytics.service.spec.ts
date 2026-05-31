import { Types } from 'mongoose';
import { WorkspaceUsageAnalyticsService } from './workspace-usage-analytics.service';

describe('WorkspaceUsageAnalyticsService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const botA = '507f1f77bcf86cd799439012';
  const botB = '507f1f77bcf86cd799439013';

  function createService(options?: {
    ledgerRows?: Array<Record<string, unknown>>;
    bots?: Array<{ _id: string; name: string }>;
    monthlyAiCredits?: number;
    analyticsHistoryDays?: number | null;
    knowledgeUsage?: { usedMb: number; maxMb: number; percentUsed: number };
  }) {
    const usageLedgerModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(options?.ledgerRows ?? []),
            }),
          }),
        }),
      }),
    };

    const botModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(
              (options?.bots ?? [{ _id: botA, name: 'Agent A' }]).map((bot) => ({
                _id: new Types.ObjectId(bot._id),
                name: bot.name,
              })),
            ),
          }),
        }),
      }),
    };

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        monthlyAiCredits: options?.monthlyAiCredits ?? 50,
        analyticsHistoryDays: options?.analyticsHistoryDays ?? null,
      }),
    };

    const knowledgeUsage = options?.knowledgeUsage ?? { usedMb: 2, maxMb: 15, percentUsed: 13.33 };
    const knowledgeUsageService = {
      getActiveBotKnowledgeUsage: jest.fn().mockResolvedValue({
        totalBytes: knowledgeUsage.usedMb * 1024 * 1024,
        maxBytes: knowledgeUsage.maxMb * 1024 * 1024,
        percentUsed: knowledgeUsage.percentUsed,
      }),
    };

    const service = new WorkspaceUsageAnalyticsService(
      usageLedgerModel as never,
      botModel as never,
      entitlementsService as never,
      knowledgeUsageService as never,
    );

    return { service, usageLedgerModel, botModel };
  }

  it('returns daily trend rows with missing days filled as zero', async () => {
    const { service } = createService({
      ledgerRows: [
        {
          botId: new Types.ObjectId(botA),
          creditsUsed: 10,
          chargedAt: new Date('2026-05-02T12:00:00.000Z'),
          billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
    });

    const result = await service.getAnalytics(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-03' },
      new Date('2026-05-03T12:00:00.000Z'),
    );

    expect(result.usageTrend).toEqual([
      { date: '2026-05-01', totalCreditsUsed: 0, monthlyCreditsUsed: 0, topUpCreditsUsed: 0 },
      { date: '2026-05-02', totalCreditsUsed: 10, monthlyCreditsUsed: 10, topUpCreditsUsed: 0 },
      { date: '2026-05-03', totalCreditsUsed: 0, monthlyCreditsUsed: 0, topUpCreditsUsed: 0 },
    ]);
  });

  it('splits monthly and top-up credits correctly across events', async () => {
    const { service } = createService({
      monthlyAiCredits: 50,
      ledgerRows: [
        {
          botId: new Types.ObjectId(botA),
          creditsUsed: 30,
          chargedAt: new Date('2026-05-02T10:00:00.000Z'),
          billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          botId: new Types.ObjectId(botA),
          creditsUsed: 25,
          chargedAt: new Date('2026-05-02T11:00:00.000Z'),
          billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
    });

    const result = await service.getAnalytics(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-02' },
      new Date('2026-05-02T12:00:00.000Z'),
    );

    expect(result.usageTrend[1]).toEqual({
      date: '2026-05-02',
      totalCreditsUsed: 55,
      monthlyCreditsUsed: 50,
      topUpCreditsUsed: 5,
    });
  });

  it('filters usage by botIds within workspace', async () => {
    const { service, usageLedgerModel } = createService({
      bots: [
        { _id: botA, name: 'Agent A' },
        { _id: botB, name: 'Agent B' },
      ],
      ledgerRows: [
        {
          botId: new Types.ObjectId(botA),
          creditsUsed: 12,
          chargedAt: new Date('2026-05-02T12:00:00.000Z'),
          billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
    });

    await service.getAnalytics(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-02', botIds: botA },
      new Date('2026-05-02T12:00:00.000Z'),
    );

    expect(usageLedgerModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        botId: { $in: [new Types.ObjectId(botA)] },
      }),
    );
  });

  it('returns per-agent credits with message counts', async () => {
    const { service } = createService({
      bots: [
        { _id: botA, name: 'Agent A' },
        { _id: botB, name: 'Agent B' },
      ],
      ledgerRows: [
        {
          botId: new Types.ObjectId(botA),
          creditsUsed: 4,
          chargedAt: new Date('2026-05-02T12:00:00.000Z'),
          billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
          messageId: new Types.ObjectId(),
        },
        {
          botId: new Types.ObjectId(botB),
          creditsUsed: 6,
          chargedAt: new Date('2026-05-02T13:00:00.000Z'),
          billingPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
          billingPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
          messageId: new Types.ObjectId(),
        },
      ],
    });

    const result = await service.getAnalytics(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-02' },
      new Date('2026-05-02T12:00:00.000Z'),
    );

    expect(result.aiCreditsByAgent).toEqual([
      expect.objectContaining({ botId: botB, totalCreditsUsed: 6, messageCount: 1 }),
      expect.objectContaining({ botId: botA, totalCreditsUsed: 4, messageCount: 1 }),
    ]);
  });

  it('filters trained knowledge by botIds', async () => {
    const { service } = createService({
      bots: [
        { _id: botA, name: 'Agent A' },
        { _id: botB, name: 'Agent B' },
      ],
    });

    const result = await service.getAnalytics(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-02', botIds: botA },
      new Date('2026-05-02T12:00:00.000Z'),
    );

    expect(result.trainedKnowledgeByAgent).toHaveLength(1);
    expect(result.trainedKnowledgeByAgent[0]?.botId).toBe(botA);
  });

  it('isolates workspace bots and ignores foreign botIds', async () => {
    const { service } = createService({
      bots: [{ _id: botA, name: 'Agent A' }],
    });

    const result = await service.getAnalytics(
      workspaceId,
      { startDate: '2026-05-01', endDate: '2026-05-02', botIds: 'foreign-bot-id' },
      new Date('2026-05-02T12:00:00.000Z'),
    );

    expect(result.aiCreditsByAgent).toEqual([]);
    expect(result.usageTrend.every((row) => row.totalCreditsUsed === 0)).toBe(true);
  });
});
