import type { WorkspaceBillingSummary } from '@/api/types';

export type TrialUxState =
  | 'none'
  | 'active'
  | 'ending_soon'
  | 'expired'
  | 'credits_exhausted';

const ENDING_SOON_MS = 24 * 60 * 60 * 1000;

export function resolveTrialPeriodEnd(summary: WorkspaceBillingSummary): Date | null {
  const raw = summary.subscription?.currentPeriodEnd ?? summary.plan.currentPeriodEnd;
  if (!raw?.trim()) return null;
  const end = new Date(raw);
  return Number.isNaN(end.getTime()) ? null : end;
}

export function formatTrialDaysRemaining(
  periodEnd: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!periodEnd?.trim()) return 'Ends soon';
  const end = new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return 'Ends soon';
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return 'Trial ended';
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return days === 1 ? 'Ends in 1 day' : `Ends in ${days} days`;
}

export function isTrialEndingSoon(
  summary: Pick<WorkspaceBillingSummary, 'entitlements' | 'plan' | 'subscription'>,
  now: Date = new Date(),
): boolean {
  if (!summary.entitlements.isTrialPlan || summary.entitlements.isTrialExpired) return false;
  const end = resolveTrialPeriodEnd(summary as WorkspaceBillingSummary);
  if (!end) return false;
  const diffMs = end.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= ENDING_SOON_MS;
}

export function isTrialCreditsExhausted(
  summary: Pick<WorkspaceBillingSummary, 'entitlements' | 'usage'>,
): boolean {
  if (!summary.entitlements.isTrialPlan || summary.entitlements.isTrialExpired) return false;
  const used = summary.usage?.aiCredits?.monthlyCreditsUsed ?? 0;
  const limit = summary.entitlements.monthlyAiCredits;
  return limit > 0 && used >= limit;
}

export function resolveTrialUxState(
  summary: WorkspaceBillingSummary,
  now: Date = new Date(),
): TrialUxState {
  if (!summary.entitlements.isTrialPlan) return 'none';
  if (summary.entitlements.isTrialExpired) return 'expired';
  if (isTrialCreditsExhausted(summary)) return 'credits_exhausted';
  if (isTrialEndingSoon(summary, now)) return 'ending_soon';
  return 'active';
}

export function formatTrialCreditsTotalLabel(monthlyAiCredits: number): string {
  return `${monthlyAiCredits.toLocaleString()} trial credits total`;
}
