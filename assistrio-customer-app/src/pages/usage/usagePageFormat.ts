import type { WorkspaceBillingSummary, WorkspaceBillingTopUpRow } from '@/api/types';

export function formatUsagePeriodDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function usagePlanStatusTagClassName(
  summary: Pick<WorkspaceBillingSummary, 'plan' | 'subscription' | 'entitlements'>,
): string {
  const status = String(summary.subscription?.subscriptionStatus ?? summary.plan.status ?? '')
    .trim()
    .toLowerCase();

  if (
    summary.subscription?.cancelAtPeriodEnd &&
    summary.subscription.hasActivePaidSubscription
  ) {
    return 'border-amber-200/80 bg-amber-50/90 text-amber-900 ring-1 ring-amber-100/80';
  }

  if (
    status === 'past_due' ||
    status === 'unpaid' ||
    summary.subscription?.hasPaymentIssue
  ) {
    return 'border-red-200/80 bg-red-50/90 text-red-800 ring-1 ring-red-100/80';
  }

  if (status === 'canceled' || status === 'cancelled') {
    return 'border-slate-200/90 bg-slate-100 text-slate-600 ring-1 ring-slate-200/80';
  }

  if (status === 'active' || status === 'free' || status === 'trialing') {
    return 'border-teal-200/80 bg-teal-50/90 text-teal-800 ring-1 ring-teal-100/80';
  }

  return 'border-slate-200/90 bg-white text-slate-800 ring-1 ring-slate-200/80';
}

