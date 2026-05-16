import type {
  CustomerLeadConversationOrigin,
  CustomerLeadFieldDefinition,
  CustomerLeadListItem,
  CustomerLeadLocation,
} from '@/api/types';
import { formatCountryCodeWithNameLabel } from './leadsFilterCountryOptions';

/**
 * Lead detail drawer body sections: no horizontal inset (drawer supplies `px-4 sm:px-6`),
 * moderate vertical rhythm between section dividers.
 */
export const leadDetailSheetSectionClassName = 'px-0 py-3.5';

/** Leads list table: cap how wide the Lead column can grow on large viewports (px). */
export const LEADS_TABLE_LEAD_COL_MAX_PX = 220;

/** Dynamic “Name” (and name-like) field columns: never wider than this (px). */
export const LEADS_TABLE_NAME_FIELD_COL_MAX_PX = 200;

/** Whether a field column should use {@link LEADS_TABLE_NAME_FIELD_COL_MAX_PX}. */
export function isLeadsTableNameFieldColumn(d: CustomerLeadFieldDefinition): boolean {
  const k = d.key?.trim().toLowerCase() ?? '';
  if (k === 'name' || k === 'full_name' || k === 'fullname') return true;
  const label = d.label?.trim().toLowerCase() ?? '';
  return label === 'name' || label === 'full name';
}

/** Column defs shown in table and detail (respect `disabled`, preserve `order`). */
export function visibleLeadFieldDefinitions(defs: CustomerLeadFieldDefinition[]): CustomerLeadFieldDefinition[] {
  return [...defs].filter((d) => !d.disabled && String(d.key ?? '').trim()).sort((a, b) => a.order - b.order);
}

export function leadColumnHeaderLabel(d: CustomerLeadFieldDefinition): string {
  return d.label?.trim() || d.key;
}

/** Resolve the actual `capturedLeadData` property key (case-insensitive). */
export function resolveLeadDataKey(data: Record<string, string> | undefined, key: string): string | undefined {
  if (!data) return undefined;
  const k = key.trim();
  if (!k) return undefined;
  if (Object.prototype.hasOwnProperty.call(data, k) && data[k] != null) return k;
  return Object.keys(data).find((dk) => dk.toLowerCase() === k.toLowerCase());
}

export function formatLeadCellValue(data: Record<string, string> | undefined, key: string): string {
  if (!data) return '';
  const resolved = resolveLeadDataKey(data, key);
  if (!resolved) return '';
  const v = data[resolved];
  if (v == null) return '';
  const s = String(v).trim();
  return s;
}

export function displayLeadFieldValue(data: Record<string, string> | undefined, key: string): string {
  const s = formatLeadCellValue(data, key);
  return s || '—';
}

export function formatLeadLocationShort(loc: CustomerLeadLocation | null | undefined): string {
  if (!loc) return '—';
  const city = loc.city?.trim();
  const region = loc.region?.trim();
  const country = loc.country?.trim();
  const ccNorm = loc.countryCode?.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) ?? '';
  const parts = [city, region, country].filter(Boolean);
  if (parts.length) {
    const line = parts.join(', ');
    if (ccNorm.length === 2 && !line.includes(`(${ccNorm})`)) {
      return `${line} (${ccNorm})`;
    }
    return line;
  }
  if (ccNorm.length === 2) return formatCountryCodeWithNameLabel(ccNorm);
  return '—';
}

export function formatLeadSourcePage(origin: CustomerLeadConversationOrigin | null | undefined): string {
  if (!origin) return '—';
  const url = origin.pageUrl?.trim();
  if (url) return url;
  const web = origin.websiteOrigin?.trim();
  if (web) return web;
  const ref = origin.referrer?.trim();
  return ref || '—';
}

function primaryIdentitySublineConversationRef(conversationId: string): string {
  const t = conversationId?.trim();
  return t || '—';
}

const PRIMARY_KEY_PRIORITY = ['name', 'full_name', 'fullname', 'email', 'phone', 'mobile'] as const;

function findCapturedKey(data: Record<string, string>, canonical: string): string | undefined {
  const c = canonical.toLowerCase();
  return Object.keys(data).find((k) => k.toLowerCase() === c);
}

export type LeadPrimaryIdentity = {
  headline: string;
  subline: string;
  /** Key used for headline (excluded from duplicate dynamic column). */
  headlineKey: string | null;
};

/** Headline for list/detail: best available name-like / email / phone; fallback “Unknown lead”. */
export function leadPrimaryIdentity(
  capturedLeadData: Record<string, string> | undefined,
  conversationId: string,
): LeadPrimaryIdentity {
  const data = capturedLeadData ?? {};
  for (const canon of PRIMARY_KEY_PRIORITY) {
    const k = findCapturedKey(data, canon);
    if (!k) continue;
    const v = formatLeadCellValue(data, k);
    if (!v) continue;
    const sub = primaryIdentitySubline(data, k, conversationId);
    return { headline: v, subline: sub, headlineKey: k };
  }
  return {
    headline: 'Unknown lead',
    subline: primaryIdentitySublineConversationRef(conversationId),
    headlineKey: null,
  };
}

