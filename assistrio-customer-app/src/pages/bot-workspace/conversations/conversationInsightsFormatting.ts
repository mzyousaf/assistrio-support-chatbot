import type { CustomerConversationDetail } from '@/api/types';

/** Display placeholder for unavailable analytics cells. */
export const INSIGHT_EM_DASH = '—';

/** Internal staff tabs (Assistrio operators). */
export function conversationInsightsAdminTabEnabled(customerRole: string | undefined): boolean {
  const r = (customerRole ?? '').trim().toLowerCase();
  return r === 'superadmin' || r === 'admin';
}

export function dashUnlessText(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  return t.length ? t : INSIGHT_EM_DASH;
}

export function capitalizeWordsFromKey(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const ORIGIN_SOURCES: Record<string, string> = {
  script_embed: 'Website script',
  iframe_embed: 'Website iframe',
  shared_link: 'Shared link',
  widget_preview: 'Widget preview',
  playground_preview: 'Playground',
  shared_preview: 'Shared preview',
  unknown: 'Unknown',
};

export function formatConversationOriginSourceType(raw?: string | null): string {
  const t = raw?.trim();
  if (!t) return INSIGHT_EM_DASH;
  return ORIGIN_SOURCES[t] ?? capitalizeWordsFromKey(t.replace(/_/g, ' '));
}

export function conversationChannelLabel(detail: CustomerConversationDetail, startedFromFallback?: string | null): string {
  const sf = detail.startedFrom?.trim() || startedFromFallback?.trim();
  if (sf === 'playground_preview') return 'Playground';
  if (sf === 'shared_preview') return 'Shared preview';
  if (sf === 'runtime_widget') return 'Website embed';
  if (sf === 'runtime_iframe') return 'Website embed (iframe)';
  const ss = detail.sessionSource?.trim();
  if (ss === 'widget_preview') return 'Playground';
  if (ss === 'shared_preview') return 'Shared preview';
  if (ss === 'shared_link') return 'Shared link';
  if (ss === 'runtime') return 'Website embed';
  if (ss === 'iframe_embed') return 'Website embed (iframe)';
  if (sf === 'unknown' || sf) return ORIGIN_SOURCES[sf] ?? capitalizeWordsFromKey(String(sf).replace(/_/g, ' '));
  return INSIGHT_EM_DASH;
}

export function conversationStatusPresentation(status: string | undefined): { customerLabel: string; rawKey: string } {
  const s = (status ?? '').trim().toLowerCase() || 'active';
  if (s === 'active') return { customerLabel: 'Ongoing', rawKey: 'active' };
  if (s === 'closed') return { customerLabel: 'Closed', rawKey: 'closed' };
  if (s === 'abandoned') return { customerLabel: 'Abandoned', rawKey: 'abandoned' };
  return {
    customerLabel: capitalizeWordsFromKey(s.replace(/_/g, ' ')),
    rawKey: s,
  };
}

export function sentimentCustomerLabel(detail: CustomerConversationDetail): string {
  const l = detail.conversationSentiment?.label;
  const k = typeof l === 'string' ? l.trim().toLowerCase() : '';
  if (!k || k === 'unknown') return 'Not analyzed';
  if (k === 'positive') return 'Positive';
  if (k === 'neutral') return 'Neutral';
  if (k === 'negative') return 'Negative';
  if (k === 'mixed') return 'Mixed';
  return capitalizeWordsFromKey(k);
}

/** Host + pathname, no query or hash (helps avoid leaking share tokens). */
export function sanitizedHostPath(raw?: string | null): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  if (!/^https?:\/\//i.test(t)) return undefined;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname}${path}`;
  } catch {
    return undefined;
  }
}

export function sanitizedHostname(raw?: string | null): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.hostname || undefined;
  } catch {
    return undefined;
  }
}

/** Normalize `websiteOrigin` values that omit the scheme. */
export function websiteOriginHostPath(raw?: string | null): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const prefixed = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return sanitizedHostPath(prefixed);
}

