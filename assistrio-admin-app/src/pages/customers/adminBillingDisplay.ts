export function formatSubscriptionStatusLabel(status: string | null | undefined): string {
  const normalized = String(status ?? 'free').trim().toLowerCase();
  if (normalized === 'free') return 'Free';
  if (normalized === 'active') return 'Active';
  if (normalized === 'trialing') return 'Trialing';
  if (normalized === 'past_due') return 'Past due';
  if (normalized === 'canceled') return 'Canceled';
  if (normalized === 'unpaid') return 'Unpaid';
  return normalized.replace(/_/g, ' ');
}

export function formatUsagePeriodDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatAnalyticsHistoryLabel(days: number | null | undefined): string {
  if (days == null) return 'Unlimited history';
  return `${days} days`;
}

export function formatExportReportsLabel(enabled: boolean | null | undefined): string {
  return enabled ? 'Included' : 'Not included';
}

export function formatBrandingRemovalLabel(canRemove: boolean | null | undefined): string {
  return canRemove ? 'Can hide Assistrio branding' : 'Assistrio branding required';
}

export function formatEntitlementBoolean(enabled: boolean | null | undefined, enabledLabel: string, disabledLabel: string): string {
  return enabled ? enabledLabel : disabledLabel;
}

export function formatPlanBadgeLabel(planName: string | null | undefined, planKey: string | null | undefined): string {
  const name = String(planName ?? '').trim();
  if (name) return name;
  const key = String(planKey ?? '').trim();
  if (!key || key === 'free') return 'Free';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function formatAiCreditsUsageLabel(used: number | null | undefined, included: number | null | undefined): string {
  const usedValue = Number(used ?? 0);
  const includedValue = Number(included ?? 0);
  if (!Number.isFinite(includedValue) || includedValue <= 0) {
    return usedValue.toLocaleString();
  }
  return `${usedValue.toLocaleString()} / ${includedValue.toLocaleString()}`;
}
