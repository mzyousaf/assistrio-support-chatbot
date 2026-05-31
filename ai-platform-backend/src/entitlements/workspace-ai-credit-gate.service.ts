import { HttpException, HttpStatus, Injectable, ServiceUnavailableException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isTopUpCheckoutAvailable, readMergedBillingAppConfig } from '../billing/billing-config.util';
import { resolveCanAutoTopUpPrompt } from '../billing/billing-ai-credits-auto-topup-prompt.util';
import { BillingAiCreditsAutoTopUpService } from '../billing/billing-ai-credits-auto-topup.service';
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';
import { WorkspaceSubscriptionsService } from './workspace-subscriptions.service';
import { WorkspaceCreditTopUpService } from './workspace-credit-topup.service';

export const PLAN_LIMIT_AI_CREDITS_CODE = 'plan_limit_ai_credits' as const;
export const FREE_TRIAL_EXPIRED_CODE = 'free_trial_expired' as const;

export const PLAN_LIMIT_AI_CREDITS_MESSAGE =
  'Your workspace has used all AI credits for this billing period.';

export const PLAN_LIMIT_AI_CREDITS_TRIAL_MESSAGE =
  'Your workspace has used all trial AI credits. Please upgrade to continue using AI chat.';

export const FREE_TRIAL_EXPIRED_MESSAGE =
  'Your free trial has ended. Please upgrade to continue using AI chat.';

export type PlanLimitAiCreditsUsage = {
  current: number;
  attempted: number;
  limit: number;
  remaining: number;
  planKey: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
};

export type PlanLimitAiCreditsPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_AI_CREDITS_CODE;
  usage: PlanLimitAiCreditsUsage;
  canAutoTopUpPrompt: boolean;
  topUpCheckoutAvailable: boolean;
};

export type FreeTrialExpiredPayload = {
  message: string;
  errorCode: typeof FREE_TRIAL_EXPIRED_CODE;
  usage: PlanLimitAiCreditsUsage;
};

export function isPlanLimitAiCreditsPayload(x: unknown): x is PlanLimitAiCreditsPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as PlanLimitAiCreditsPayload).errorCode === PLAN_LIMIT_AI_CREDITS_CODE
  );
}

export function isFreeTrialExpiredPayload(x: unknown): x is FreeTrialExpiredPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    (x as FreeTrialExpiredPayload).errorCode === FREE_TRIAL_EXPIRED_CODE
  );
}

export function isPlanLimitAiCreditsHttpException(err: unknown): err is HttpException {
  if (!(err instanceof HttpException)) return false;
  return isPlanLimitAiCreditsPayload(err.getResponse());
}

/**
 * Pre-flight AI credit enforcement for billable chat turns.
 *
 * Credit order: monthly allowance → existing top-up pool → automatic top-up pack (if enabled).
 */
@Injectable()
export class WorkspaceAiCreditGateService {
  constructor(
    private readonly usageService: WorkspaceAiCreditsUsageService,
    private readonly entitlementsService: WorkspaceEntitlementsService,
    private readonly subscriptionsService: WorkspaceSubscriptionsService,
    private readonly configService: ConfigService,
    private readonly creditTopUpService: WorkspaceCreditTopUpService,
    @Inject(forwardRef(() => BillingAiCreditsAutoTopUpService))
    private readonly billingAiCreditsAutoTopUpService: BillingAiCreditsAutoTopUpService,
  ) {}

  async assertCanUseAiCredits(
    workspaceId: string,
    estimatedCredits: number,
    now: Date = new Date(),
  ): Promise<void> {
    if (typeof estimatedCredits !== 'number' || !Number.isFinite(estimatedCredits) || estimatedCredits <= 0) {
      return;
    }

    const wsId = String(workspaceId ?? '').trim();
    if (!wsId) return;

    let usageSummary;
    try {
      usageSummary = await this.usageService.getWorkspaceAiCreditsUsage(wsId, now);
    } catch {
      throw new ServiceUnavailableException({
        message: 'Unable to verify AI credit usage. Please try again shortly.',
        errorCode: 'ai_credits_usage_unavailable',
      });
    }

    const current = usageSummary.monthlyCreditsUsed;
    const limit = usageSummary.monthlyAiCredits;
    const monthlyRemaining = usageSummary.monthlyCreditsRemaining;
    let topUpRemaining = usageSummary.topUpCreditsRemaining;
    let totalRemaining = monthlyRemaining + topUpRemaining;

    const usagePayload: PlanLimitAiCreditsUsage = {
      current,
      attempted: estimatedCredits,
      limit,
      remaining: totalRemaining,
      planKey: usageSummary.planKey,
      planName: usageSummary.planName,
      periodStart: usageSummary.billingPeriod.start,
      periodEnd: usageSummary.billingPeriod.end,
    };

    if (usageSummary.isTrialExpired) {
      throw new HttpException(
        {
          message: FREE_TRIAL_EXPIRED_MESSAGE,
          errorCode: FREE_TRIAL_EXPIRED_CODE,
          usage: usagePayload,
        } satisfies FreeTrialExpiredPayload,
        HttpStatus.FORBIDDEN,
      );
    }

    if (current + estimatedCredits > limit) {
      const spill = current + estimatedCredits - limit;
      if (spill <= topUpRemaining) {
        return;
      }

      const fulfill = await this.billingAiCreditsAutoTopUpService.tryFulfillAtCreditGate(
        wsId,
        estimatedCredits,
        now,
      );
      if (fulfill.ok) {
        topUpRemaining = await this.creditTopUpService.sumRemainingCredits(wsId, now);
        totalRemaining = monthlyRemaining + topUpRemaining;
        if (spill <= topUpRemaining) {
          return;
        }
      }

      const [subscription, entitlements] = await Promise.all([
        this.subscriptionsService.findByWorkspaceId(wsId),
        this.entitlementsService.resolveForWorkspace(wsId, now),
      ]);
      const appConfig = readMergedBillingAppConfig(this.configService);
      const topUpCheckoutAvailable = isTopUpCheckoutAvailable(appConfig, 'ai_credits_1000');
      const canAutoTopUpPrompt = resolveCanAutoTopUpPrompt({
        subscription,
        entitlements,
        totalCreditsRemaining: totalRemaining,
      });

      const payload: PlanLimitAiCreditsPayload = {
        message: usageSummary.isTrialPlan
          ? PLAN_LIMIT_AI_CREDITS_TRIAL_MESSAGE
          : PLAN_LIMIT_AI_CREDITS_MESSAGE,
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        usage: {
          ...usagePayload,
          remaining: totalRemaining,
        },
        canAutoTopUpPrompt: canAutoTopUpPrompt && topUpCheckoutAvailable,
        topUpCheckoutAvailable,
      };
      throw new HttpException(payload, HttpStatus.FORBIDDEN);
    }
  }
}
