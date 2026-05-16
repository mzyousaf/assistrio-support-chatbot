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

/** Leads list table: primary “Lead” column (identity headline + subline) max width (px). */
export const LEADS_TABLE_LEAD_IDENTITY_COL_MAX_PX = 220;

/** Dynamic “Name” (and name-like) field columns: never wider than this (px). */
export const LEADS_TABLE_NAME_FIELD_COL_MAX_PX = 200;

/** Whether a field column should use {@link LEADS_TABLE_NAME_FIELD_COL_MAX_PX}. */
export function isLeadsTableNameFieldColumn(d: CustomerLeadFieldDefinition): boolean {
  const k = d.key?.trim().toLowerCase() ?? '';
  if (k === 'name' || k === 'full_name' || k === 'fullname') return true;
  const label = d.label?.trim().toLowerCase() ?? '';
  return label === 'name' || label === 'full name';
}

export type LeadFieldStatusUi = 'active' | 'inactive' | 'deleted';

/** Resolve lifecycle status from API fields (fieldStatus preferred; fallback via archived/source). */
export function inferLeadFieldStatus(d: CustomerLeadFieldDefinition): LeadFieldStatusUi {
  if (d.fieldStatus) return d.fieldStatus;
  if (!d.archived) return 'active';
  return d.source === 'current' ? 'inactive' : 'deleted';
}

/** Bot-active fields only (capture-quality / completeness heuristics). */
export function activeLeadFieldDefinitions(defs: CustomerLeadFieldDefinition[]): CustomerLeadFieldDefinition[] {
  return [...defs]
    .filter((d) => inferLeadFieldStatus(d) === 'active' && String(d.key ?? '').trim())
    .sort((a, b) => a.order - b.order);
}

/** Column defs for inbox table and CSV: configured fields first, then inactive/deleted keys with values. */
export function visibleLeadFieldDefinitions(defs: CustomerLeadFieldDefinition[]): CustomerLeadFieldDefinition[] {
  return [...defs].filter((d) => String(d.key ?? '').trim()).sort((a, b) => a.order - b.order);
}

/** Plain label for drawer rows and table headers (badges carry inactive/deleted). */
export function leadDetailFieldLabel(d: CustomerLeadFieldDefinition): string {
  return (d.label?.trim() || d.key?.trim() || '').trim() || d.key;
}

/** Fixed inbox columns (Insights → Leads table): Lead identity, Captured At, Status, Name, then Email / Phone / Company; Captured Fields tags list all captured keys. */
export type LeadsInboxTableColumn = {
  headerLabel: string;
  field: CustomerLeadFieldDefinition;
};

function leadsInboxSyntheticField(key: string, label: string, type: string): CustomerLeadFieldDefinition {
  return {
    key,
    label,
    type,
    required: false,
    order: 0,
    fieldStatus: 'active',
  };
}

/**
 * Maps merged lead field definitions to Name + Email, Phone, Company column resolution (table also has Lead, Captured At, Status before Name).
 */
export function leadsInboxTableColumns(defs: CustomerLeadFieldDefinition[]): LeadsInboxTableColumn[] {
  const visible = visibleLeadFieldDefinitions(defs);
  const nameDef =
    visible.find((d) => isLeadsTableNameFieldColumn(d)) ??
    visible.find((d) => ['name', 'full_name', 'fullname'].includes(d.key.trim().toLowerCase()));
  const emailDef =
    visible.find((d) => d.type?.toLowerCase() === 'email' || d.key.trim().toLowerCase() === 'email');
  const phoneDef = visible.find((d) => {
    const k = d.key.trim().toLowerCase();
    const t = d.type?.toLowerCase();
    return t === 'tel' || t === 'phone' || k === 'phone' || k === 'mobile';
  });
  const companyDef =
    visible.find((d) => d.key.trim().toLowerCase() === 'company') ??
    visible.find((d) => (d.label?.trim().toLowerCase() ?? '') === 'company');

  return [
    { headerLabel: 'Name', field: nameDef ?? leadsInboxSyntheticField('name', 'Name', 'text') },
    { headerLabel: 'Email', field: emailDef ?? leadsInboxSyntheticField('email', 'Email', 'email') },
    { headerLabel: 'Phone', field: phoneDef ?? leadsInboxSyntheticField('phone', 'Phone', 'tel') },
    { headerLabel: 'Company', field: companyDef ?? leadsInboxSyntheticField('company', 'Company', 'text') },
  ];
}