function primaryIdentitySubline(data: Record<string, string>, headlineKey: string, conversationId: string): string {
  const hl = headlineKey.toLowerCase();
  const parts: string[] = [];
  const emailK = findCapturedKey(data, 'email');
  if (emailK && emailK.toLowerCase() !== hl) {
    const v = formatLeadCellValue(data, emailK);
    if (v) parts.push(v);
  }
  const phoneK = findCapturedKey(data, 'phone') ?? findCapturedKey(data, 'mobile');
  if (phoneK && phoneK.toLowerCase() !== hl) {
    const v = formatLeadCellValue(data, phoneK);
    if (v) parts.push(v);
  }
  if (parts.length) return parts.join(' · ');
  return primaryIdentitySublineConversationRef(conversationId);
}

/** Dynamic columns: same as visible defs (Lead cell may repeat headline for context). */
export function leadTableDynamicDefinitions(
  defs: CustomerLeadFieldDefinition[],
  _headlineKey: string | null,
): CustomerLeadFieldDefinition[] {
  return defs;
}

export function countLoadedLeadsWithName(leads: CustomerLeadListItem[], defs: CustomerLeadFieldDefinition[]): number {
  const nameKeys = new Set<string>();
  for (const d of defs) {
    if (d.disabled) continue;
    if (!isLeadsTableNameFieldColumn(d)) continue;
    const raw = d.key?.trim();
    if (raw) nameKeys.add(raw);
  }
  if (nameKeys.size === 0) {
    nameKeys.add('name');
    nameKeys.add('full_name');
    nameKeys.add('fullname');
  }

  return leads.filter((lead) => {
    const data = lead.capturedLeadData ?? {};
    for (const k of nameKeys) {
      if (formatLeadCellValue(data, k)) return true;
    }
    return Object.keys(data).some((key) => {
      const kl = key.toLowerCase();
      if (kl !== 'name' && kl !== 'full_name' && kl !== 'fullname') return false;
      return Boolean(formatLeadCellValue(data, key));
    });
  }).length;
}

export function countLoadedLeadsWithEmail(leads: CustomerLeadListItem[], defs: CustomerLeadFieldDefinition[]): number {
  const emailKeys = new Set<string>();
  for (const d of defs) {
    if (d.disabled) continue;
    const k = d.key?.trim().toLowerCase();
    if (!k) continue;
    if (d.type?.toLowerCase() === 'email' || k === 'email') emailKeys.add(d.key);
  }
  if (emailKeys.size === 0) emailKeys.add('email');
  return leads.filter((lead) => {
    const data = lead.capturedLeadData ?? {};
    for (const k of emailKeys) {
      if (formatLeadCellValue(data, k)) return true;
    }
    return Object.keys(data).some((key) => {
      if (key.toLowerCase() !== 'email') return false;
      return Boolean(formatLeadCellValue(data, key));
    });
  }).length;
}

export function countLoadedLeadsWithPhone(leads: CustomerLeadListItem[], defs: CustomerLeadFieldDefinition[]): number {
  const phoneKeys = new Set<string>();
  for (const d of defs) {
    if (d.disabled) continue;
    const k = d.key?.trim().toLowerCase();
    if (!k) continue;
    const t = d.type?.toLowerCase();
    if (t === 'tel' || t === 'phone' || k === 'phone' || k === 'mobile') phoneKeys.add(d.key);
  }
  for (const fallback of ['phone', 'mobile', 'tel']) phoneKeys.add(fallback);

  return leads.filter((lead) => {
    const data = lead.capturedLeadData ?? {};
    for (const k of phoneKeys) {
      const kk = k.trim();
      if (!kk) continue;
      const real = Object.keys(data).find((x) => x.toLowerCase() === kk.toLowerCase());
      if (real && formatLeadCellValue(data, real)) return true;
    }
    return false;
  }).length;
}

