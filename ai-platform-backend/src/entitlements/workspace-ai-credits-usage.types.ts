import type { PlanKey } from './plan-catalog';

export type WorkspaceAiCreditsUsageByBot = {
  botId: string;
  creditsUsed: number;
};

/** GET /api/customer/workspaces/:workspaceId/usage/ai-credits */
export type WorkspaceAiCreditsUsageSummary = {
  workspaceId: string;
  billingPeriod: {
    start: string;
    end: string;
  };
  planKey: PlanKey;
  planName: string;
  monthlyAiCredits: number;
  monthlyCreditsUsed: number;
  monthlyCreditsRemaining: number;
  topUpCreditsRemaining: number;
  totalCreditsAvailable: number;
  isOverLimit: boolean;
  isTrialPlan: boolean;
  isTrialExpired: boolean;
  creditsRenewMonthly: boolean;
  byBot: WorkspaceAiCreditsUsageByBot[];
};
