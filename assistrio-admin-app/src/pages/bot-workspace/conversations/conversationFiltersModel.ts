import type {
  AdminBotConversationsListParams,
  AdminChatsAnalyticsStartedFromKey,
  AdminTopicsAnalyticsTopicId,
  AdminSentimentLabelId,
} from '@/api/types';
import { ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS } from '@/api/types';
import { computeDateRangeFromAnalyticsPreset } from '@/lib/chatsAnalyticsQuery';
import type { ChatsAnalyticsDatePreset } from '@/lib/chatsAnalyticsQuery';
import { analyticsDateRangeValueLabel } from '@/pages/bot-workspace/analytics/shared/analyticsFilterCapsuleUtils';
import {
  WIDGET_CHANNEL_SECTIONS,
  widgetStartedFromUiLabel,
} from '@/pages/bot-workspace/analytics/shared/widgetChannelLabels';
import {
  getLeadsFilterCountryOptions,
} from '@/pages/bot-workspace/leads/leadsFilterCountryOptions';
import { SENTIMENT_STACK_ORDER } from '@/pages/bot-workspace/analytics/sentiment/sentimentChartTheme';
import {
  sentimentTaxonomyCustomerLabel,
  topicTaxonomyCustomerLabel,
} from './conversationTopicSentimentDisplay';

const MAIN_TOPIC_ORDER = new Map<string, number>(ADMIN_TOPICS_ANALYTICS_MAIN_TOPIC_IDS.map((id, i) => [id, i]));

const SENTIMENT_ORDER = new Map<string, number>([...SENTIMENT_STACK_ORDER].map((id, i) => [id, i]));

export function sortConversationTaxonomyTopicKeys(keys: Iterable<string>): AdminTopicsAnalyticsTopicId[] {
  const uniq = [
    ...new Set(
      [...keys]
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((id): id is AdminTopicsAnalyticsTopicId => MAIN_TOPIC_ORDER.has(id)),
    ),
  ].sort((a, b) => MAIN_TOPIC_ORDER.get(a)! - MAIN_TOPIC_ORDER.get(b)!);
  return uniq;
}

export function sortConversationSentimentKeys(keys: Iterable<string>): AdminSentimentLabelId[] {
  const uniq = [
    ...new Set(
      [...keys]
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .filter((id): id is AdminSentimentLabelId => SENTIMENT_ORDER.has(id)),
    ),
  ].sort((a, b) => SENTIMENT_ORDER.get(a)! - SENTIMENT_ORDER.get(b)!);
  return uniq;
}

function topicsFromCommaParam(raw: string | undefined | null): AdminTopicsAnalyticsTopicId[] {
  if (!raw?.trim()) return [];
  return sortConversationTaxonomyTopicKeys(raw.split(','));
}

function sentimentsFromCommaParam(raw: string | undefined | null): AdminSentimentLabelId[] {
  if (!raw?.trim()) return [];
  return sortConversationSentimentKeys(raw.split(','));
}

export type TriState = 'all' | 'yes' | 'no';

export type ConversationDatePreset = 'all' | ChatsAnalyticsDatePreset;

export type DeviceFilterValue = '' | 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export type ConversationCreditsPreset = 'all' | 'zero' | 'positive' | 'custom';

const VALID_STARTED_FROM = new Set<string>([
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
]);

const CONVERSATION_WIDGET_CHANNEL_ORDER = WIDGET_CHANNEL_SECTIONS.flatMap((s) =>
  s.options.map((o) => o.id),
);
const WIDGET_ORDER_RANK = new Map(
  CONVERSATION_WIDGET_CHANNEL_ORDER.map((k, i) => [k, i] as const),
);

/** Deduplicates, drops unknown/unlisted keys, preserves Live → Preview ordering. */
export function sortConversationWidgetChannelKeys(keys: AdminChatsAnalyticsStartedFromKey[]): AdminChatsAnalyticsStartedFromKey[] {
  return [...new Set(keys.filter((k) => k !== 'unknown' && WIDGET_ORDER_RANK.has(k)))].sort(
    (a, b) => WIDGET_ORDER_RANK.get(a)! - WIDGET_ORDER_RANK.get(b)!,
  );
}

export type ConversationFiltersDraft = {
  datePreset: ConversationDatePreset;
  customFrom: string;
  customTo: string;
  startedFromKeys: AdminChatsAnalyticsStartedFromKey[];
  hasLead: TriState;
  hasVoice: TriState;
  hasDictation: TriState;
  hasAttachment: TriState;
  creditsPreset: ConversationCreditsPreset;
  creditsMin: string;
  creditsMax: string;
  /** Empty or "0" = no minimum; otherwise minimum total messages on the thread. */
  messagesMin: string;
  deviceType: DeviceFilterValue;
  countryCode: string;
  primaryTopicKeys: AdminTopicsAnalyticsTopicId[];
  /** Stored on chats as `conversationTopics.topicLabels` (main taxonomy). */
  secondaryTopicKeys: AdminTopicsAnalyticsTopicId[];
  sentimentKeys: AdminSentimentLabelId[];
};

