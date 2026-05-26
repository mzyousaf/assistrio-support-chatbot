import type { WorkspaceBillingAiCreditsUsageSummary } from '@/api/types';

export type AppShellCreditsDisplay = {
  used: number;
  total: number;
  remaining: number;
  percent: number;
  isOverLimit: boolean;
};

export function buildAppShellCreditsDisplay(
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | null | undefined,
): AppShellCreditsDisplay | null {
  if (!aiCredits) return null;

  const used = Number.isFinite(aiCredits.monthlyCreditsUsed) ? aiCredits.monthlyCreditsUsed : 0;
  const total = Number.isFinite(aiCredits.monthlyCredits) ? aiCredits.monthlyCredits : 0;
  const remaining = Number.isFinite(aiCredits.totalCreditsRemaining)
    ? aiCredits.totalCreditsRemaining
    : Math.max(0, total - used);
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return {
    used,
    total,
    remaining,
    percent,
    isOverLimit: Boolean(aiCredits.isOverLimit),
  };
}
