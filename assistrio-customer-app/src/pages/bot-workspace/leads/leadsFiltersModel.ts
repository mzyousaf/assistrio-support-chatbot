import type {
  CustomerBotLeadsListParams,
  CustomerChatsAnalyticsStartedFromKey,
  CustomerLeadFieldDefinition,
} from '@/api/types';
import {
  computeDateRangeFromAnalyticsPreset,
  type ChatsAnalyticsDatePreset,
} from '@/lib/chatsAnalyticsQuery';

export type LeadCompletionFilterValue = '' | 'complete' | 'partial';

const STARTED_FROM_SET = new Set<string>([
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
  'unknown',
]);

export type LeadsFiltersDraft = {
  datePreset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
  /** Mirrors analytics: when false, preview channels are excluded unless explicitly selected in `startedFromKeys`. */
  includePreview: boolean;
  startedFromKeys: CustomerChatsAnalyticsStartedFromKey[];
  countryCode: string;
  /** Empty = any field */
  fieldKey: string;
  search: string;
  leadCompletion: LeadCompletionFilterValue;
};

/** Same defaults as {@link LEADS_ANALYTICS_DEFAULTS} (Leads analytics header). */
export function defaultLeadsFiltersDraft(): LeadsFiltersDraft {
  return {
    datePreset: '7d',
    customFrom: '',
    customTo: '',
    includePreview: true,
    startedFromKeys: [],
    countryCode: '',
    fieldKey: '',
    search: '',
    leadCompletion: '',
  };
}

export function matchesDefaultLeadsDateFilters(d: Pick<LeadsFiltersDraft, 'datePreset' | 'customFrom' | 'customTo'>): boolean {
  const def = defaultLeadsFiltersDraft();
  return (
    d.datePreset === def.datePreset && d.customFrom === def.customFrom && d.customTo === def.customTo
  );
}

export function matchesDefaultLeadsWidgetFilters(
  d: Pick<LeadsFiltersDraft, 'includePreview' | 'startedFromKeys'>,
): boolean {
  const def = defaultLeadsFiltersDraft();
  if (d.includePreview !== def.includePreview) return false;
  const a = [...d.startedFromKeys].sort().join('\0');
  const b = [...def.startedFromKeys].sort().join('\0');
  return a === b;
}

function isoToLocalYmd(iso: string | undefined): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso.trim());
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inferDateSliceFromApiIso(
  dateFrom?: string,
  dateTo?: string,
): Pick<LeadsFiltersDraft, 'datePreset' | 'customFrom' | 'customTo'> {
  if (!dateFrom?.trim() || !dateTo?.trim()) {
    return { datePreset: '7d', customFrom: '', customTo: '' };
  }
  const fromMs = new Date(dateFrom).getTime();
  const toMs = new Date(dateTo).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return { datePreset: '7d', customFrom: '', customTo: '' };
  }
  const presets: ChatsAnalyticsDatePreset[] = ['today', '7d', '30d', '90d'];
  for (const preset of presets) {
    const { from, to } = computeDateRangeFromAnalyticsPreset(
      { preset, customFrom: '', customTo: '' },
      { invalidCustomFallbackLastDays: 7 },
    );
    const refFrom = new Date(from).getTime();
    const refTo = new Date(to).getTime();
    if (Math.abs(fromMs - refFrom) < 120_000 && Math.abs(toMs - refTo) < 120_000) {
      return { datePreset: preset, customFrom: '', customTo: '' };
    }
  }
  return {
    datePreset: 'custom',
    customFrom: isoToLocalYmd(dateFrom),
    customTo: isoToLocalYmd(dateTo),
  };
}

function parseStartedFromKeysParam(raw: string | undefined): CustomerChatsAnalyticsStartedFromKey[] {
  const s = raw?.trim();
  if (!s) return [];
  return [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))].filter(
    (k): k is CustomerChatsAnalyticsStartedFromKey => STARTED_FROM_SET.has(k),
  );
}

