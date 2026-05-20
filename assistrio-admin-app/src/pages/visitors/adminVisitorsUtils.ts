import type { AdminVisitorEventRow, AdminVisitorEventType, AdminVisitorListItem } from '@/api/adminVisitorsTypes';
import { computeDateRangeFromAnalyticsPreset, type AnalyticsDateRangeSlice } from '@/lib/chatsAnalyticsQuery';

export function shortVisitorId(id: string): string {
  const t = id.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

export function parseVisitorIso(iso: string | Date | undefined | null): Date | null {
  if (iso == null) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function visitorHasContact(row: AdminVisitorListItem): boolean {
  return Boolean(row.name?.trim() || row.email?.trim() || row.phone?.trim());
}

export function visitorIsReturning(row: AdminVisitorListItem): boolean {
  const created = parseVisitorIso(row.createdAt);
  const last = parseVisitorIso(row.lastSeenAt);
  if (!created || !last) return false;
  return last.getTime() - created.getTime() > 60 * 60 * 1000;
}

export const VISITOR_EVENT_LABELS: Record<string, string> = {
  page_view: 'Page view',
  demo_chat_started: 'Demo chat started',
  cta_clicked: 'CTA clicked',
  demo_opened: 'Demo opened',
  snippet_copied: 'Snippet copied',
  stable_id_copied: 'Stable ID copied',
  reconnect_submitted: 'Reconnect submitted',
  reconnect_succeeded: 'Reconnect succeeded',
  website_register_started: 'Register started',
  website_register_succeeded: 'Register succeeded',
  widget_runtime_opened: 'Widget opened',
  quota_viewed: 'Quota viewed',
  assistant_message_feedback: 'Message feedback',
  widget_speech_completed: 'Speech completed',
};

export function visitorEventLabel(type: AdminVisitorEventType): string {
  const key = String(type ?? '').trim();
  return VISITOR_EVENT_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function filterVisitorsBySearch(rows: AdminVisitorListItem[], q: string): AdminVisitorListItem[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((v) => {
    const hay = [v.visitorId, v.name, v.email, v.phone, v.visitorType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function filterVisitorsByDateRange(
  rows: AdminVisitorListItem[],
  range: AnalyticsDateRangeSlice,
): AdminVisitorListItem[] {
  const { from, to } = computeDateRangeFromAnalyticsPreset(range, { invalidCustomFallbackLastDays: 30 });
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return rows;
  return rows.filter((v) => {
    const touch = parseVisitorIso(v.lastSeenAt) ?? parseVisitorIso(v.createdAt);
    if (!touch) return true;
    const ms = touch.getTime();
    return ms >= fromMs && ms <= toMs;
  });
}

export function filterVisitorEvents(
  events: AdminVisitorEventRow[],
  eventType: string,
): AdminVisitorEventRow[] {
  const t = eventType.trim();
  if (!t || t === 'all') return events;
  return events.filter((e) => String(e.type) === t);
}

export type VisitorsListSummary = {
  total: number;
  withContact: number;
  returning: number;
  recentInRange: number;
};

export function computeVisitorsListSummary(rows: AdminVisitorListItem[]): VisitorsListSummary {
  return {
    total: rows.length,
    withContact: rows.filter(visitorHasContact).length,
    returning: rows.filter(visitorIsReturning).length,
    recentInRange: rows.length,
  };
}

export function visitorTypeLabel(type: string | undefined): string {
  const t = (type ?? 'marketing').toLowerCase();
  if (t === 'platform') return 'Platform (legacy)';
  if (t === 'marketing') return 'Marketing';
  if (t === 'chat') return 'Chat';
  if (t === 'owner_preview') return 'Owner preview';
  return type ?? '—';
}
