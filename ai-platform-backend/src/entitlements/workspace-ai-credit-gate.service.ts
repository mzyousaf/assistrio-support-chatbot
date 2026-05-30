import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { WorkspaceAiCreditsUsageService } from './workspace-ai-credits-usage.service';

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
 * MVP uses a non-atomic check-before-call pattern: usage is read here, ledger rows are
 * appended after the OpenAI completion path. Concurrent requests may briefly exceed the
 * monthly cap; future work should add atomic reservation/debit in the usage ledger.
 */
@Injectable()
export class WorkspaceAiCreditGateService {
  constructor(private readonly usageService: WorkspaceAiCreditsUsageService) {}

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
    const topUpRemaining = usageSummary.topUpCreditsRemaining;
    const totalRemaining = monthlyRemaining + topUpRemaining;

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
      const payload: PlanLimitAiCreditsPayload = {
        message: usageSummary.isTrialPlan
          ? PLAN_LIMIT_AI_CREDITS_TRIAL_MESSAGE
          : PLAN_LIMIT_AI_CREDITS_MESSAGE,
        errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
        usage: usagePayload,
      };
      throw new HttpException(payload, HttpStatus.FORBIDDEN);
    }
  }
}
