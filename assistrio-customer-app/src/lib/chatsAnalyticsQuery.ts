import type {
  CustomerBotChatsAnalyticsParams,
  CustomerChatsAnalyticsGranularity,
  CustomerChatsAnalyticsStartedFromKey,
} from '@/api/types';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';

export type ChatsAnalyticsDatePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

export type ChatsAnalyticsUiState = {
  preset: ChatsAnalyticsDatePreset;
  /** Local `YYYY-MM-DD` when preset is `custom` */
  customFrom: string;
  customTo: string;
  includePreview: boolean;
  startedFrom: '' | CustomerChatsAnalyticsStartedFromKey;
  countryCode: string;
  deviceType: string;
};

export const CHATS_ANALYTICS_DEFAULTS: ChatsAnalyticsUiState = {
  preset: '7d',
  customFrom: '',
  customTo: '',
  includePreview: true,
  startedFrom: '',
  countryCode: '',
  deviceType: '',
};

/** Device types exposed in Chats analytics UI (must match backend `deviceInfo.deviceType` for those rows). */
const CHATS_ANALYTICS_DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet']);

export function normalizeChatsAnalyticsDeviceTypeForApi(deviceType: string): string | undefined {
  const d = deviceType.trim().toLowerCase();
  return CHATS_ANALYTICS_DEVICE_TYPES.has(d) ? d : undefined;
}

/** Local calendar `YYYY-MM-DD`. */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO range for last N full days from now (inclusive window aligned to millisecond precision). */
export function isoRangeForLastDays(days: number): { from: string; to: string } {
  const n = Math.max(1, Math.floor(days));
  const to = new Date();
  const from = new Date(to.getTime() - n * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Local calendar day: start of today through end of today (local timezone). */
export function isoRangeForToday(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Parse `YYYY-MM-DD` as local calendar date start/end for API bounds. */
export function isoRangeForLocalDateInputs(fromYmd: string, toYmd: string): { from: string; to: string } | null {
  const a = fromYmd?.trim();
  const b = toYmd?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  const from = new Date(`${a}T00:00:00`);
  const to = new Date(`${b}T23:59:59.999`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  if (from > to) return null;
  return { from: from.toISOString(), to: to.toISOString() };
}

/** Subset of UI used to resolve `from` / `to` for analytics APIs. */
export type AnalyticsDateRangeSlice = {
  preset: ChatsAnalyticsDatePreset;
  customFrom: string;
  customTo: string;
};

/**
 * Resolves API `from` / `to` from the same rules as analytics pages.
 * @param invalidCustomFallbackLastDays — when preset is `custom` but inputs are invalid, rolling window length (Chats + Topics analytics use 7).
 */
export function computeDateRangeFromAnalyticsPreset(
  state: AnalyticsDateRangeSlice,
  options?: { invalidCustomFallbackLastDays?: number },
): { from: string; to: string } {
  const fb = Math.max(1, Math.floor(options?.invalidCustomFallbackLastDays ?? 30));
  let from: string;
  let to: string;
  if (state.preset === 'custom') {
    const r = isoRangeForLocalDateInputs(state.customFrom, state.customTo);
    if (r) {
      from = r.from;
      to = r.to;
    } else {
      ({ from, to } = isoRangeForLastDays(fb));
    }
  } else if (state.preset === 'today') {
    ({ from, to } = isoRangeForToday());
  } else {
    const days = state.preset === '7d' ? 7 : state.preset === '90d' ? 90 : 30;
    ({ from, to } = isoRangeForLastDays(days));
  }
  return { from, to };
}

export function buildChatsAnalyticsApiParams(state: ChatsAnalyticsUiState): CustomerBotChatsAnalyticsParams {
  const { from, to } = computeDateRangeFromAnalyticsPreset(state, { invalidCustomFallbackLastDays: 7 });
  const granularity: CustomerChatsAnalyticsGranularity = resolveAnalyticsGranularity(from, to);

  const params: CustomerBotChatsAnalyticsParams = {
    from,
    to,
    granularity,
    includePreview: state.includePreview,
  };

  if (state.startedFrom) params.startedFrom = state.startedFrom;
  if (state.countryCode.trim()) params.countryCode = state.countryCode.trim().toUpperCase();
  const deviceForApi = normalizeChatsAnalyticsDeviceTypeForApi(state.deviceType);
  if (deviceForApi) params.deviceType = deviceForApi;

  return params;
}

/** `includePreview` omitted from query when true (matches API default). */
export function chatsAnalyticsQueryIncludesPreviewFlag(params: CustomerBotChatsAnalyticsParams): boolean {
  return params.includePreview === false;
}