/** Page URL → domain-only row; prefers hostname from full URL vs websiteOrigin. */
export function pageDomainDisplay(detail: CustomerConversationDetail): string {
  const o = detail.conversationOrigin;
  const attempt = sanitizedHostname(o?.pageUrl) ?? sanitizedHostname(o?.websiteOrigin);
  return dashUnlessText(attempt);
}

export function pagePathDisplay(detail: CustomerConversationDetail): string {
  const p = detail.conversationOrigin?.pageUrl;
  const t = p?.trim();
  if (!t) return INSIGHT_EM_DASH;
  if (!/^https?:\/\//i.test(t)) return INSIGHT_EM_DASH;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return INSIGHT_EM_DASH;
    const path = u.pathname || '/';
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return INSIGHT_EM_DASH;
  }
}

export function sharePageSanitizedDisplay(detail: CustomerConversationDetail): string {
  const o = detail.conversationOrigin;
  return dashUnlessText(sanitizedHostPath(o?.sharedUrl ?? o?.iframeUrl));
}

/** Combined host + path for visitor-facing “Page” row (queries stripped). */
export function visitorPageLineDisplay(detail: CustomerConversationDetail): string {
  const merged = sanitizedHostPath(detail.conversationOrigin?.pageUrl?.trim());
  if (merged) return merged;
  return pagePathDisplay(detail);
}

export function deviceTypeCustomerLabel(raw?: string | null): string {
  const t = raw?.trim().toLowerCase();
  if (!t) return INSIGHT_EM_DASH;
  if (t === 'desktop') return 'Desktop';
  if (t === 'mobile') return 'Mobile';
  if (t === 'tablet') return 'Tablet';
  if (t === 'bot') return 'Bot';
  if (t === 'unknown') return 'Unknown';
  return capitalizeWordsFromKey(t.replace(/_/g, ' '));
}

export function formatBrowserOsLine(
  browser?: string,
  browserVersion?: string,
  os?: string,
  osVersion?: string,
): { browserLine: string; osLine: string } {
  const b0 = dashUnlessText(browser);
  let browserLine =
    b0 === INSIGHT_EM_DASH
      ? INSIGHT_EM_DASH
      : dashUnlessText(browserVersion) === INSIGHT_EM_DASH
        ? b0
        : `${b0} ${browserVersion}`;
  const o0 = dashUnlessText(os);
  let osLine =
    o0 === INSIGHT_EM_DASH
      ? INSIGHT_EM_DASH
      : dashUnlessText(osVersion) === INSIGHT_EM_DASH
        ? o0
        : `${o0} ${osVersion}`;
  return { browserLine, osLine };
}

export function screenSizeDisplay(w?: number, h?: number): string {
  const ok =
    typeof w === 'number' &&
    typeof h === 'number' &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0;
  if (!ok) return INSIGHT_EM_DASH;
  return `${Math.round(w)} × ${Math.round(h)}`;
}

const LEAD_CORE_KEYS = ['name', 'email', 'phone', 'company'] as const;

export type LeadPresentationRow = { label: string; value: string };

export function sortedLeadPresentation(data: Record<string, string>): LeadPresentationRow[] {
  const keys = Object.keys(data);
  const prioritized: LeadPresentationRow[] = [];
  for (const key of LEAD_CORE_KEYS) {
    const v = data[key];
    if (v?.trim()) {
      prioritized.push({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: v.trim(),
      });
    }
  }
  const rest = keys
    .filter((k) => !LEAD_CORE_KEYS.includes(k as (typeof LEAD_CORE_KEYS)[number]))
    .sort((a, b) => a.localeCompare(b))
    .map((k) => ({
      label: capitalizeWordsFromKey(k),
      value: (data[k] ?? '').trim(),
    }))
    .filter((row) => row.value.length > 0);
  return [...prioritized, ...rest];
}