/** Max field labels shown as tags in the leads table “Captured Fields” column; additional fields are summarized as +N. */
export const LEADS_CAPTURED_FIELD_TAG_DISPLAY_MAX = 5;

export type LeadCapturedFieldTagItem = {
  key: string;
  label: string;
  status: LeadFieldStatusUi;
};

/**
 * Non-empty captured fields for one row (definition order). Pass `excludeFieldKeys` to omit specific keys from the tag list (e.g. tests); the leads table passes none so tags mirror every captured field.
 */
export function leadCapturedFieldTagItemsForRow(
  data: Record<string, string> | undefined,
  defs: CustomerLeadFieldDefinition[],
  excludeFieldKeys: string[],
): LeadCapturedFieldTagItem[] {
  const exclude = new Set(
    excludeFieldKeys.map((k) => k.trim().toLowerCase()).filter(Boolean),
  );
  const out: LeadCapturedFieldTagItem[] = [];
  for (const d of visibleLeadFieldDefinitions(defs)) {
    const k = d.key.trim();
    if (!k) continue;
    if (exclude.has(k.toLowerCase())) continue;
    if (!formatLeadCellValue(data, k)) continue;
    out.push({ key: k, label: leadDetailFieldLabel(d), status: inferLeadFieldStatus(d) });
  }
  return out;
}

type LeadCompletenessConfigRollup = {
  requiredKeys: string[];
  emailKeys: string[];
  phoneKeys: string[];
};

function leadCompletenessConfigFromMergedDefinitions(defs: CustomerLeadFieldDefinition[]): LeadCompletenessConfigRollup {
  const requiredKeys: string[] = [];
  const emailKeys: string[] = [];
  const phoneKeys: string[] = [];
  for (const f of activeLeadFieldDefinitions(defs)) {
    if (f.disabled === true) continue;
    const k = String(f.key ?? '').trim();
    if (!k) continue;
    if (f.required !== false) requiredKeys.push(k);
    const t = String(f.type ?? 'text').toLowerCase();
    const kl = k.toLowerCase();
    if (t === 'email' || kl === 'email') emailKeys.push(k);
    if (t === 'phone' || kl === 'phone' || kl === 'mobile' || kl === 'tel') phoneKeys.push(k);
  }
  return { requiredKeys, emailKeys, phoneKeys };
}

function nonEmptyLocal(val: unknown): boolean {
  if (val == null) return false;
  return String(val).trim().length > 0;
}

/** Mirrors GET …/analytics/leads “complete” for client-side fallbacks (server rollup is authoritative). */
export function evaluateLeadAnalyticsCompleteFromCaptured(
  data: Record<string, string> | undefined,
  defs: CustomerLeadFieldDefinition[],
): boolean {
  const cfg = leadCompletenessConfigFromMergedDefinitions(defs);
  const d = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

  if (cfg.requiredKeys.length > 0) {
    return cfg.requiredKeys.every((k) => nonEmptyLocal(d[k]));
  }

  if (cfg.emailKeys.length > 0 || cfg.phoneKeys.length > 0) {
    const emailOk = cfg.emailKeys.length > 0 && cfg.emailKeys.some((k) => nonEmptyLocal(d[k]));
    const phoneOk = cfg.phoneKeys.length > 0 && cfg.phoneKeys.some((k) => nonEmptyLocal(d[k]));
    return Boolean(emailOk || phoneOk);
  }

  let n = 0;
  for (const v of Object.values(d)) {
    if (nonEmptyLocal(v)) n++;
  }
  return n >= 2;
}

export function countLoadedLeadsAnalyticsComplete(
  leads: CustomerLeadListItem[],
  defs: CustomerLeadFieldDefinition[],
): number {
  return leads.filter((lead) =>
    evaluateLeadAnalyticsCompleteFromCaptured(lead.capturedLeadData, defs),
  ).length;
}