export function latestLeadCapturedDisplayFromIso(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function latestLeadCapturedDisplay(leads: CustomerLeadListItem[]): string {
  let best: string | null = null;
  let bestMs = -1;
  for (const lead of leads) {
    const raw = lead.leadCapturedAt ?? lead.lastActivityAt;
    if (raw == null || !String(raw).trim()) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = raw;
    }
  }
  if (!best) return '—';
  return new Date(best).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isSafeMailtoLocalPart(value: string): boolean {
  return EMAIL_LIKE.test(value.trim());
}

export function isSafeHttpUrl(value: string): boolean {
  const t = value.trim();
  if (!/^https:\/\//i.test(t)) return false;
  if (/\s/.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSafeHttpOrHttpsUrl(value: string): boolean {
  const t = value.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  if (/\s/.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Digits/plus/parens/space for tel: — keep conservative */
export function sanitizeTelHref(value: string): string {
  return value.replace(/[^\d+]/g, '').slice(0, 24);
}

/**
 * Short, inbox-style URL for tables and drawers (host + truncated path segments).
 * Full URL should be shown via `title` and used for copy/href.
 */
export function formatLeadUrlInboxDisplay(raw: string | null | undefined): string {
  const t = raw?.trim() ?? '';
  if (!t) return '';
  try {
    const u = new URL(t);
    const host = u.host;
    const segments = u.pathname.split('/').filter(Boolean).slice(0, 8);
    const shortenedSegs = segments.map((seg) => (seg.length <= 18 ? seg : `${seg.slice(0, 8)}…`));
    const pathPart = shortenedSegs.length ? ` / ${shortenedSegs.join(' / ')}` : '';
    return `${host}${pathPart}`;
  } catch {
    if (t.length <= 60) return t;
    return `${t.slice(0, 28)}…${t.slice(-22)}`;
  }
}

export type LeadQualityKind = 'complete' | 'partial' | 'missing_email' | 'missing_phone';

export function leadQualityFromCaptured(
  capturedLeadData: Record<string, string> | undefined,
  defs: CustomerLeadFieldDefinition[],
): { kind: LeadQualityKind; label: string } {
  const visible = visibleLeadFieldDefinitions(defs);
  const data = capturedLeadData ?? {};

  const requiredDefs = visible.filter((d) => d.required);
  const missingRequired = requiredDefs.filter((d) => !formatLeadCellValue(data, d.key)).length;
  if (missingRequired > 0) {
    return { kind: 'partial', label: 'Partial' };
  }

  const hasEmailConfigured = visible.some((d) => {
    const k = d.key.trim().toLowerCase();
    return d.type?.toLowerCase() === 'email' || k === 'email';
  });
  const emailKeys = collectEmailKeysFromVisible(visible);
  const hasEmailVal = hasValueForAnyConfiguredKey(data, emailKeys);

  const hasPhoneConfigured = visible.some((d) => {
    if (d.disabled) return false;
    const k = d.key.trim().toLowerCase();
    const t = d.type?.toLowerCase();
    return t === 'tel' || t === 'phone' || k === 'phone' || k === 'mobile';
  });
  const phoneKeys = collectPhoneKeysFromVisible(visible);
  const hasPhoneVal = hasValueForAnyConfiguredKey(data, phoneKeys);

  if (hasEmailConfigured && !hasEmailVal) {
    return { kind: 'missing_email', label: 'Missing email' };
  }
  if (hasPhoneConfigured && !hasPhoneVal) {
    return { kind: 'missing_phone', label: 'Missing phone' };
  }

  if (visible.length >= 3) {
    const filled = visible.filter((d) => formatLeadCellValue(data, d.key)).length;
    if (filled <= 1) {
      return { kind: 'partial', label: 'Partial' };
    }
  }

  return { kind: 'complete', label: 'Complete' };
}

function collectEmailKeysFromVisible(visible: CustomerLeadFieldDefinition[]): string[] {
  const keys = new Set<string>();
  for (const d of visible) {
    const k = d.key?.trim();
    if (!k) continue;
    if (d.type?.toLowerCase() === 'email' || k.toLowerCase() === 'email') keys.add(d.key);
  }
  if (keys.size === 0) keys.add('email');
  return [...keys];
}

function collectPhoneKeysFromVisible(visible: CustomerLeadFieldDefinition[]): string[] {
  const keys = new Set<string>();
  for (const d of visible) {
    const k = d.key?.trim().toLowerCase();
    if (!k) continue;
    const t = d.type?.toLowerCase();
    if (t === 'tel' || t === 'phone' || k === 'phone' || k === 'mobile') keys.add(d.key);
  }
  for (const fb of ['phone', 'mobile']) keys.add(fb);
  return [...keys];
}

function hasValueForAnyConfiguredKey(data: Record<string, string>, keys: string[]): boolean {
  for (const k of keys) {
    const real = Object.keys(data).find((x) => x.toLowerCase() === k.trim().toLowerCase());
    if (real && formatLeadCellValue(data, real)) return true;
  }
  return false;
}

export function leadDetailFieldRowShouldOfferCopy(
  def: CustomerLeadFieldDefinition,
  rawValue: string,
): boolean {
  if (!rawValue.trim() || rawValue === '—') return false;
  const t = def.type?.toLowerCase();
  const k = def.key.trim().toLowerCase();
  if (t === 'email' || t === 'tel' || t === 'phone' || t === 'url' || t === 'website') return true;
  if (k === 'email' || k === 'phone' || k === 'mobile') return true;
  return isSafeHttpOrHttpsUrl(rawValue);
}