/** Build API params from draft (omit empty / defaults). */
export function leadsDraftToApiParams(d: LeadsFiltersDraft): CustomerBotLeadsListParams {
  const p: CustomerBotLeadsListParams = {};
  const { from, to } = computeDateRangeFromAnalyticsPreset(
    { preset: d.datePreset, customFrom: d.customFrom, customTo: d.customTo },
    { invalidCustomFallbackLastDays: 7 },
  );
  p.dateFrom = from;
  p.dateTo = to;
  if (d.startedFromKeys.length > 0) {
    p.startedFrom = [...d.startedFromKeys].sort().join(',');
  }
  if (d.includePreview === false) {
    p.includePreview = false;
  }
  const cc = d.countryCode.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (cc.length === 2) p.countryCode = cc;
  const fk = d.fieldKey.trim();
  if (fk) p.fieldKey = fk;
  const s = d.search.trim();
  if (s) p.search = s;
  if (d.leadCompletion === 'complete' || d.leadCompletion === 'partial') {
    p.leadCompletion = d.leadCompletion;
  }
  return p;
}

export function apiParamsToLeadsDraft(p: CustomerBotLeadsListParams): LeadsFiltersDraft {
  const dateSlice = inferDateSliceFromApiIso(p.dateFrom, p.dateTo);
  const lc = p.leadCompletion;
  const leadCompletion: LeadCompletionFilterValue =
    lc === 'complete' || lc === 'partial' ? lc : '';

  return {
    ...dateSlice,
    includePreview: p.includePreview !== false,
    startedFromKeys: parseStartedFromKeysParam(p.startedFrom),
    countryCode: p.countryCode?.trim().toUpperCase().slice(0, 2) ?? '',
    fieldKey: p.fieldKey?.trim() ?? '',
    search: p.search?.trim() ?? '',
    leadCompletion,
  };
}

export function countActiveLeadsFilters(d: LeadsFiltersDraft): number {
  let n = 0;
  if (!matchesDefaultLeadsDateFilters(d)) n++;
  if (!matchesDefaultLeadsWidgetFilters(d)) n++;
  if (d.countryCode.trim().length >= 2) n++;
  if (d.fieldKey.trim()) n++;
  if (d.search.trim()) n++;
  if (d.leadCompletion) n++;
  return n;
}

export function hasAnyLeadsFilters(d: LeadsFiltersDraft): boolean {
  return countActiveLeadsFilters(d) > 0;
}

/** Field keys available in filter dropdown (includes inactive/removed keys present on loaded/inferred definitions). */
export function leadsFilterFieldKeyOptions(defs: CustomerLeadFieldDefinition[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const sorted = [...defs].sort((a, b) => a.order - b.order);
  for (const def of sorted) {
    const k = def.key?.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export type LeadsFilterChipId =
  | 'dateRange'
  | 'widgetChannel'
  | 'countryCode'
  | 'fieldKey'
  | 'search'
  | 'leadCompletion';

export function leadsParamsWithoutChip(
  applied: CustomerBotLeadsListParams,
  chip: LeadsFilterChipId,
): CustomerBotLeadsListParams {
  const next = { ...applied };
  switch (chip) {
    case 'dateRange': {
      const d = defaultLeadsFiltersDraft();
      const { from, to } = computeDateRangeFromAnalyticsPreset(
        { preset: d.datePreset, customFrom: d.customFrom, customTo: d.customTo },
        { invalidCustomFallbackLastDays: 7 },
      );
      next.dateFrom = from;
      next.dateTo = to;
      break;
    }
    case 'widgetChannel':
      delete next.startedFrom;
      delete next.includePreview;
      break;
    case 'countryCode':
      delete next.countryCode;
      break;
    case 'fieldKey':
      delete next.fieldKey;
      break;
    case 'search':
      delete next.search;
      break;
    case 'leadCompletion':
      delete next.leadCompletion;
      break;
    default:
      break;
  }
  return next;
}