export function formatSubscriptionStatusLabel(status: string | null | undefined): string {
  const raw = String(status ?? '').trim();
  if (!raw) return 'Unknown';
  if (raw.toLowerCase() === 'free') return 'Free trial';
  if (raw.toLowerCase() === 'trialing') return 'Free trial';
  if (raw.toLowerCase() === 'active') return 'Active';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatAiCreditsPercent(used: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(used) || used <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export type MonthlyAiCreditsCardDisplay = {
  monthlyRemaining: number;
  monthlyUsed: number;
  includedMonthlyCredits: number;
  monthlyUsagePercent: number;
  valueLabel: string;
  usageLine: string;
  resetFooter: string;
};

export type TopUpCreditsCardDisplay = {
  topUpRemaining: number;
  valueLabel: string;
  subtitleLine: string;
  reserveTooltip: string;
  ringPercent: number;
  expiryFooter: string | null;
  showCard: boolean;
};

export function formatTopUpCreditsRingPercent(
  topUpRemaining: number,
  topUps: WorkspaceBillingTopUpRow[] | undefined,
): number {
  const { used, totalPurchased } = computeTopUpCreditsUsage(topUpRemaining, topUps);
  return formatAiCreditsPercent(used, totalPurchased);
}

export function computeTopUpCreditsUsage(
  topUpRemaining: number,
  topUps: WorkspaceBillingTopUpRow[] | undefined,
): { used: number; totalPurchased: number } {
  const purchasedRows = (topUps ?? []).filter((row) => (row.creditsPurchased ?? 0) > 0);
  const totalPurchased = purchasedRows.reduce((sum, row) => sum + (row.creditsPurchased ?? 0), 0);
  const remaining = Math.max(0, topUpRemaining);

  if (totalPurchased <= 0) {
    if (remaining <= 0) return { used: 0, totalPurchased: 0 };
    return { used: 0, totalPurchased: remaining };
  }

  const used = Math.max(0, totalPurchased - remaining);
  return { used, totalPurchased };
}

export function computeTotalCreditsAvailable(
  monthlyRemaining: number,
  topUpRemaining: number,
): number {
  return monthlyRemaining + topUpRemaining;
}

export function buildMonthlyAiCreditsCardDisplay(
  aiCredits:
    | {
        monthlyCredits?: number;
        monthlyCreditsUsed?: number;
        monthlyCreditsRemaining?: number;
        periodEnd?: string | null;
      }
    | null
    | undefined,
  options?: { isTrialPlan?: boolean },
): MonthlyAiCreditsCardDisplay {
  const includedMonthlyCredits = aiCredits?.monthlyCredits ?? 0;
  const monthlyUsed = aiCredits?.monthlyCreditsUsed ?? 0;
  const monthlyRemaining =
    aiCredits?.monthlyCreditsRemaining ?? Math.max(0, includedMonthlyCredits - monthlyUsed);
  const monthlyUsagePercent = formatAiCreditsPercent(monthlyUsed, includedMonthlyCredits);
  const resetDate = formatUsagePeriodDate(aiCredits?.periodEnd);
  const isTrialPlan = options?.isTrialPlan === true;

  return {
    monthlyRemaining,
    monthlyUsed,
    includedMonthlyCredits,
    monthlyUsagePercent,
    valueLabel: `${monthlyUsed.toLocaleString()} / ${includedMonthlyCredits.toLocaleString()}`,
    usageLine: isTrialPlan ? 'Trial credits used' : 'Credits used this period',
    resetFooter: isTrialPlan
      ? 'Trial credits do not renew'
      : resetDate !== '—'
        ? `Resets ${resetDate}`
        : 'Resets at next billing period',
  };
}

export function buildTopUpCreditsFooter(
  topUps: WorkspaceBillingTopUpRow[] | undefined,
): string | null {
  const active = (topUps ?? []).filter((row) => row.creditsRemaining > 0);
  if (active.length === 0) return null;

  const expiries = active
    .map((row) => row.expiresAt)
    .filter((iso): iso is string => Boolean(iso?.trim()))
    .sort();

  if (expiries.length > 0) {
    const nearest = expiries[0];
    if (active.length > 1) {
      return `Expires ${formatUsagePeriodDate(nearest)} · Multiple top-ups`;
    }
    return `Expires ${formatUsagePeriodDate(nearest)}`;
  }

  return active.length > 1 ? 'Multiple top-ups available' : null;
}

export function hasTopUpPurchaseRecords(topUps: WorkspaceBillingTopUpRow[] | undefined): boolean {
  return (topUps ?? []).some((row) => (row.creditsPurchased ?? 0) > 0);
}

export function hasPurchasedTopUpCredits(
  topUpCreditsRemaining: number | null | undefined,
  topUps: WorkspaceBillingTopUpRow[] | undefined,
): boolean {
  if ((topUpCreditsRemaining ?? 0) <= 0) return false;
  return hasTopUpPurchaseRecords(topUps);
}

export function buildTopUpCreditsCardDisplay(
  topUpCreditsRemaining: number | null | undefined,
  topUps?: WorkspaceBillingTopUpRow[],
): TopUpCreditsCardDisplay {
  const topUpRemaining = topUpCreditsRemaining ?? 0;
  const showCard = hasPurchasedTopUpCredits(topUpRemaining, topUps);
  const { used, totalPurchased } = computeTopUpCreditsUsage(topUpRemaining, topUps);

  return {
    topUpRemaining,
    showCard,
    valueLabel: `${used.toLocaleString()} / ${totalPurchased.toLocaleString()}`,
    subtitleLine: 'Purchased credit balance',
    reserveTooltip: 'Used after monthly credits run out',
    ringPercent: formatTopUpCreditsRingPercent(topUpRemaining, topUps),
    expiryFooter: buildTopUpCreditsFooter(topUps),
  };
}

/** @deprecated Use buildMonthlyAiCreditsCardDisplay and buildTopUpCreditsCardDisplay. */
export type AiCreditsCardDisplay = {
  totalAvailable: number;
  monthlyRemaining: number;
  topUpRemaining: number;
  monthlyUsed: number;
  includedMonthlyCredits: number;
  monthlyUsagePercent: number;
  valueLabel: string;
  breakdownLines: string[];
  periodFooter: string;
};

/** @deprecated Use buildMonthlyAiCreditsCardDisplay and buildTopUpCreditsCardDisplay. */
export function buildAiCreditsCardDisplay(
  aiCredits:
    | {
        monthlyCredits?: number;
        monthlyCreditsUsed?: number;
        monthlyCreditsRemaining?: number;
        topUpCreditsRemaining?: number;
        periodEnd?: string | null;
      }
    | null
    | undefined,
): AiCreditsCardDisplay {
  const monthly = buildMonthlyAiCreditsCardDisplay(aiCredits);
  const topUpRemaining = aiCredits?.topUpCreditsRemaining ?? 0;
  const totalAvailable = computeTotalCreditsAvailable(monthly.monthlyRemaining, topUpRemaining);

  const breakdownLines: string[] = [];
  if (monthly.monthlyRemaining > 0) {
    breakdownLines.push(`${monthly.monthlyRemaining.toLocaleString()} monthly credits remaining`);
  } else if (monthly.includedMonthlyCredits > 0) {
    breakdownLines.push('Monthly credits used up');
  }
  if (topUpRemaining > 0) {
    if (monthly.monthlyRemaining <= 0 && monthly.includedMonthlyCredits > 0) {
      breakdownLines.push('Using top-up credits now');
    } else {
      breakdownLines.push(`${topUpRemaining.toLocaleString()} top-up credits available`);
    }
  }

  return {
    totalAvailable,
    monthlyRemaining: monthly.monthlyRemaining,
    topUpRemaining,
    monthlyUsed: monthly.monthlyUsed,
    includedMonthlyCredits: monthly.includedMonthlyCredits,
    monthlyUsagePercent: monthly.monthlyUsagePercent,
    valueLabel: `${totalAvailable.toLocaleString()} available`,
    breakdownLines,
    periodFooter: `${monthly.monthlyUsed.toLocaleString()} used this period · ${monthly.resetFooter}`,
  };
}

export function buildBotNameLookup(summary: WorkspaceBillingSummary | null): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of summary?.usage?.trainedKnowledge?.perBot ?? []) {
    if (row.botId && row.botName) map.set(row.botId, row.botName);
  }
  return map;
}

