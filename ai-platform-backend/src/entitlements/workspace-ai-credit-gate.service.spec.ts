import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FREE_TRIAL_EXPIRED_CODE,
  FREE_TRIAL_EXPIRED_MESSAGE,
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_TRIAL_MESSAGE,
  WorkspaceAiCreditGateService,
} from './workspace-ai-credit-gate.service';
import type { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import type { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import type { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';
import type { WorkspaceCreditTopUpService } from './workspace-credit-topup.service';
import type { BillingAiCreditsAutoTopUpService } from '../billing/billing-ai-credits-auto-topup.service';

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
  subscription?: Record<string, unknown> | null;
  entitlements?: Record<string, unknown>;
  autoTopUpFulfill?: { ok: boolean; creditsAdded?: number };
  topUpRemainingAfterFulfill?: number;
}) {
  const usageService = {
    getWorkspaceAiCreditsUsage: options.usageReadError
      ? jest.fn().mockRejectedValue(new Error('mongo down'))
      : jest.fn().mockResolvedValue(options.summary ?? usageSummary()),
  } as unknown as WorkspaceAiCreditsUsageService;

  const subscriptionsService = {
    findByWorkspaceId: jest.fn().mockResolvedValue(options.subscription ?? null),
  } as unknown as WorkspaceSubscriptionsService;

  const entitlementsService = {
    resolveForWorkspace: jest.fn().mockResolvedValue(
      options.entitlements ?? {
        isTrialExpired: false,
        addonsAllowed: true,
        isTrialPlan: false,
        planKey: 'starter',
      },
    ),
  } as unknown as WorkspaceEntitlementsService;

  const creditTopUpService = {
    sumRemainingCredits: jest
      .fn()
      .mockResolvedValue(options.topUpRemainingAfterFulfill ?? options.summary?.topUpCreditsRemaining ?? 0),
  } as unknown as WorkspaceCreditTopUpService;

  const billingAiCreditsAutoTopUpService = {
    tryFulfillAtCreditGate: jest.fn().mockResolvedValue(
      options.autoTopUpFulfill ?? { ok: false, reason: 'not_enabled' },
    ),
  } as unknown as BillingAiCreditsAutoTopUpService;

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        lemonSqueezyApiKey: 'api-key',
        lemonSqueezyStoreId: 'store-1',
        customerAppBaseUrl: 'https://app.example.com',
        lemonSqueezyTopup1000CreditsVariantId: 'variant-topup',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  return {
    service: new WorkspaceAiCreditGateService(
      usageService,
      entitlementsService,
      subscriptionsService,
      configService,
      creditTopUpService,
      billingAiCreditsAutoTopUpService,
    ),
    usageService,
    subscriptionsService,
    entitlementsService,
    billingAiCreditsAutoTopUpService,
    creditTopUpService,
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

  it('allows when auto top-up creates credits after pools are exhausted', async () => {
    const { service, billingAiCreditsAutoTopUpService, creditTopUpService } = createService({
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
      autoTopUpFulfill: { ok: true, creditsAdded: 1000 },
      topUpRemainingAfterFulfill: 1000,
    });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).resolves.toBeUndefined();
    expect(billingAiCreditsAutoTopUpService.tryFulfillAtCreditGate).toHaveBeenCalled();
    expect(creditTopUpService.sumRemainingCredits).toHaveBeenCalled();
  });

  it('blocks when monthly, top-up, and auto top-up are unavailable', async () => {
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

  it('fails closed with service unavailable when usage read fails', async () => {
    const { service } = createService({ usageReadError: true });

    await expect(service.assertCanUseAiCredits(workspaceId, 1, now)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
