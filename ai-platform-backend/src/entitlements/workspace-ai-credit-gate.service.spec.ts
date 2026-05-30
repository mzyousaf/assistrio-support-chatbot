import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import {
  FREE_TRIAL_EXPIRED_CODE,
  FREE_TRIAL_EXPIRED_MESSAGE,
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_TRIAL_MESSAGE,
  WorkspaceAiCreditGateService,
} from './workspace-ai-credit-gate.service';
import type { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';

const workspaceId = '507f1f77bcf86cd799439011';
const periodStart = new Date(2026, 4, 1, 0, 0, 0, 0);
const periodEnd = new Date(2026, 4, 8, 0, 0, 0, 0);
const now = new Date(2026, 4, 4, 12, 0, 0, 0);

function usageSummary(overrides: Record<string, unknown> = {}) {
  return { ...baseSummary(), ...overrides };
}

function baseSummary() {
  return {
    workspaceId,
    billingPeriod: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
    planKey: 'free' as const,
    planName: 'Free',
    monthlyAiCredits: 50,
    monthlyCreditsUsed: 0,
    monthlyCreditsRemaining: 50,
    topUpCreditsRemaining: 0,
    totalCreditsAvailable: 50,
    isOverLimit: false,
    isTrialPlan: true,
    isTrialExpired: false,
    creditsRenewMonthly: false,
    byBot: [],
  };
}

function createService(options: {
  summary?: ReturnType<typeof usageSummary>;
  usageReadError?: boolean;
}) {
  const usageService = {
    getWorkspaceAiCreditsUsage: options.usageReadError
      ? jest.fn().mockRejectedValue(new Error('mongo down'))
      : jest.fn().mockResolvedValue(options.summary ?? usageSummary()),
  } as unknown as WorkspaceAiCreditsUsageService;

  return {
    service: new WorkspaceAiCreditGateService(usageService),
    usageService,
  };
}

describe('WorkspaceAiCreditGateService', () => {
  it('allows when under trial credit limit', async () => {
    const { service } = createService({ summary: usageSummary({ monthlyCreditsUsed: 10 }) });
    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).resolves.toBeUndefined();
  });

  it('blocks expired free trial with free_trial_expired', async () => {
    const { service } = createService({
      summary: usageSummary({ isTrialExpired: true, monthlyCreditsRemaining: 0, totalCreditsAvailable: 0 }),
    });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        message: FREE_TRIAL_EXPIRED_MESSAGE,
        errorCode: FREE_TRIAL_EXPIRED_CODE,
      },
    });
  });

  it('blocks when trial credits are exhausted with upgrade copy', async () => {
    const { service } = createService({
      summary: usageSummary({ monthlyCreditsUsed: 50, monthlyCreditsRemaining: 0, isOverLimit: true }),
    });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      response: {
        message: PLAN_LIMIT_AI_CREDITS_TRIAL_MESSAGE,
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
      },
    });
  });

  it('allows when monthly credits exhausted but top-up credits remain', async () => {
    const { service } = createService({
      summary: usageSummary({
        planKey: 'starter',
        planName: 'Starter',
        isTrialPlan: false,
        creditsRenewMonthly: true,
        monthlyAiCredits: 500,
        monthlyCreditsUsed: 500,
        monthlyCreditsRemaining: 0,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        isOverLimit: false,
      }),
    });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).resolves.toBeUndefined();
  });

  it('blocks when monthly and top-up credits are exhausted', async () => {
    const { service } = createService({
      summary: usageSummary({
        planKey: 'starter',
        planName: 'Starter',
        isTrialPlan: false,
        monthlyAiCredits: 500,
        monthlyCreditsUsed: 500,
        monthlyCreditsRemaining: 0,
        topUpCreditsRemaining: 0,
        isOverLimit: true,
      }),
    });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toMatchObject({
      response: { errorCode: PLAN_LIMIT_AI_CREDITS_CODE },
    });
  });

  it('blocks paid plan monthly credits with standard message', async () => {
    const { service } = createService({
      summary: usageSummary({
        planKey: 'starter',
        planName: 'Starter',
        isTrialPlan: false,
        creditsRenewMonthly: true,
        monthlyAiCredits: 500,
        monthlyCreditsUsed: 500,
        monthlyCreditsRemaining: 0,
        isOverLimit: true,
      }),
    });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toMatchObject({
      response: {
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        message: 'Your workspace has used all AI credits for this billing period.',
      },
    });
  });

  it('fails closed with service unavailable when usage read fails', async () => {
    const { service } = createService({ usageReadError: true });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
