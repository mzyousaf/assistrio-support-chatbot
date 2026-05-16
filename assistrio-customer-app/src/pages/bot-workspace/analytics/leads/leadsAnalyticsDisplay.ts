import type { CustomerChatsAnalyticsStartedFromKey, CustomerLeadsStartedFromBreakdownItem } from '@/api/types';

/** Stable source order for charts (matches product surfaces). */
export const LEADS_SOURCE_KEYS_ORDER: readonly CustomerChatsAnalyticsStartedFromKey[] = [
  'runtime_widget',
  'runtime_iframe',
  'shared_preview',
  'playground_preview',
  'unknown',
] as const;

export function displayLabelForLeadsSourceKey(key: CustomerChatsAnalyticsStartedFromKey): string {
  switch (key) {
    case 'runtime_widget':
      return 'Runtime Widget';
    case 'runtime_iframe':
      return 'Runtime IFrame';
    case 'shared_preview':
      return 'Shared Preview';
    case 'playground_preview':
      return 'Playground Preview';
    case 'unknown':
      return 'Unknown';
  }
}

export type NormalizedLeadSourceRow = {
  key: CustomerChatsAnalyticsStartedFromKey;
  label: string;
  conversations: number;
  leads: number;
  conversionRate: number | null;
};

export function normalizeLeadsStartedFromBreakdown(
  rows: CustomerLeadsStartedFromBreakdownItem[],
): NormalizedLeadSourceRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r] as const));
  return LEADS_SOURCE_KEYS_ORDER.map((key) => {
    const r = byKey.get(key);
    return {
      key,
      label: displayLabelForLeadsSourceKey(key),
      conversations: Math.max(0, Math.trunc(r?.conversations ?? 0)),
      leads: Math.max(0, Math.trunc(r?.leads ?? 0)),
      conversionRate: r?.conversionRate ?? null,
    };
  });
}

/** Highest leads count wins; ties broken by label sort. Returns display label or em dash when none. */
export function topLeadSourceLabel(rows: CustomerLeadsStartedFromBreakdownItem[]): string {
  const normalized = normalizeLeadsStartedFromBreakdown(rows);
  let best: NormalizedLeadSourceRow | null = null;
  for (const row of normalized) {
    if (row.leads <= 0) continue;
    if (!best || row.leads > best.leads) best = row;
    else if (best && row.leads === best.leads && row.label.localeCompare(best.label) < 0) best = row;
  }
  return best?.label ?? '—';
}