export function defaultConversationFiltersDraft(): ConversationFiltersDraft {
  return {
    datePreset: 'all',
    customFrom: '',
    customTo: '',
    startedFromKeys: [],
    hasLead: 'all',
    hasVoice: 'all',
    hasDictation: 'all',
    hasAttachment: 'all',
    creditsPreset: 'all',
    creditsMin: '',
    creditsMax: '',
    messagesMin: '',
    deviceType: '',
    countryCode: '',
    primaryTopicKeys: [],
    secondaryTopicKeys: [],
    sentimentKeys: [],
  };
}

function triToApi(v: TriState): boolean | undefined {
  if (v === 'all') return undefined;
  return v === 'yes';
}

/** Parse comma-separated analytics channel keys from API `startedFrom`. */
export function parseConversationStartedFromParam(
  raw: string | undefined | null,
): AdminChatsAnalyticsStartedFromKey[] {
  const t = raw?.trim();
  if (!t) return [];
  const keys = [
    ...new Set(
      t
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ].filter((k): k is AdminChatsAnalyticsStartedFromKey => VALID_STARTED_FROM.has(k));
  return keys;
}

function parseNonNegNumber(raw: string | undefined): number | undefined {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return undefined;
  const n = Number.parseFloat(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Build API params from draft (omit “all” / empty). */
export function conversationDraftToApiParams(d: ConversationFiltersDraft): AdminBotConversationsListParams {
  const p: AdminBotConversationsListParams = {};
  if (d.datePreset !== 'all') {
    const { from, to } = computeDateRangeFromAnalyticsPreset(
      {
        preset: d.datePreset as ChatsAnalyticsDatePreset,
        customFrom: d.customFrom,
        customTo: d.customTo,
      },
      { invalidCustomFallbackLastDays: 30 },
    );
    p.dateFrom = from;
    p.dateTo = to;
  }
  const startedFromSorted = sortConversationWidgetChannelKeys(d.startedFromKeys);
  if (startedFromSorted.length > 0) {
    p.startedFrom = startedFromSorted.join(',');
  }
  const hl = triToApi(d.hasLead);
  if (hl !== undefined) p.hasLead = hl;
  const hv = triToApi(d.hasVoice);
  if (hv !== undefined) p.hasVoice = hv;
  const hd = triToApi(d.hasDictation);
  if (hd !== undefined) p.hasDictation = hd;
  const ha = triToApi(d.hasAttachment);
  if (ha !== undefined) p.hasAttachment = ha;

  if (d.creditsPreset === 'custom') {
    const mn = parseNonNegNumber(d.creditsMin);
    const mx = parseNonNegNumber(d.creditsMax);
    if (mn !== undefined && mx !== undefined && mn <= mx) {
      p.minCredits = mn;
      p.maxCredits = mx;
    } else if (mn !== undefined && mx === undefined) {
      p.minCredits = mn;
    } else if (mx !== undefined && mn === undefined) {
      p.maxCredits = mx;
    } else if (mn !== undefined && mx !== undefined && mn > mx) {
      p.minCredits = mx;
      p.maxCredits = mn;
    }
  } else if (d.creditsPreset === 'zero') {
    p.creditsZero = true;
  } else if (d.creditsPreset === 'positive') {
    p.creditsGtZero = true;
  }

  const msgMin = parseNonNegNumber(d.messagesMin);
  if (msgMin !== undefined && msgMin > 0) {
    p.minMessages = Math.floor(msgMin);
  }

  if (d.deviceType) p.deviceType = d.deviceType;
  const cc = d.countryCode.trim().toUpperCase().slice(0, 2);
  if (cc.length === 2) p.countryCode = cc;

  const prim = sortConversationTaxonomyTopicKeys(d.primaryTopicKeys);
  if (prim.length > 0) p.primaryTopics = prim.join(',');

  const sec = sortConversationTaxonomyTopicKeys(d.secondaryTopicKeys);
  if (sec.length > 0) p.secondaryTopics = sec.join(',');

  const sen = sortConversationSentimentKeys(d.sentimentKeys);
  if (sen.length > 0) p.sentiments = sen.join(',');

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
export function apiParamsToConversationDraft(applied: AdminBotConversationsListParams): ConversationFiltersDraft {
  const d = defaultConversationFiltersDraft();
  const df = isoToDateInput(applied.dateFrom);
  const dt = isoToDateInput(applied.dateTo);
  const hasDates = Boolean(df.trim() || dt.trim());
  if (hasDates) {
    d.datePreset = 'custom';
    d.customFrom = df.trim();
    d.customTo = dt.trim();
    if (!d.customTo && d.customFrom) d.customTo = d.customFrom;
    if (!d.customFrom && d.customTo) d.customFrom = d.customTo;
  }
  d.startedFromKeys = sortConversationWidgetChannelKeys(parseConversationStartedFromParam(applied.startedFrom));
  d.hasLead = apiBoolToTri(applied.hasLead);
  d.hasVoice = apiBoolToTri(applied.hasVoice);
  d.hasDictation = apiBoolToTri(applied.hasDictation);
  d.hasAttachment = apiBoolToTri(applied.hasAttachment);

  if (applied.minCredits != null || applied.maxCredits != null) {
    d.creditsPreset = 'custom';
    d.creditsMin = applied.minCredits != null ? String(applied.minCredits) : '';
    d.creditsMax = applied.maxCredits != null ? String(applied.maxCredits) : '';
  } else if (applied.creditsGtZero === true) {
    d.creditsPreset = 'positive';
  } else if (applied.creditsZero === true) {
    d.creditsPreset = 'zero';
  }

  if (applied.minMessages != null && applied.minMessages > 0) {
    d.messagesMin = String(Math.floor(applied.minMessages));
  }

  if (applied.deviceType) d.deviceType = applied.deviceType as DeviceFilterValue;
  if (applied.countryCode) d.countryCode = applied.countryCode.trim().toUpperCase().slice(0, 2);
  d.primaryTopicKeys = topicsFromCommaParam(applied.primaryTopics);
  d.secondaryTopicKeys = topicsFromCommaParam(applied.secondaryTopics);
  d.sentimentKeys = sentimentsFromCommaParam(applied.sentiments);
  return d;
}

/** Count discrete filter dimensions aligned with Analytics-style capsules (date range counts as one). */
export function countActiveConversationFilters(applied: AdminBotConversationsListParams): number {
  let n = 0;
  if (applied.dateFrom?.trim() || applied.dateTo?.trim()) n++;
  if (applied.startedFrom?.trim()) n++;
  if (applied.hasLead === true || applied.hasLead === false) n++;
  if (applied.hasVoice === true || applied.hasVoice === false) n++;
  if (applied.hasDictation === true || applied.hasDictation === false) n++;
  if (applied.hasAttachment === true || applied.hasAttachment === false) n++;
  if (applied.minCredits != null || applied.maxCredits != null) n++;
  if (applied.creditsGtZero === true) n++;
  if (applied.creditsZero === true) n++;
  if (applied.minMessages != null && applied.minMessages > 0) n++;
  if (applied.deviceType?.trim()) n++;
  if (applied.countryCode?.trim()) n++;
  if (applied.primaryTopics?.trim()) n++;
  if (applied.secondaryTopics?.trim()) n++;
  if (applied.sentiments?.trim()) n++;
  return n;
}

export function hasAnyConversationFilters(applied: AdminBotConversationsListParams): boolean {
  return countActiveConversationFilters(applied) > 0;
}

const DEVICE_FILTER_LABEL: Record<Exclude<DeviceFilterValue, ''>, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
  bot: 'Bot',
  unknown: 'Unknown',
};

function deviceFilterLabel(v: DeviceFilterValue): string {
  if (!v) return '';
  return DEVICE_FILTER_LABEL[v as Exclude<DeviceFilterValue, ''>] ?? v;
}

export type ConversationFilterSummaryChip = { id: string; label: string };

/**
 * Human-readable chips for the chat-log list header, derived from applied API params
 * (same decoding path as the filter modal).
 */
export function conversationAppliedFiltersSummary(
  applied: AdminBotConversationsListParams,
): ConversationFilterSummaryChip[] {
  const d = apiParamsToConversationDraft(applied);
  const chips: ConversationFilterSummaryChip[] = [];

  if (d.datePreset !== 'all') {
    chips.push({
      id: 'date',
      label: analyticsDateRangeValueLabel({
        preset: d.datePreset as ChatsAnalyticsDatePreset,
        customFrom: d.customFrom,
        customTo: d.customTo,
      }),
    });
  }

  if (d.startedFromKeys.length > 0) {
    const labels = d.startedFromKeys.map((k) => widgetStartedFromUiLabel(k));
    chips.push({
      id: 'channels',
      label:
        labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`,
    });
  }

  if (d.deviceType) {
    const deviceLabel = deviceFilterLabel(d.deviceType);
    if (deviceLabel) chips.push({ id: 'device', label: `Device: ${deviceLabel}` });
  }

  const cc = d.countryCode.trim().toUpperCase();
  if (cc.length === 2) {
    const opts = getLeadsFilterCountryOptions([cc]);
    const match = opts.find((o) => o.code === cc);
    const name = match?.name ?? cc;
    chips.push({ id: 'country', label: name.includes('(') ? name : `${name} (${cc})` });
  }

  const pushTrait = (id: string, tri: TriState, title: string) => {
    if (tri === 'all') return;
    chips.push({ id, label: `${title}: ${tri === 'yes' ? 'Yes' : 'No'}` });
  };
  pushTrait('trait-lead', d.hasLead, 'Lead captured');
  pushTrait('trait-voice', d.hasVoice, 'Voice messages');
  pushTrait('trait-dictation', d.hasDictation, 'Sessions');
  pushTrait('trait-attachment', d.hasAttachment, 'File attachments');

  if (d.primaryTopicKeys.length > 0) {
    const labels = d.primaryTopicKeys.map((id) => topicTaxonomyCustomerLabel(id)).filter(Boolean);
    chips.push({
      id: 'topic-primary',
      label:
        labels.length <= 3
          ? `Primary topics: ${labels.join(', ')}`
          : `Primary topics: ${labels.slice(0, 2).join(', ')} +${labels.length - 2}`,
    });
  }

  if (d.secondaryTopicKeys.length > 0) {
    const labels = d.secondaryTopicKeys.map((id) => topicTaxonomyCustomerLabel(id)).filter(Boolean);
    chips.push({
      id: 'topic-secondary',
      label:
        labels.length <= 3
          ? `Other topics: ${labels.join(', ')}`
          : `Other topics: ${labels.slice(0, 2).join(', ')} +${labels.length - 2}`,
    });
  }

  if (d.sentimentKeys.length > 0) {
    const labels = d.sentimentKeys.map((id) => sentimentTaxonomyCustomerLabel(id)).filter(Boolean);
    chips.push({
      id: 'sentiments',
      label:
        labels.length <= 3
          ? `Sentiments: ${labels.join(', ')}`
          : `Sentiments: ${labels.slice(0, 2).join(', ')} +${labels.length - 2}`,
    });
  }

  if (d.creditsPreset === 'zero') {
    chips.push({ id: 'credits', label: 'Credits: 0' });
  } else if (d.creditsPreset === 'positive') {
    chips.push({ id: 'credits', label: 'Credits: > 0' });
  } else if (d.creditsPreset === 'custom') {
    const mn = d.creditsMin.trim();
    const mx = d.creditsMax.trim();
    if (mn || mx) {
      let label = 'Credits: ';
      if (mn && mx) label += `${mn}–${mx}`;
      else if (mn) label += `≥ ${mn}`;
      else label += `≤ ${mx}`;
      chips.push({ id: 'credits', label });
    }
  }

  const msgMin = parseNonNegNumber(d.messagesMin);
  if (msgMin !== undefined && msgMin > 0) {
    chips.push({ id: 'messages', label: `≥ ${Math.floor(msgMin)} messages` });
  }

  return chips;
}

/**
 * Drop a single summary dimension from applied list params (aligned with {@link conversationAppliedFiltersSummary} chip ids).
 */
export function removeAppliedConversationFilterByChipId(
  applied: AdminBotConversationsListParams,
  chipId: string,
): AdminBotConversationsListParams {
  const next: AdminBotConversationsListParams = { ...applied };
  switch (chipId) {
    case 'date':
      delete next.dateFrom;
      delete next.dateTo;
      break;
    case 'channels':
      delete next.startedFrom;
      break;
    case 'device':
      delete next.deviceType;
      break;
    case 'country':
      delete next.countryCode;
      break;
    case 'trait-lead':
      delete next.hasLead;
      break;
    case 'trait-voice':
      delete next.hasVoice;
      break;
    case 'trait-dictation':
      delete next.hasDictation;
      break;
    case 'trait-attachment':
      delete next.hasAttachment;
      break;
    case 'credits':
      delete next.minCredits;
      delete next.maxCredits;
      delete next.creditsGtZero;
      delete next.creditsZero;
      break;
    case 'messages':
      delete next.minMessages;
      break;
    case 'topic-primary':
      delete next.primaryTopics;
      break;
    case 'topic-secondary':
      delete next.secondaryTopics;
      break;
    case 'sentiments':
      delete next.sentiments;
      break;
    default:
      return applied;
  }
  return next;
}
