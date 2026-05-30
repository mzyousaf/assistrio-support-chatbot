import type { WorkspaceBillingAiCreditsUsageSummary } from '@/api/types';

export type AppShellCreditsDisplay = {
  used: number;
  monthlyTotal: number;
  topUpRemaining: number;
  totalRemaining: number;
  percent: number;
  isOverLimit: boolean;
};

export function buildAppShellCreditsDisplay(
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | null | undefined,
): AppShellCreditsDisplay | null {
  if (!aiCredits) return null;

  const used = Number.isFinite(aiCredits.monthlyCreditsUsed) ? aiCredits.monthlyCreditsUsed : 0;
  const monthlyTotal = Number.isFinite(aiCredits.monthlyCredits) ? aiCredits.monthlyCredits : 0;
  const topUpRemaining = Number.isFinite(aiCredits.topUpCreditsRemaining)
    ? aiCredits.topUpCreditsRemaining
    : 0;
  const totalRemaining = Number.isFinite(aiCredits.totalCreditsRemaining)
    ? aiCredits.totalCreditsRemaining
    : Math.max(0, monthlyTotal - used) + topUpRemaining;
  const percent =
    monthlyTotal > 0 ? Math.min(100, Math.round((used / monthlyTotal) * 100)) : 0;

  return {
    used,
    monthlyTotal,
    topUpRemaining,
    totalRemaining,
    percent,
    isOverLimit: Boolean(aiCredits.isOverLimit),
  };
}
