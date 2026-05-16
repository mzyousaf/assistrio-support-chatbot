import type { CustomerBotLeadsListParams, CustomerLeadFieldDefinition } from '@/api/types';

export type StartedFromLeadsFilterValue =
  | ''
  | 'playground_preview'
  | 'shared_preview'
  | 'runtime_widget'
  | 'runtime_iframe'
  | 'unknown';

export type LeadsFiltersDraft = {
  dateFrom: string;
  dateTo: string;
  startedFrom: StartedFromLeadsFilterValue;
  countryCode: string;
  /** Empty = any field */
  fieldKey: string;
  search: string;
};

export function defaultLeadsFiltersDraft(): LeadsFiltersDraft {
  return {
    dateFrom: '',
    dateTo: '',
    startedFrom: '',
    countryCode: '',
    fieldKey: '',
    search: '',
  };
}

function startOfLocalDayIso(ymd: string): string | undefined {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const d = new Date(`${t}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

function endOfLocalDayIso(ymd: string): string | undefined {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined;
  const d = new Date(`${t}T23:59:59.999`);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

/** Build API params from draft (omit empty). */
export function leadsDraftToApiParams(d: LeadsFiltersDraft): CustomerBotLeadsListParams {
  const p: CustomerBotLeadsListParams = {};
  const df = startOfLocalDayIso(d.dateFrom);
  const dt = endOfLocalDayIso(d.dateTo);
  if (df) p.dateFrom = df;
  if (dt) p.dateTo = dt;
  if (d.startedFrom) p.startedFrom = d.startedFrom;
  const cc = d.countryCode.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (cc.length === 2) p.countryCode = cc;
  const fk = d.fieldKey.trim();
  if (fk) p.fieldKey = fk;
  const s = d.search.trim();
  if (s) p.search = s;
  return p;
}

function isoToDateInput(iso: string | undefined): string {
  if (!iso?.trim()) return '';
  const d = new Date(iso.trim());
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function apiParamsToLeadsDraft(p: CustomerBotLeadsListParams): LeadsFiltersDraft {
  return {
    dateFrom: isoToDateInput(p.dateFrom),
    dateTo: isoToDateInput(p.dateTo),
    startedFrom: (p.startedFrom as StartedFromLeadsFilterValue) ?? '',
    countryCode: p.countryCode?.trim().toUpperCase().slice(0, 2) ?? '',
    fieldKey: p.fieldKey?.trim() ?? '',
    search: p.search?.trim() ?? '',
  };
}

export function countActiveLeadsFilters(d: LeadsFiltersDraft): number {
  let n = 0;
  if (d.dateFrom.trim()) n++;
  if (d.dateTo.trim()) n++;
  if (d.startedFrom) n++;
  if (d.countryCode.trim().length >= 2) n++;
  if (d.fieldKey.trim()) n++;
  if (d.search.trim()) n++;
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
  for (const d of sorted) {
    const k = d.key?.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Remove one filter dimension from applied API params (chips). */
export type LeadsFilterChipId =
  | 'dateFrom'
  | 'dateTo'
  | 'startedFrom'
  | 'countryCode'
  | 'fieldKey'
  | 'search';

export function leadsParamsWithoutChip(
  applied: CustomerBotLeadsListParams,
  chip: LeadsFilterChipId,
): CustomerBotLeadsListParams {
  const next = { ...applied };
  switch (chip) {
    case 'dateFrom':
      delete next.dateFrom;
      break;
    case 'dateTo':
      delete next.dateTo;
      break;
    case 'startedFrom':
      delete next.startedFrom;
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
    default:
      break;
  }
  return next;
}
