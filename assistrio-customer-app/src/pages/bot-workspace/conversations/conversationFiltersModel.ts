import type { CustomerBotConversationsListParams } from '@/api/types';

export type TriState = 'all' | 'yes' | 'no';

export type StartedFromFilterValue =
  | ''
  | 'playground_preview'
  | 'shared_preview'
  | 'runtime_widget'
  | 'runtime_iframe'
  | 'unknown';

export type DeviceFilterValue = '' | 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export type ConversationFiltersDraft = {
  dateFrom: string;
  dateTo: string;
  startedFrom: StartedFromFilterValue;
  hasLead: TriState;
  hasVoice: TriState;
  hasDictation: TriState;
  hasAttachment: TriState;
  deviceType: DeviceFilterValue;
  countryCode: string;
};

export function defaultConversationFiltersDraft(): ConversationFiltersDraft {
  return {
    dateFrom: '',
    dateTo: '',
    startedFrom: '',
    hasLead: 'all',
    hasVoice: 'all',
    hasDictation: 'all',
    hasAttachment: 'all',
    deviceType: '',
    countryCode: '',
  };
}

function triToApi(v: TriState): boolean | undefined {
  if (v === 'all') return undefined;
  return v === 'yes';
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

/** Build API params from draft (omit “all” / empty). */
export function conversationDraftToApiParams(d: ConversationFiltersDraft): CustomerBotConversationsListParams {
  const p: CustomerBotConversationsListParams = {};
  const df = startOfLocalDayIso(d.dateFrom);
  const dt = endOfLocalDayIso(d.dateTo);
  if (df) p.dateFrom = df;
  if (dt) p.dateTo = dt;
  if (d.startedFrom) p.startedFrom = d.startedFrom;
  const hl = triToApi(d.hasLead);
  if (hl !== undefined) p.hasLead = hl;
  const hv = triToApi(d.hasVoice);
  if (hv !== undefined) p.hasVoice = hv;
  const hd = triToApi(d.hasDictation);
  if (hd !== undefined) p.hasDictation = hd;
  const ha = triToApi(d.hasAttachment);
  if (ha !== undefined) p.hasAttachment = ha;
  if (d.deviceType) p.deviceType = d.deviceType;
  const cc = d.countryCode.trim().toUpperCase().slice(0, 2);
  if (cc.length === 2) p.countryCode = cc;
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

function apiBoolToTri(v: boolean | undefined): TriState {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return 'all';
}

/** Rebuild draft from params returned from a previous apply (e.g. when reopening filters). */
export function apiParamsToConversationDraft(applied: CustomerBotConversationsListParams): ConversationFiltersDraft {
  const d = defaultConversationFiltersDraft();
  d.dateFrom = isoToDateInput(applied.dateFrom);
  d.dateTo = isoToDateInput(applied.dateTo);
  if (applied.startedFrom) d.startedFrom = applied.startedFrom as StartedFromFilterValue;
  d.hasLead = apiBoolToTri(applied.hasLead);
  d.hasVoice = apiBoolToTri(applied.hasVoice);
  d.hasDictation = apiBoolToTri(applied.hasDictation);
  d.hasAttachment = apiBoolToTri(applied.hasAttachment);
  if (applied.deviceType) d.deviceType = applied.deviceType as DeviceFilterValue;
  if (applied.countryCode) d.countryCode = applied.countryCode.trim().toUpperCase().slice(0, 2);
  return d;
}

export function countActiveConversationFilters(applied: CustomerBotConversationsListParams): number {
  let n = 0;
  if (applied.dateFrom?.trim()) n++;
  if (applied.dateTo?.trim()) n++;
  if (applied.startedFrom?.trim()) n++;
  if (applied.hasLead === true || applied.hasLead === false) n++;
  if (applied.hasVoice === true || applied.hasVoice === false) n++;
  if (applied.hasDictation === true || applied.hasDictation === false) n++;
  if (applied.hasAttachment === true || applied.hasAttachment === false) n++;
  if (applied.deviceType?.trim()) n++;
  if (applied.countryCode?.trim()) n++;
  return n;
}

export function hasAnyConversationFilters(applied: CustomerBotConversationsListParams): boolean {
  return countActiveConversationFilters(applied) > 0;
}