export function hasAiCreditUsage(summary: WorkspaceBillingSummary | null): boolean {
  const rows = summary?.usage?.aiCredits?.byBot ?? [];
  if (rows.length === 0) return false;
  return rows.some((row) => (row.creditsUsed ?? 0) > 0);
}

export function formatMbLabel(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return '0 MB';
  const rounded = Math.round(Number(value) * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `${text} MB`;
}

export function formatPlanChipLabel(planName: string | null | undefined): string {
  const name = String(planName ?? '').trim() || 'Current';
  return name.toLowerCase().endsWith('plan') ? name : `${name} plan`;
}

export function formatCreditsSharePercent(creditsUsed: number, totalUsed: number): number {
  if (!Number.isFinite(totalUsed) || totalUsed <= 0) return 0;
  if (!Number.isFinite(creditsUsed) || creditsUsed <= 0) return 0;
  return Math.min(100, Math.round((creditsUsed / totalUsed) * 100));
}

export function formatLimitPercent(used: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  if (!Number.isFinite(used) || used <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function botAgentInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (trimmed.length >= 2) return trimmed.slice(0, 2).toUpperCase();
  return trimmed.slice(0, 1).toUpperCase();
}

export type AiCreditsTrendPoint = {
  label: string;
  credits: number;
};

/** Honest billing-period trend: zero at period start, current usage at today (or period end if later). */
export function buildAiCreditsTrendPoints(
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  monthlyCreditsUsed: number,
): AiCreditsTrendPoint[] {
  const used = Math.max(0, monthlyCreditsUsed);
  const startDate = periodStart ? new Date(periodStart) : null;
  const endDate = periodEnd ? new Date(periodEnd) : null;
  const now = new Date();

  const startLabel = formatUsagePeriodDate(periodStart);
  let currentDate = now;
  if (startDate && !Number.isNaN(startDate.getTime()) && currentDate < startDate) {
    currentDate = startDate;
  }
  if (endDate && !Number.isNaN(endDate.getTime()) && currentDate > endDate) {
    currentDate = endDate;
  }

  const currentLabel = currentDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  if (startLabel === currentLabel && used === 0) {
    return [{ label: startLabel, credits: 0 }];
  }

  if (startLabel === currentLabel) {
    return [
      { label: startLabel, credits: 0 },
      { label: 'Current', credits: used },
    ];
  }

  return [
    { label: startLabel, credits: 0 },
    { label: currentLabel, credits: used },
  ];
}
