import { Types } from 'mongoose';
import { megabytesToBytes } from './plan-catalog';
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

const workspaceId = '507f1f77bcf86cd799439011';

function freeEntitlements() {
  return {
    workspaceId,
    planKey: 'free' as const,
    planName: 'Free',
    subscriptionStatus: 'free' as const,
    botLimit: 1,
    memberLimit: 3,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 10,
    kbStorageBytesPerBot: megabytesToBytes(10),
    maxKbStorageMbPerBot: 40,
    maxKbStorageBytesPerBot: megabytesToBytes(40),
    analyticsHistoryDays: 7,
    canExportReports: false,
    showPoweredByAssistrio: true,
    canRemoveBranding: false,
    activeAddons: [],
    topUpCreditsRemaining: 0,
  };
}

describe('WorkspaceAiCreditsUsageService', () => {
  const periodStart = new Date(2026, 4, 1, 0, 0, 0, 0);
  const periodEnd = new Date(2026, 5, 1, 0, 0, 0, 0);
  const now = new Date(2026, 4, 15, 12, 0, 0, 0);

  function createService(aggregateResults: {
    total?: number;
    byBot?: Array<{ _id: Types.ObjectId; creditsUsed: number }>;
  }) {
    const exec = jest.fn().mockResolvedValueOnce(
      aggregateResults.total != null ? [{ total: aggregateResults.total }] : [],
    );
    if (aggregateResults.byBot != null) {
      exec.mockResolvedValueOnce(aggregateResults.byBot);
    } else {
      exec.mockResolvedValueOnce([]);
    }

    const usageLedgerModel = {
      aggregate: jest.fn().mockReturnValue({ exec }),
    };

    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue(freeEntitlements()),
    } as unknown as WorkspaceEntitlementsService;

    return {
      service: new WorkspaceAiCreditsUsageService(usageLedgerModel as never, entitlementsService),
      usageLedgerModel,
      entitlementsService,
    };
  }

  it('returns Free monthly limit 50', async () => {
    const { service } = createService({ total: 0, byBot: [] });
    const summary = await service.getWorkspaceAiCreditsUsage(workspaceId, now);

    expect(summary.planKey).toBe('free');
    expect(summary.monthlyAiCredits).toBe(50);
    expect(summary.totalCreditsAvailable).toBe(50);
    expect(summary.topUpCreditsRemaining).toBe(0);
    expect(summary.billingPeriod.start).toBe(periodStart.toISOString());
    expect(summary.billingPeriod.end).toBe(periodEnd.toISOString());
  });

  it('sums current billing period records', async () => {
    const botId = new Types.ObjectId('507f1f77bcf86cd799439012');
    const { service, usageLedgerModel } = createService({
      total: 12,
      byBot: [{ _id: botId, creditsUsed: 12 }],
    });

    const summary = await service.getWorkspaceAiCreditsUsage(workspaceId, now);

    expect(summary.monthlyCreditsUsed).toBe(12);
    expect(summary.monthlyCreditsRemaining).toBe(38);
    expect(summary.isOverLimit).toBe(false);
    expect(summary.byBot).toEqual([{ botId: String(botId), creditsUsed: 12 }]);

    const periodMatch = {
      workspaceId: new Types.ObjectId(workspaceId),
      chargedAt: { $gte: periodStart, $lt: periodEnd },
    };
    expect(usageLedgerModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: periodMatch }]),
    );
  });

  it('ignores records outside current billing period via chargedAt filter', async () => {
    const { service, usageLedgerModel } = createService({ total: 5, byBot: [] });
    await service.getWorkspaceAiCreditsUsage(workspaceId, now);

    const matchStage = usageLedgerModel.aggregate.mock.calls[0]?.[0]?.[0]?.$match;
    expect(matchStage.chargedAt.$gte).toEqual(periodStart);
    expect(matchStage.chargedAt.$lt).toEqual(periodEnd);
  });

  it('returns remaining 0 and isOverLimit=true when usage exceeds monthly credits', async () => {
    const { service } = createService({ total: 75, byBot: [] });
    const summary = await service.getWorkspaceAiCreditsUsage(workspaceId, now);

    expect(summary.monthlyCreditsUsed).toBe(75);
    expect(summary.monthlyCreditsRemaining).toBe(0);
    expect(summary.isOverLimit).toBe(true);
  });

  it('falls back to Free entitlements when subscription is missing', async () => {
    const { service, entitlementsService } = createService({ total: 0, byBot: [] });
    await service.getWorkspaceAiCreditsUsage(workspaceId, now);
    expect(entitlementsService.resolveForWorkspace).toHaveBeenCalledWith(workspaceId);
  });
});
