import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import {
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_MESSAGE,
  WorkspaceAiCreditGateService,
} from './workspace-ai-credit-gate.service';
import type { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';

const workspaceId = '507f1f77bcf86cd799439011';
const periodStart = new Date(2026, 4, 1, 0, 0, 0, 0);
const periodEnd = new Date(2026, 5, 1, 0, 0, 0, 0);
const now = new Date(2026, 4, 15, 12, 0, 0, 0);

function usageSummary(monthlyCreditsUsed: number) {
  return {
    workspaceId,
    billingPeriod: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    planKey: 'free' as const,
    planName: 'Free',
    monthlyAiCredits: 50,
    monthlyCreditsUsed,
    monthlyCreditsRemaining: Math.max(0, 50 - monthlyCreditsUsed),
    topUpCreditsRemaining: 0,
    totalCreditsAvailable: 50,
    isOverLimit: monthlyCreditsUsed > 50,
    byBot: [],
  };
}

function createService(options: {
  monthlyCreditsUsed: number;
  usageReadError?: boolean;
  monthlyAiCredits?: number;
}) {
  const monthlyAiCredits = options.monthlyAiCredits ?? 50;
  const usageService = {
    getWorkspaceAiCreditsUsage: options.usageReadError
      ? jest.fn().mockRejectedValue(new Error('mongo down'))
      : jest.fn().mockResolvedValue({
          ...usageSummary(options.monthlyCreditsUsed),
          monthlyAiCredits,
          monthlyCreditsRemaining: Math.max(0, monthlyAiCredits - options.monthlyCreditsUsed),
          totalCreditsAvailable: monthlyAiCredits,
          isOverLimit: options.monthlyCreditsUsed > monthlyAiCredits,
        }),
  } as unknown as WorkspaceAiCreditsUsageService;

  return {
    service: new WorkspaceAiCreditGateService(usageService),
    usageService,
  };
}

describe('WorkspaceAiCreditGateService', () => {
  it('allows when under monthly limit', async () => {
    const { service } = createService({ monthlyCreditsUsed: 10 });
    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).resolves.toBeUndefined();
  });

  it('allows when exactly at remaining limit', async () => {
    const { service } = createService({ monthlyCreditsUsed: 49 });
    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).resolves.toBeUndefined();
  });

  it('blocks when estimated credits exceed remaining allowance', async () => {
    const { service } = createService({ monthlyCreditsUsed: 49.75 });

    await expect(service.assertCanUseAiCredits(workspaceId, 0.5, now)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        message: PLAN_LIMIT_AI_CREDITS_MESSAGE,
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        usage: {
          current: 49.75,
          attempted: 0.5,
          limit: 50,
          remaining: 0.25,
          planKey: 'free',
          planName: 'Free',
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
      },
    });
  });

  it('blocks when workspace is already at or over limit', async () => {
    const { service } = createService({ monthlyCreditsUsed: 50 });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toBeInstanceOf(HttpException);
  });

  it('no-ops for zero or negative estimated credits (non-billable / quick reply path)', async () => {
    const { service, usageService } = createService({ monthlyCreditsUsed: 50 });
    await expect(service.assertCanUseAiCredits(workspaceId, 0, now)).resolves.toBeUndefined();
    await expect(service.assertCanUseAiCredits(workspaceId, -1, now)).resolves.toBeUndefined();
    expect(usageService.getWorkspaceAiCreditsUsage).not.toHaveBeenCalled();
  });

  it('accepts fractional dictation-style estimates at remaining limit', async () => {
    const { service } = createService({ monthlyCreditsUsed: 49.75 });
    await expect(service.assertCanUseAiCredits(workspaceId, 0.25, now)).resolves.toBeUndefined();
  });

  it('returns structured usage context in plan_limit_ai_credits payload', async () => {
    const { service } = createService({ monthlyCreditsUsed: 48 });

    try {
      await service.assertCanUseAiCredits(workspaceId, 5, now);
      fail('expected HttpException');
    } catch (err) {
      expect(err).toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: {
          errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
          usage: expect.objectContaining({
            current: 48,
            attempted: 5,
            limit: 50,
            remaining: 2,
            planKey: 'free',
            planName: 'Free',
          }),
        },
      });
    }
  });

  it('fails closed with service unavailable when usage read fails', async () => {
    const { service } = createService({ monthlyCreditsUsed: 0, usageReadError: true });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
