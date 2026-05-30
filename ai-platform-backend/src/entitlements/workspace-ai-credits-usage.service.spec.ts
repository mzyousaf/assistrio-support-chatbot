import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';

describe('WorkspaceAiCreditsUsageService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';

  it('includes top-up credits in totals when monthly cap reached', async () => {
    const entitlementsService = {
      resolveForWorkspace: jest.fn().mockResolvedValue({
        workspaceId,
        planKey: 'starter',
        planName: 'Starter',
        monthlyAiCredits: 500,
        isTrialPlan: false,
        isTrialExpired: false,
        creditsRenewMonthly: true,
        trialStartedAt: null,
        trialEndsAt: null,
        topUpCreditsRemaining: 300,
      }),
    } as unknown as WorkspaceEntitlementsService;

    const usageLedgerModel = {
      aggregate: jest
        .fn()
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([{ total: 500 }]) })
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue([]) }),
    };

    const service = new WorkspaceAiCreditsUsageService(usageLedgerModel as never, entitlementsService);
    const summary = await service.getWorkspaceAiCreditsUsage(workspaceId, new Date('2026-06-15'));

    expect(summary.monthlyCreditsRemaining).toBe(0);
    expect(summary.topUpCreditsRemaining).toBe(300);
    expect(summary.totalCreditsAvailable).toBe(800);
    expect(summary.isOverLimit).toBe(false);
  });
});
