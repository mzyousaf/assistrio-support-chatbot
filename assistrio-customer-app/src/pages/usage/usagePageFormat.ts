import type { WorkspaceBillingSummary } from '@/api/types';

export function formatUsagePeriodDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