/** CSV header cells — suffix for historical columns (inactive vs deleted). */
export function leadCsvColumnHeaderLabel(d: CustomerLeadFieldDefinition): string {
  const base = leadDetailFieldLabel(d);
  const st = inferLeadFieldStatus(d);
  if (st === 'deleted') return `${base} (Deleted)`;
  if (st === 'inactive') return `${base} (Inactive)`;
  return base;
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

const PRIMARY_KEY_PRIORITY = [
  'name',
  'full_name',
  'fullname',
  'email',
  'phone',
  'mobile',
  'company',
] as const;

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

/** Headline for list/detail: best available name-like / email / phone; else first non-empty captured field in definition order (matches Captured Fields tags, including inactive/deleted); fallback “Unknown lead”. */
export function leadPrimaryIdentity(
  capturedLeadData: Record<string, string> | undefined,
  conversationId: string,
  fieldDefinitions?: CustomerLeadFieldDefinition[],
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
  if (fieldDefinitions?.length) {
    const items = leadCapturedFieldTagItemsForRow(capturedLeadData, fieldDefinitions, []);
    if (items.length > 0) {
      const firstKey = items[0].key;
      const v = formatLeadCellValue(data, firstKey);
      if (v) {
        const sub = primaryIdentitySubline(data, firstKey, conversationId);
        return { headline: v, subline: sub, headlineKey: firstKey };
      }
    }
  }
  return {
    headline: 'Unknown lead',
    subline: primaryIdentitySublineConversationRef(conversationId),
    headlineKey: null,
  };
}

/**
 * Short label for the Lead column: Unknown, Name, Email, Phone, Company, or the configured field label.
 */
export function leadPrimaryIdentityKindLabel(
  headlineKey: string | null,
  headline: string,
  defs: CustomerLeadFieldDefinition[],
): string {
  if (!headlineKey || headline === 'Unknown lead') {
    return 'Unknown';
  }
  const kl = headlineKey.trim().toLowerCase();
  const def = defs.find((d) => d.key.trim().toLowerCase() === kl);
  if (def) {
    if (isLeadsTableNameFieldColumn(def)) return 'Name';
    const t = def.type?.trim().toLowerCase() ?? '';
    const dk = def.key.trim().toLowerCase();
    if (t === 'email' || dk === 'email') return 'Email';
    if (t === 'tel' || t === 'phone' || dk === 'phone' || dk === 'mobile') return 'Phone';
    if (dk === 'company') return 'Company';
    return leadDetailFieldLabel(def);
  }
  if (kl === 'name' || kl === 'full_name' || kl === 'fullname') return 'Name';
  if (kl === 'email') return 'Email';
  if (kl === 'phone' || kl === 'mobile') return 'Phone';
  if (kl === 'company') return 'Company';
  const words = headlineKey.replace(/[_-]+/g, ' ').trim();
  if (!words) return headlineKey;
  return words.replace(/\b\w/g, (c) => c.toUpperCase());
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
  const companyK = findCapturedKey(data, 'company');
  if (companyK && companyK.toLowerCase() !== hl) {
    const v = formatLeadCellValue(data, companyK);
    if (v) parts.push(v);
  }
  if (parts.length) return parts.join(' · ');
  return primaryIdentitySublineConversationRef(conversationId);
}

/** Dynamic columns: same as visible defs (table has separate “Lead” identity and “Name” columns). */
export function leadTableDynamicDefinitions(
  defs: CustomerLeadFieldDefinition[],
  _headlineKey: string | null,
): CustomerLeadFieldDefinition[] {
  return defs;
}

export function countLoadedLeadsWithName(leads: CustomerLeadListItem[], defs: CustomerLeadFieldDefinition[]): number {
  const nameKeys = new Set<string>();
  for (const d of defs) {
    if (inferLeadFieldStatus(d) !== 'active') continue;
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
    if (inferLeadFieldStatus(d) !== 'active') continue;
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
    if (inferLeadFieldStatus(d) !== 'active') continue;
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
  const visible = activeLeadFieldDefinitions(defs);
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
