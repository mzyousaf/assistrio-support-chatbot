import { Types } from 'mongoose';
import {
  SENTIMENT_LABEL_SET,
  TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION,
  TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE,
  TOPIC_TAXONOMY_ID_SET,
  type TopicTaxonomyId,
} from '../analytics/topic-sentiment-classification.constants';
import { narrowPrimarySubTopic, narrowSubTopicLabelArray } from '../analytics/topic-sentiment-classification.subtopics';
import type { MessageAiMeta, MessageFeedback, MessageSource, MessageVoiceMeta } from '../models/message.schema';
import { PREVIEW_STARTED_FROM_VALUES } from '../analytics/customer-chats-analytics.util';
import { normalizeLeadCaptureConfig } from './lead-capture-config';

function parseOptionalNonNegativeNumber(v: string | undefined): number | null {
  if (v == null || typeof v !== 'string' || !v.trim()) return null;
  const n = Number.parseFloat(v.trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Optional filters for workspace conversation list (customer/admin). */
export type WorkspaceConversationListFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  /** When one key, equality on `startedFrom`; when several, `{ $in }` (matches analytics OR semantics). */
  startedFromKeys?: string[] | null;
  hasLead?: boolean | null;
  hasVoice?: boolean | null;
  hasDictation?: boolean | null;
  hasAttachment?: boolean | null;
  deviceType?: string | null;
  countryCode?: string | null;
  /** Thread `totalCreditsUsed` (defaults missing to 0 in expressions). Numeric range wins over presets when set. */
  minCredits?: number | null;
  maxCredits?: number | null;
  creditsGtZero?: boolean | null;
  creditsZero?: boolean | null;
  hasQuickReply?: boolean | null;
  hasSuggestedQuestion?: boolean | null;
  /** Minimum thread `totalMessages` (missing treated as 0 in expressions). */
  minMessages?: number | null;
  /** `conversationTopics.primaryTopic` equals one of these (OR semantics). */
  primaryTopics?: string[] | null;
  /** Threads where `conversationTopics.topicLabels` overlaps this set (OR semantics). */
  secondaryTopics?: string[] | null;
  /** Thread `conversationSentiment.label` (OR semantics). */
  sentiments?: string[] | null;
};

const STARTED_FROM_VALUES = new Set([
  'playground_preview',
  'shared_preview',
  'runtime_widget',
  'runtime_iframe',
  'unknown',
]);

const DEVICE_TYPES = new Set(['desktop', 'mobile', 'tablet', 'bot', 'unknown']);

export function parseOptionalBool(v: string | undefined): boolean | null {
  if (v == null || !String(v).trim()) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return null;
}

function parseCommaTaxonomyTopics(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null;
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].filter((id) => TOPIC_TAXONOMY_ID_SET.has(id));
  return ids.length ? ids : null;
}

function parseCommaSentiments(raw: string | undefined): string[] | null {
  if (!raw?.trim()) return null;
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].filter((id) => SENTIMENT_LABEL_SET.has(id));
  return ids.length ? ids : null;
}

export function parseWorkspaceConversationListFilters(q: Record<string, string | string[] | undefined>): WorkspaceConversationListFilters {
  const one = (k: string): string | undefined => {
    const v = q[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const dateFrom = one('dateFrom')?.trim() || null;
  const dateTo = one('dateTo')?.trim() || null;
  const startedFromRaw = one('startedFrom')?.trim() || null;
  let startedFromKeys: string[] | null = null;
  if (startedFromRaw) {
    const keys = [
      ...new Set(
        startedFromRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].filter((k) => STARTED_FROM_VALUES.has(k));
    if (keys.length > 0) startedFromKeys = keys;
  }
  const deviceRaw = one('deviceType')?.trim().toLowerCase() || null;
  const deviceType = deviceRaw && DEVICE_TYPES.has(deviceRaw) ? deviceRaw : null;
  const cc = one('countryCode')?.trim().toUpperCase() || null;
  const countryCode = cc && /^[A-Z]{2}$/.test(cc) ? cc : null;
  let minCredits = parseOptionalNonNegativeNumber(one('minCredits') ?? undefined);
  let maxCredits = parseOptionalNonNegativeNumber(one('maxCredits') ?? undefined);
  if (minCredits != null && maxCredits != null && minCredits > maxCredits) {
    const swap = minCredits;
    minCredits = maxCredits;
    maxCredits = swap;
  }
  const numericCredits = minCredits != null || maxCredits != null;
  const creditsGtRaw = numericCredits ? null : parseOptionalBool(one('creditsGtZero') ?? undefined);
  const creditsZeroRaw = numericCredits ? null : parseOptionalBool(one('creditsZero') ?? undefined);
  const hasQuickReply = parseOptionalBool(one('hasQuickReply') ?? undefined);
  const hasSuggestedQuestion = parseOptionalBool(one('hasSuggestedQuestion') ?? undefined);
  let minMessages = parseOptionalNonNegativeNumber(one('minMessages') ?? undefined);
  if (minMessages != null) {
    minMessages = Math.floor(minMessages);
    if (minMessages <= 0) minMessages = null;
  }
  return {
    dateFrom,
    dateTo,
    startedFromKeys,
    hasLead: parseOptionalBool(one('hasLead') ?? undefined),
    hasVoice: parseOptionalBool(one('hasVoice') ?? undefined),
    hasDictation: parseOptionalBool(one('hasDictation') ?? undefined),
    hasAttachment: parseOptionalBool(one('hasAttachment') ?? undefined),
    deviceType,
    countryCode,
    minCredits: numericCredits ? minCredits ?? null : null,
    maxCredits: numericCredits ? maxCredits ?? null : null,
    creditsGtZero: creditsGtRaw === true ? true : null,
    creditsZero: creditsZeroRaw === true ? true : null,
    hasQuickReply,
    hasSuggestedQuestion,
    minMessages,
    primaryTopics: parseCommaTaxonomyTopics(one('primaryTopics')),
    secondaryTopics: parseCommaTaxonomyTopics(one('secondaryTopics')),
    sentiments: parseCommaSentiments(one('sentiments')),
  };
}

export function maskChatVisitorIdForList(chatVisitorId: string): string {
  const s = String(chatVisitorId ?? '').trim();
  if (!s) return '';
  if (s.length <= 8) return `…${s.slice(-2)}`;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function iso(d: unknown): string | null {
  if (d == null) return null;
  const t = d instanceof Date ? d : new Date(d as string | number);
  return Number.isFinite(t.getTime()) ? t.toISOString() : null;
}

function num(n: unknown, fallback = 0): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n;
  return fallback;
}

function bool(n: unknown, fallback = false): boolean {
  return typeof n === 'boolean' ? n : fallback;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

function safeErrorMessage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 500);
  return t || undefined;
}

export function serializeMessageAiMetaForWorkspace(meta: MessageAiMeta | undefined | null): Record<string, unknown> | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as MessageAiMeta;
  const out: Record<string, unknown> = {};
  if (str(m.modelUsed)) out.modelUsed = str(m.modelUsed);
  if (typeof m.responseTimeMs === 'number' && Number.isFinite(m.responseTimeMs)) out.responseTimeMs = Math.round(m.responseTimeMs);
  if (typeof m.promptTokens === 'number' && Number.isFinite(m.promptTokens)) out.promptTokens = Math.round(m.promptTokens);
  if (typeof m.completionTokens === 'number' && Number.isFinite(m.completionTokens)) out.completionTokens = Math.round(m.completionTokens);
  if (typeof m.totalTokens === 'number' && Number.isFinite(m.totalTokens)) out.totalTokens = Math.round(m.totalTokens);
  if (typeof m.ragUsed === 'boolean') out.ragUsed = m.ragUsed;
  if (typeof m.sourcesCount === 'number' && Number.isFinite(m.sourcesCount)) out.sourcesCount = Math.round(m.sourcesCount);
  if (typeof m.fallbackUsed === 'boolean') out.fallbackUsed = m.fallbackUsed;
  if (str(m.errorCode)) out.errorCode = str(m.errorCode);
  const em = safeErrorMessage(m.errorMessage);
  if (em) out.errorMessage = em;
  return Object.keys(out).length ? out : undefined;
}

const MAX_ATTACHMENT_NAME = 512;
const MAX_ATTACHMENT_MIME = 200;
const MAX_ATTACHMENT_URL = 2048;

function firstTrimmedString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string') {
      const t = c.trim();
      if (t) return t;
    }
  }
  return undefined;
}

/**
 * Workspace / customer dashboard: only http(s) attachment URLs are emitted.
 * Rejects s3://, file://, ftp://, and malformed URLs (never leak internal storage paths).
 */
export function isSafeCustomerAttachmentHttpUrl(raw: string | undefined | null): boolean {
  const t = String(raw ?? '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower.startsWith('s3://') || lower.startsWith('file://') || lower.startsWith('ftp://')) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * One message attachment → safe JSON for workspace / embed APIs.
 * Omits bucket, key, and non-public URLs. Keeps name/mime/size even when no safe link exists.
 */
export function serializeWorkspaceMessageAttachment(a: Record<string, unknown>): Record<string, unknown> | null {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;

  const name =
    (firstTrimmedString(a.name, a.filename, a.fileName, a.originalName) ?? 'File attached').slice(
      0,
      MAX_ATTACHMENT_NAME,
    );

  const mimeRaw = firstTrimmedString(a.mimeType, a.contentType, a.mime, a.type);
  const mimeType = mimeRaw ? mimeRaw.slice(0, MAX_ATTACHMENT_MIME) : undefined;

  let size: number | undefined;
  for (const key of ['size', 'bytes', 'sizeBytes'] as const) {
    const v = a[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      size = Math.round(v);
      break;
    }
  }

  const urlCandidates = [a.url, a.downloadUrl, a.publicUrl, a.href].filter((x) => typeof x === 'string') as string[];
  let url: string | undefined;
  for (const c of urlCandidates) {
    const t = c.trim();
    if (t && isSafeCustomerAttachmentHttpUrl(t)) {
      url = t.slice(0, MAX_ATTACHMENT_URL);
      break;
    }
  }

  let id: string | undefined;
  const idRaw = a._id;
  if (idRaw instanceof Types.ObjectId) id = idRaw.toString();
  else if (typeof idRaw === 'string' && Types.ObjectId.isValid(idRaw.trim())) id = idRaw.trim();

  const createdAt = iso(a.createdAt);

  const out: Record<string, unknown> = { name };
  if (mimeType) out.mimeType = mimeType;
  if (size !== undefined) out.size = size;
  if (url) out.url = url;
  if (id) out.id = id;
  if (createdAt) out.createdAt = createdAt;
  return out;
}

export function serializeMessageSourceForWorkspace(s: MessageSource): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (s.sourceType) row.sourceType = s.sourceType;
  if (s.knowledgeBaseItemId) row.knowledgeBaseItemId = String(s.knowledgeBaseItemId);
  if (str(s.sourceTitle)) row.sourceTitle = str(s.sourceTitle);
  if (str(s.sourceUrl)) row.sourceUrl = str(s.sourceUrl);
  if (str(s.chunkId)) row.chunkId = str(s.chunkId);
  if (typeof s.score === 'number' && Number.isFinite(s.score)) row.score = s.score;
  if (str(s.preview)) row.preview = str(s.preview)!.slice(0, 500);
  if (str(s.docId)) row.docId = str(s.docId);
  if (str(s.docTitle)) row.docTitle = str(s.docTitle);
  if (s.usedAt) {
    const u = iso(s.usedAt);
    if (u) row.usedAt = u;
  }
  return row;
}

export function serializeMessageFeedbackForWorkspace(
  fb: MessageFeedback | undefined | null | Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!fb || typeof fb !== 'object') return undefined;
  const f = fb as MessageFeedback;
  const rating = f.rating === 'up' || f.rating === 'down' ? f.rating : undefined;
  if (!rating) return undefined;
  const out: Record<string, unknown> = { rating };
  const ca = iso((f as { createdAt?: unknown }).createdAt);
  if (ca) out.createdAt = ca;
  const ua = iso((f as { updatedAt?: unknown }).updatedAt);
  if (ua) out.updatedAt = ua;
  return Object.keys(out).length ? out : undefined;
}

export function serializeMessageVoiceMetaForWorkspace(vm: MessageVoiceMeta | undefined | null): Record<string, unknown> | undefined {
  if (!vm || typeof vm !== 'object') return undefined;
  const v = vm as MessageVoiceMeta;
  const out: Record<string, unknown> = {};
  if (typeof v.isVoiceMessage === 'boolean') out.isVoiceMessage = v.isVoiceMessage;
  if (typeof v.isDictationMessage === 'boolean') out.isDictationMessage = v.isDictationMessage;
  if (typeof v.speechDurationSeconds === 'number' && Number.isFinite(v.speechDurationSeconds)) {
    out.speechDurationSeconds = v.speechDurationSeconds;
  }
  if (typeof v.speechToTextCharacters === 'number' && Number.isFinite(v.speechToTextCharacters)) {
    out.speechToTextCharacters = Math.round(v.speechToTextCharacters);
  }
  if (typeof v.speechToTextWords === 'number' && Number.isFinite(v.speechToTextWords)) {
    out.speechToTextWords = Math.round(v.speechToTextWords);
  }
  if (str(v.transcriptionProvider)) out.transcriptionProvider = str(v.transcriptionProvider);
  if (v.transcriptionStatus) out.transcriptionStatus = v.transcriptionStatus;
  if (typeof v.dictationDurationSeconds === 'number' && Number.isFinite(v.dictationDurationSeconds)) {
    out.dictationDurationSeconds = v.dictationDurationSeconds;
  }
  if (typeof v.audioDurationSeconds === 'number' && Number.isFinite(v.audioDurationSeconds)) {
    out.audioDurationSeconds = v.audioDurationSeconds;
  }
  if (typeof v.audioSizeBytes === 'number' && Number.isFinite(v.audioSizeBytes)) {
    out.audioSizeBytes = Math.round(v.audioSizeBytes);
  }
  if (str(v.audioMimeType)) out.audioMimeType = str(v.audioMimeType);
  if (typeof (v as { dictationSessionCount?: unknown }).dictationSessionCount === 'number') {
    const n = Number((v as { dictationSessionCount: number }).dictationSessionCount);
    if (Number.isFinite(n)) out.dictationSessionCount = Math.round(n);
  }
  return Object.keys(out).length ? out : undefined;
}

export function serializeMessageCreditBreakdownForWorkspace(rows: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(rows) || rows.length === 0) return undefined;
  const out: Record<string, unknown>[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const key = str(row.key);
    const label = str(row.label);
    const count = typeof row.count === 'number' && Number.isFinite(row.count) ? row.count : NaN;
    const creditsEach = typeof row.creditsEach === 'number' && Number.isFinite(row.creditsEach) ? row.creditsEach : NaN;
    const creditsUsed = typeof row.creditsUsed === 'number' && Number.isFinite(row.creditsUsed) ? row.creditsUsed : NaN;
    const billable = row.billable === true || row.billable === false ? row.billable : undefined;
    if (!key || !label || !Number.isFinite(count) || !Number.isFinite(creditsEach) || !Number.isFinite(creditsUsed) || billable === undefined) continue;
    out.push({
      key,
      label,
      count,
      creditsEach,
      creditsUsed,
      billable,
    });
  }
  return out.length ? out : undefined;
}

type LeanConversation = Record<string, unknown>;

export function conversationOriginSummaryForList(c: LeanConversation): Record<string, unknown> | undefined {
  const o = c.conversationOrigin as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  if (str(o.source)) out.source = str(o.source);
  if (str(o.mode)) out.mode = str(o.mode);
  if (str(o.embedType)) out.embedType = str(o.embedType);
  if (str(o.websiteOrigin)) out.websiteOrigin = str(o.websiteOrigin);
  if (str(o.pageUrl)) out.pageUrl = str(o.pageUrl);
  if (str(o.referrer)) out.referrer = str(o.referrer);
  return Object.keys(out).length ? out : undefined;
}

export function conversationOriginForDetail(c: LeanConversation): Record<string, unknown> | undefined {
  const o = c.conversationOrigin as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const k of [
    'source',
    'mode',
    'embedType',
    'pageUrl',
    'referrer',
    'websiteOrigin',
    'parentOrigin',
    'iframeUrl',
    'sharedUrl',
    'shareSlug',
  ] as const) {
    const v = str(o[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function locationSummaryForList(c: LeanConversation): Record<string, unknown> | undefined {
  const loc = c.location as Record<string, unknown> | undefined;
  if (!loc || typeof loc !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const k of ['country', 'countryCode', 'region', 'city', 'timezone'] as const) {
    const v = str(loc[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function locationForDetail(c: LeanConversation): Record<string, unknown> | undefined {
  const loc = c.location as Record<string, unknown> | undefined;
  if (!loc || typeof loc !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const k of ['country', 'countryCode', 'region', 'city', 'timezone', 'source'] as const) {
    const v = str(loc[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

const SENTIMENT_LABELS = new Set(['positive', 'neutral', 'negative', 'mixed', 'unknown']);

/** Max secondary topic labels per user message (workspace API). */
const MESSAGE_TOPIC_LABELS_MAX = 3;

function sanitizedSentimentPayload(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const labelRaw = String(s.label ?? '').trim().toLowerCase();
  const label = SENTIMENT_LABELS.has(labelRaw) ? labelRaw : undefined;
  const scoreRaw = typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : undefined;
  if (!label && scoreRaw === undefined) return undefined;
  const out: Record<string, unknown> = {};
  if (label) out.label = label;
  if (scoreRaw !== undefined) out.score = Math.round(scoreRaw * 1000) / 1000;
  return Object.keys(out).length ? out : undefined;
}

function messageTopicsForWorkspace(m: Record<string, unknown>): Record<string, unknown> | undefined {
  const t = m.topics as Record<string, unknown> | undefined;
  if (!t || typeof t !== 'object') return undefined;
  const primaryRaw = String(t.primaryTopic ?? '').trim();
  const primary =
    primaryRaw && TOPIC_TAXONOMY_ID_SET.has(primaryRaw) ? primaryRaw : primaryRaw ? 'other' : '';
  const labelsIn = Array.isArray(t.topicLabels) ? t.topicLabels : [];
  const labels: string[] = [];
  for (const x of labelsIn) {
    if (typeof x !== 'string') continue;
    const s = x.trim();
    if (!s) continue;
    labels.push(TOPIC_TAXONOMY_ID_SET.has(s) ? s : 'other');
    if (labels.length >= MESSAGE_TOPIC_LABELS_MAX) break;
  }
  const dedup = [...new Set(labels)];
  const confRaw = t.topicConfidence;
  const topicConfidence =
    typeof confRaw === 'number' && Number.isFinite(confRaw) ? Math.round(confRaw * 1000) / 1000 : undefined;

  const out: Record<string, unknown> = {};
  if (primary) out.primaryTopic = primary.slice(0, 64);
  if (dedup.length) out.topicLabels = dedup.map((l) => l.slice(0, 64));
  if (topicConfidence !== undefined) out.topicConfidence = topicConfidence;

  if (primary) {
    const pm = primary as TopicTaxonomyId;
    const mainsOrdered: TopicTaxonomyId[] = [...new Set([pm, ...(dedup as TopicTaxonomyId[])])];
    const primarySub = narrowPrimarySubTopic(t.primarySubTopic, pm);
    let subTopicLabels = narrowSubTopicLabelArray(t.subTopicLabels, mainsOrdered, TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE);
    if (primarySub && !subTopicLabels.includes(primarySub)) {
      subTopicLabels = [primarySub, ...subTopicLabels].slice(0, TOPIC_SUBTOPIC_LABELS_MAX_PER_MESSAGE);
    }
    if (primarySub) out.primarySubTopic = primarySub.slice(0, 80);
    if (subTopicLabels.length) out.subTopicLabels = subTopicLabels.map((s) => s.slice(0, 80));
  }

  return Object.keys(out).length ? out : undefined;
}

/** Whitelist topics exposed on customer conversation detail (must match taxonomy). */
function conversationTopicsForDetail(c: LeanConversation): Record<string, unknown> | undefined {
  const t = c.conversationTopics as Record<string, unknown> | undefined;
  if (!t || typeof t !== 'object') return undefined;
  const primaryRaw = String(t.primaryTopic ?? '').trim();
  const primary =
    primaryRaw && TOPIC_TAXONOMY_ID_SET.has(primaryRaw) ? primaryRaw : primaryRaw ? 'other' : '';
  const labelsIn = Array.isArray(t.topicLabels) ? t.topicLabels : [];
  const labels: string[] = [];
  for (const x of labelsIn) {
    if (typeof x !== 'string') continue;
    const s = x.trim();
    if (!s) continue;
    labels.push(TOPIC_TAXONOMY_ID_SET.has(s) ? s : 'other');
    if (labels.length >= 5) break;
  }
  const dedup = [...new Set(labels)];
  if (!primary && dedup.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  if (primary) out.primaryTopic = primary.slice(0, 64);
  if (dedup.length) out.topicLabels = dedup.map((l) => l.slice(0, 64));

  const mainForSubs = (primary || dedup[0] || '') as string;
  if (mainForSubs && TOPIC_TAXONOMY_ID_SET.has(mainForSubs)) {
    const pm = mainForSubs as TopicTaxonomyId;
    const mainsOrdered: TopicTaxonomyId[] = [...new Set([pm, ...(dedup as TopicTaxonomyId[])])];
    const primarySub = narrowPrimarySubTopic(t.primarySubTopic, pm);
    let subTopicLabels = narrowSubTopicLabelArray(t.subTopicLabels, mainsOrdered, TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION);
    if (primarySub && !subTopicLabels.includes(primarySub)) {
      subTopicLabels = [primarySub, ...subTopicLabels].slice(0, TOPIC_SUBTOPIC_LABELS_MAX_ON_CONVERSATION);
    }
    if (primarySub) out.primarySubTopic = primarySub.slice(0, 80);
    if (subTopicLabels.length) out.subTopicLabels = subTopicLabels.map((s) => s.slice(0, 80));
  }

  return Object.keys(out).length ? out : undefined;
}
function conversationSentimentForDetail(c: LeanConversation): Record<string, unknown> | undefined {
  return sanitizedSentimentPayload(c.conversationSentiment);
}

/** Lead answers keyed like bot config `leadCapture.fields[].key`. */
export function extractCapturedLeadDataForWorkspace(c: LeanConversation): Record<string, string> | undefined {
  const raw = c.capturedLeadData as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k0, v0] of Object.entries(raw as Record<string, unknown>)) {
    const k = typeof k0 === 'string' ? k0.trim().slice(0, 96) : '';
    if (!k) continue;
    const v =
      typeof v0 === 'string'
        ? v0.trim().slice(0, 4000)
        : v0 !== null && v0 !== undefined
          ? String(v0).trim().slice(0, 4000)
          : '';
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Per lead field key: visitor message id that last set that value (customer API only). */
export function extractCapturedLeadFieldMessageIdsForWorkspace(
  c: LeanConversation,
): Record<string, string> | undefined {
  const raw = c.capturedLeadFieldMessageIds as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k0, v0] of Object.entries(raw as Record<string, unknown>)) {
    const k = typeof k0 === 'string' ? k0.trim().slice(0, 96) : '';
    if (!k) continue;
    if (v0 instanceof Types.ObjectId) out[k] = v0.toString();
    else if (typeof v0 === 'string' && Types.ObjectId.isValid(v0.trim())) out[k] = v0.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function capturedLeadDataForDetail(c: LeanConversation): Record<string, string> | undefined {
  return extractCapturedLeadDataForWorkspace(c);
}

function deviceSummaryForList(c: LeanConversation): Record<string, unknown> | undefined {
  const d = c.deviceInfo as Record<string, unknown> | undefined;
  if (!d || typeof d !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  if (str(d.deviceType)) out.deviceType = str(d.deviceType);
  if (str(d.browser)) out.browser = str(d.browser);
  if (str(d.os)) out.os = str(d.os);
  if (str(d.language)) out.language = str(d.language);
  return Object.keys(out).length ? out : undefined;
}

function deviceForDetail(c: LeanConversation): Record<string, unknown> | undefined {
  const d = c.deviceInfo as Record<string, unknown> | undefined;
  if (!d || typeof d !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const k of [
    'deviceType',
    'browser',
    'browserVersion',
    'os',
    'osVersion',
    'screenWidth',
    'screenHeight',
    'language',
  ] as const) {
    const v = d[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v);
    else if (str(v)) out[k] = str(v);
  }
  return Object.keys(out).length ? out : undefined;
}

function conversationCounters(c: LeanConversation): Record<string, number> {
  return {
    totalUserMessages: num(c.totalUserMessages),
    totalAssistantMessages: num(c.totalAssistantMessages),
    totalMessages: num(c.totalMessages),
    textMessageCount: num(c.textMessageCount),
    voiceMessageCount: num(c.voiceMessageCount),
    dictationMessageCount: num(c.dictationMessageCount),
    attachmentMessageCount: num(c.attachmentMessageCount),
    suggestedQuestionMessageCount: num(c.suggestedQuestionMessageCount),
    quickReplyMessageCount: num(c.quickReplyMessageCount),
    totalCreditsUsed: num(c.totalCreditsUsed),
    sourcesUsedCount: num(c.sourcesUsedCount),
  };
}

export function serializeWorkspaceConversationListRow(
  c: LeanConversation,
  previews: { userPreview: string; assistantPreview: string },
): Record<string, unknown> {
  const _id = c._id as Types.ObjectId;
  const id = _id.toString();
  const lastActivityAt =
    iso(c.lastActivityAt) ?? iso(c.createdAt) ?? new Date().toISOString();
  const chatVisitorId = String(c.chatVisitorId ?? '');
  const { quickReplyMessageCount: _omitQuickReply, ...listCounters } = conversationCounters(c);
  void _omitQuickReply;
  const leadFieldKeys = Array.isArray(c.leadFieldKeys)
    ? (c.leadFieldKeys as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;
  const conversationSentiment = conversationSentimentForDetail(c);
  const conversationTopics = conversationTopicsForDetail(c);
  return {
    id,
    conversationId: id,
    chatVisitorId: maskChatVisitorIdForList(chatVisitorId),
    ...(str(c.sessionId) ? { sessionId: str(c.sessionId) } : {}),
    userPreview: previews.userPreview,
    assistantPreview: previews.assistantPreview,
    startedAt: iso(c.startedAt),
    firstUserMessageAt: iso(c.firstUserMessageAt),
    lastUserMessageAt: iso(c.lastUserMessageAt),
    lastAssistantMessageAt: iso(c.lastAssistantMessageAt),
    lastMessageAt: iso(c.lastMessageAt),
    lastActivityAt,
    createdAt: iso(c.createdAt),
    startedFrom: str(c.startedFrom) ?? null,
    sessionSource: str(c.sessionSource) ?? null,
    conversationOrigin: conversationOriginSummaryForList(c) ?? null,
    location: locationSummaryForList(c) ?? null,
    deviceInfo: deviceSummaryForList(c) ?? null,
    ...listCounters,
    hasLead: bool(c.hasLead),
    hasVoice: bool(c.hasVoice),
    hasDictation: bool(c.hasDictation),
    hasAttachment: bool(c.hasAttachment),
    status: str(c.status) ?? 'active',
    ...(leadFieldKeys?.length ? { leadFieldKeys } : {}),
    ...(conversationSentiment ? { conversationSentiment } : {}),
    ...(conversationTopics ? { conversationTopics } : {}),
  };
}

export function serializeWorkspaceConversationDetail(c: LeanConversation, botId: string): Record<string, unknown> {
  const _id = c._id as Types.ObjectId;
  const id = _id.toString();
  const counters = conversationCounters(c);
  const leadFieldKeys = Array.isArray(c.leadFieldKeys)
    ? (c.leadFieldKeys as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;
  const leadSid = c.leadSourceMessageId;
  let leadSourceMessageId: string | undefined;
  if (leadSid instanceof Types.ObjectId) leadSourceMessageId = leadSid.toString();
  else if (typeof leadSid === 'string' && Types.ObjectId.isValid(leadSid)) leadSourceMessageId = leadSid;

  const chatVisitorIdRaw = typeof c.chatVisitorId === 'string' ? str(c.chatVisitorId) : undefined;

  const capturedLeadData = capturedLeadDataForDetail(c);
  const conversationSentiment = conversationSentimentForDetail(c);
  const conversationTopics = conversationTopicsForDetail(c);

  return {
    id,
    conversationId: id,
    botId,
    ...(chatVisitorIdRaw ? { chatVisitorId: chatVisitorIdRaw } : {}),
    ...(str(c.sessionId) ? { sessionId: str(c.sessionId) } : {}),
    ...(str(c.visitorId) ? { legacyVisitorId: str(c.visitorId) } : {}),
    startedFrom: str(c.startedFrom) ?? undefined,
    sessionSource: str(c.sessionSource) ?? undefined,
    status: str(c.status) ?? 'active',
    startedAt: iso(c.startedAt),
    firstUserMessageAt: iso(c.firstUserMessageAt),
    lastUserMessageAt: iso(c.lastUserMessageAt),
    lastAssistantMessageAt: iso(c.lastAssistantMessageAt),
    lastMessageAt: iso(c.lastMessageAt),
    lastActivityAt: iso(c.lastActivityAt) ?? iso(c.createdAt),
    createdAt: iso(c.createdAt),
    endedAt: iso(c.endedAt),
    conversationOrigin: conversationOriginForDetail(c),
    location: locationForDetail(c),
    deviceInfo: deviceForDetail(c),
    ...counters,
    hasLead: bool(c.hasLead),
    leadCapturedAt: iso(c.leadCapturedAt),
    ...(leadFieldKeys?.length ? { leadFieldKeys } : {}),
    ...(leadSourceMessageId ? { leadSourceMessageId } : {}),
    ...(capturedLeadData ? { capturedLeadData } : {}),
    ...(conversationSentiment ? { conversationSentiment } : {}),
    ...(conversationTopics ? { conversationTopics } : {}),
    hasVoice: bool(c.hasVoice),
    hasDictation: bool(c.hasDictation),
    hasAttachment: bool(c.hasAttachment),
  };
}

/**
 * Match for workspace conversation list (cursor + optional filters).
 * Uses `$and` when multiple constraints apply so `lastActivityAt` bounds compose safely.
 */
export function buildWorkspaceConversationListMatch(
  botOid: Types.ObjectId,
  filters: WorkspaceConversationListFilters | undefined,
  beforeIso: string | null | undefined,
): Record<string, unknown> {
  const parts: Record<string, unknown>[] = [{ botId: botOid }];
  if (beforeIso) {
    const d = new Date(beforeIso);
    if (Number.isFinite(d.getTime())) parts.push({ lastActivityAt: { $lt: d } });
  }
  if (filters?.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (Number.isFinite(d.getTime())) parts.push({ lastActivityAt: { $gte: d } });
  }
  if (filters?.dateTo) {
    const d = new Date(filters.dateTo);
    if (Number.isFinite(d.getTime())) parts.push({ lastActivityAt: { $lte: d } });
  }
  const keys = filters?.startedFromKeys?.filter(Boolean) ?? [];
  if (keys.length === 1) {
    parts.push({ startedFrom: keys[0] });
  } else if (keys.length > 1) {
    parts.push({ startedFrom: { $in: keys } });
  }
  if (filters?.hasLead === true) parts.push({ hasLead: true });
  if (filters?.hasLead === false) {
    parts.push({ $or: [{ hasLead: false }, { hasLead: { $exists: false } }] });
  }
  if (filters?.hasVoice === true) parts.push({ hasVoice: true });
  if (filters?.hasVoice === false) {
    parts.push({ $or: [{ hasVoice: false }, { hasVoice: { $exists: false } }] });
  }
  if (filters?.hasDictation === true) parts.push({ hasDictation: true });
  if (filters?.hasDictation === false) {
    parts.push({ $or: [{ hasDictation: false }, { hasDictation: { $exists: false } }] });
  }
  if (filters?.hasAttachment === true) parts.push({ hasAttachment: true });
  if (filters?.hasAttachment === false) {
    parts.push({ $or: [{ hasAttachment: false }, { hasAttachment: { $exists: false } }] });
  }
  if (filters?.deviceType) parts.push({ 'deviceInfo.deviceType': filters.deviceType });
  if (filters?.countryCode) parts.push({ 'location.countryCode': filters.countryCode });

  if (filters?.minMessages != null) {
    const messagesAsDouble = { $toDouble: { $ifNull: ['$totalMessages', 0] } };
    parts.push({
      $expr: { $gte: [messagesAsDouble, filters.minMessages] },
    });
  }

  const creditsAsDouble = { $toDouble: { $ifNull: ['$totalCreditsUsed', 0] } };
  if (filters?.minCredits != null || filters?.maxCredits != null) {
    const checks: Record<string, unknown>[] = [];
    if (filters.minCredits != null) {
      checks.push({ $gte: [creditsAsDouble, filters.minCredits] });
    }
    if (filters.maxCredits != null) {
      checks.push({ $lte: [creditsAsDouble, filters.maxCredits] });
    }
    parts.push({
      $expr: checks.length === 1 ? checks[0] : { $and: checks },
    });
  } else if (filters?.creditsGtZero === true) {
    parts.push({ $expr: { $gt: [creditsAsDouble, 0] } });
  } else if (filters?.creditsZero === true) {
    parts.push({ $expr: { $lte: [creditsAsDouble, 0] } });
  }

  if (filters?.hasQuickReply === true) {
    parts.push({ $expr: { $gt: [{ $ifNull: ['$quickReplyMessageCount', 0] }, 0] } });
  } else if (filters?.hasQuickReply === false) {
    parts.push({ $expr: { $lte: [{ $ifNull: ['$quickReplyMessageCount', 0] }, 0] } });
  }
  if (filters?.hasSuggestedQuestion === true) {
    parts.push({ $expr: { $gt: [{ $ifNull: ['$suggestedQuestionMessageCount', 0] }, 0] } });
  } else if (filters?.hasSuggestedQuestion === false) {
    parts.push({ $expr: { $lte: [{ $ifNull: ['$suggestedQuestionMessageCount', 0] }, 0] } });
  }

  const sen = filters?.sentiments?.filter(Boolean) ?? [];
  if (sen.length === 1) {
    parts.push({ 'conversationSentiment.label': sen[0] });
  } else if (sen.length > 1) {
    parts.push({ 'conversationSentiment.label': { $in: sen } });
  }

  const pts = filters?.primaryTopics?.filter(Boolean) ?? [];
  if (pts.length === 1) {
    parts.push({ 'conversationTopics.primaryTopic': pts[0] });
  } else if (pts.length > 1) {
    parts.push({ 'conversationTopics.primaryTopic': { $in: pts } });
  }

  const sec = filters?.secondaryTopics?.filter(Boolean) ?? [];
  if (sec.length > 0) {
    parts.push({ 'conversationTopics.topicLabels': { $in: sec } });
  }

  return parts.length === 1 ? parts[0] : { $and: parts };
}

export function serializeWorkspaceMessageRow(m: Record<string, unknown>): Record<string, unknown> {
  const _id = m._id as Types.ObjectId;
  const messageId = _id.toString();
  const role = String(m.role || '');
  const createdAt = iso(m.createdAt) ?? new Date().toISOString();
  const content = String(m.content ?? '');

  const si = m.speechInput as Record<string, unknown> | undefined;
  const speechOut =
    si && (si.mode === 'voice' || si.mode === 'dictate')
      ? {
          mode: si.mode as 'dictate' | 'voice',
          ...(typeof si.transcript === 'string' && si.transcript.trim() ? { transcript: si.transcript.trim() } : {}),
          ...(typeof si.audioUrl === 'string' && si.audioUrl.trim() ? { audioUrl: si.audioUrl.trim() } : {}),
          ...(typeof si.mimeType === 'string' && si.mimeType.trim() ? { mimeType: si.mimeType.trim() } : {}),
          ...(typeof si.durationMs === 'number' && Number.isFinite(si.durationMs) && si.durationMs >= 0
            ? { durationMs: Math.round(si.durationMs) }
            : {}),
        }
      : undefined;

  const attRaw = Array.isArray(m.attachments) ? m.attachments : [];
  const attachmentsOut =
    attRaw.length > 0
      ? (attRaw as Record<string, unknown>[])
          .map((x) => serializeWorkspaceMessageAttachment(x))
          .filter((row): row is Record<string, unknown> => row != null && Object.keys(row).length > 0)
      : undefined;

  const base: Record<string, unknown> = {
    id: messageId,
    messageId,
    role,
    content,
    text: content,
    createdAt,
  };

  if (speechOut) base.speechInput = speechOut;
  if (attachmentsOut?.length) base.attachments = attachmentsOut;

  if (role === 'user') {
    if (str(m.inputType)) base.inputType = str(m.inputType);
    if (str(m.inputMethod)) base.inputMethod = str(m.inputMethod);
    const vm = serializeMessageVoiceMetaForWorkspace(m.voiceMeta as MessageVoiceMeta | undefined);
    if (vm) base.voiceMeta = vm;
    if (typeof m.creditCost === 'number' && Number.isFinite(m.creditCost)) base.creditCost = m.creditCost;
    if (str(m.creditReason)) base.creditReason = str(m.creditReason);
    if (str(m.billingType)) base.billingType = str(m.billingType);
    if (str(m.quotaPeriod)) base.quotaPeriod = str(m.quotaPeriod);
    const ch = iso(m.chargedAt);
    if (ch) base.chargedAt = ch;
    const breakdown = serializeMessageCreditBreakdownForWorkspace((m as { creditBreakdown?: unknown }).creditBreakdown);
    if (breakdown?.length) base.creditBreakdown = breakdown;
    const topics = messageTopicsForWorkspace(m);
    if (topics) base.topics = topics;
    const sentiment = sanitizedSentimentPayload(m.sentiment);
    if (sentiment) base.sentiment = sentiment;
  }

  if (role === 'assistant') {
    const sourcesRaw = Array.isArray(m.sources) ? m.sources : [];
    const sources = (sourcesRaw as MessageSource[]).map((s) => serializeMessageSourceForWorkspace(s)).filter((x) => Object.keys(x).length > 0);
    if (sources.length) base.sources = sources;
    const ai = serializeMessageAiMetaForWorkspace(m.aiMeta as MessageAiMeta | undefined);
    if (ai) base.aiMeta = ai;
    const fb = serializeMessageFeedbackForWorkspace(m.feedback as MessageFeedback | undefined);
    if (fb) base.feedback = fb;
    if (m.isWelcomeMessage === true || m.inputType === 'welcome') {
      base.isWelcomeMessage = true;
    }
  }

  return base;
}

// --- Customer Leads API (Conversation-backed, `hasLead: true`) ---

export type WorkspaceLeadsListFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Single key, or comma-separated keys (OR), each in {@link STARTED_FROM_VALUES}. */
  startedFrom?: string | null;
  countryCode?: string | null;
  /** Only conversations with a non-empty string value for this `capturedLeadData` key. */
  fieldKey?: string | null;
  /** Case-insensitive match against any string value in `capturedLeadData`. */
  search?: string | null;
  /** Analytics-parity complete vs partial (optional). */
  leadCompletion?: 'complete' | 'partial' | null;
  /** When false, exclude preview channels if `startedFrom` is unset (analytics parity). */
  includePreview?: boolean;
};

export function parseWorkspaceLeadsListFilters(q: Record<string, string | string[] | undefined>): WorkspaceLeadsListFilters {
  const one = (k: string): string | undefined => {
    const v = q[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const dateFrom = one('dateFrom')?.trim() || null;
  const dateTo = one('dateTo')?.trim() || null;
  const startedFromRaw = one('startedFrom')?.trim() || null;
  let startedFrom: string | null = null;
  if (startedFromRaw) {
    const keys = [...new Set(startedFromRaw.split(',').map((x) => x.trim()).filter(Boolean))].filter((k) =>
      STARTED_FROM_VALUES.has(k),
    );
    if (keys.length === 1) startedFrom = keys[0]!;
    else if (keys.length > 1) startedFrom = keys.sort().join(',');
  }
  const cc = one('countryCode')?.trim().toUpperCase() || null;
  const countryCode = cc && /^[A-Z]{2}$/.test(cc) ? cc : null;
  const fieldKeyRaw = one('fieldKey')?.trim() || null;
  const fieldKey = sanitizeLeadFieldKeyFilter(fieldKeyRaw);
  const search = one('search')?.trim() || null;
  const lcRaw = one('leadCompletion')?.trim().toLowerCase() || null;
  const leadCompletion =
    lcRaw === 'complete' || lcRaw === 'partial' ? (lcRaw as 'complete' | 'partial') : null;
  const includePreviewFlag = parseOptionalBool(one('includePreview'));
  const includePreview = includePreviewFlag !== false;
  return {
    dateFrom,
    dateTo,
    startedFrom,
    countryCode,
    fieldKey: fieldKey ?? null,
    search,
    leadCompletion,
    includePreview,
  };
}

/** Allow only safe Mongo subfield keys (no `.` injection). */
export function sanitizeLeadFieldKeyFilter(raw: string | null | undefined): string | undefined {
  const t = String(raw ?? '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t)) return undefined;
  return t;
}

function escapeRegexForMongo(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Title-case style fallback when a captured key has no bot label (deleted custom field). */
export function humanizeCustomerLeadFieldKey(key: string): string {
  const s = String(key ?? '').trim();
  if (!s) return 'Unknown';
  return s
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Keys in capturedLeadData that have a non-empty string value (workspace-safe). */
export function collectCapturedLeadDataKeysWithValues(capturedLeadData: Record<string, unknown> | undefined | null): string[] {
  if (!capturedLeadData || typeof capturedLeadData !== 'object') return [];
  const keys: string[] = [];
  for (const k of Object.keys(capturedLeadData)) {
    const t = String(k ?? '').trim();
    if (!t) continue;
    const v = capturedLeadData[k];
    if (v != null && String(v).trim() !== '') keys.push(t);
  }
  return keys;
}

/** Union of keys that have values across many lead rows (customer inbox page). */
export function collectCapturedLeadDataKeysUnionFromLeadRows(
  leads: Array<{ capturedLeadData?: Record<string, unknown> }>,
): string[] {
  const s = new Set<string>();
  for (const row of leads) {
    for (const k of collectCapturedLeadDataKeysWithValues(row.capturedLeadData)) {
      s.add(k);
    }
  }
  return [...s];
}

export type CapturedLeadFieldMetaRow = { label?: string; type?: string };

function extractCapturedLeadFieldMetaLean(c: Record<string, unknown>): Record<string, { label: string; type: string }> | undefined {
  const raw = c.capturedLeadFieldMeta as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, { label: string; type: string }> = {};
  for (const [k, v] of Object.entries(raw)) {
    const kk = String(k ?? '').trim();
    if (!kk || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    const vr = v as Record<string, unknown>;
    const labelRaw = str(vr.label);
    const typeRaw = str(vr.type);
    const label = (labelRaw?.trim() || humanizeCustomerLeadFieldKey(kk)).trim();
    const type = (typeRaw?.trim() || 'text').trim();
    out[kk] = { label, type };
  }
  return Object.keys(out).length ? out : undefined;
}

/** Matches runtime normalization: explicit boolean `enabled`, else true when any fields exist. */
export function leadCaptureGloballyEnabledFromRaw(leadCapture: unknown): boolean {
  if (!leadCapture || typeof leadCapture !== 'object') return false;
  const lc = leadCapture as { enabled?: boolean; fields?: unknown[] };
  if (typeof lc.enabled === 'boolean') return lc.enabled;
  return Array.isArray(lc.fields) && lc.fields.length > 0;
}

/**
 * Merge bot leadCapture.fields with historical capturedLeadData keys.
 * Enabled configured fields first (bot order); then inactive/disabled or deleted-only keys.
 */
export function mergeCustomerLeadFieldDefinitions(
  leadCapture: unknown,
  capturedKeysWithValues: string[],
  capturedLeadFieldMeta?: Record<string, CapturedLeadFieldMetaRow> | null,
): Array<Record<string, unknown>> {
  const cfg = normalizeLeadCaptureConfig(leadCapture as Parameters<typeof normalizeLeadCaptureConfig>[0]);
  const captureOn = leadCaptureGloballyEnabledFromRaw(leadCapture);
  const byKey = new Map(
    cfg.fields
      .map((f) => [String(f.key ?? '').trim(), f] as const)
      .filter(([key]) => Boolean(key)),
  );

  const activeKeySet = new Set<string>();
  for (const f of cfg.fields) {
    if (f.disabled) continue;
    const k = String(f.key ?? '').trim();
    if (k) activeKeySet.add(k);
  }

  const defs: Array<Record<string, unknown>> = [];
  let order = 0;

  for (const f of cfg.fields) {
    const k = String(f.key ?? '').trim();
    if (!k || f.disabled) continue;
    const row: Record<string, unknown> = {
      key: k,
      label: String(f.label ?? '').trim() || humanizeCustomerLeadFieldKey(k),
      type: f.type ?? 'text',
      required: !!f.required,
      order: order++,
      disabled: false,
      archived: !captureOn,
      fieldStatus: captureOn ? 'active' : 'inactive',
      source: 'current',
      enabled: captureOn,
    };
    if (f.placeholder) row.placeholder = f.placeholder;
    if (f.options?.length) row.options = f.options;
    if (f.aliases?.length) row.aliases = f.aliases;
    defs.push(row);
  }

  const archivedCandidates = capturedKeysWithValues.filter((k) => !activeKeySet.has(k));
  archivedCandidates.sort((a, b) => humanizeCustomerLeadFieldKey(a).localeCompare(humanizeCustomerLeadFieldKey(b)));

  for (const k of archivedCandidates) {
    const cfgRow = byKey.get(k);
    const snap = capturedLeadFieldMeta?.[k];
    const snapLabel = snap?.label != null ? String(snap.label).trim() : '';
    const snapType = snap?.type != null ? String(snap.type).trim() : '';
    if (cfgRow && cfgRow.disabled) {
      const row: Record<string, unknown> = {
        key: k,
        label: snapLabel || String(cfgRow.label ?? '').trim() || humanizeCustomerLeadFieldKey(k),
        type: snapType || cfgRow.type || 'text',
        required: !!cfgRow.required,
        order: order++,
        disabled: true,
        archived: true,
        fieldStatus: 'inactive',
        source: 'current',
        enabled: false,
      };
      if (cfgRow.placeholder) row.placeholder = cfgRow.placeholder;
      if (cfgRow.options?.length) row.options = cfgRow.options;
      defs.push(row);
      continue;
    }
    defs.push({
      key: k,
      label: snapLabel || humanizeCustomerLeadFieldKey(k),
      type: snapType || 'unknown',
      required: false,
      order: order++,
      disabled: true,
      archived: true,
      fieldStatus: 'deleted',
      source: 'captured_data',
      enabled: false,
    });
  }

  return defs;
}

/** @deprecated Prefer mergeCustomerLeadFieldDefinitions — kept for tests and callers without captured keys. */
export function customerLeadFieldDefinitionsFromBot(leadCapture: unknown): Array<Record<string, unknown>> {
  return mergeCustomerLeadFieldDefinitions(leadCapture, []);
}

/** Merge snapshot rows when new lead values are persisted (future captures). */
export function mergeCapturedLeadFieldMetaSnapshot(
  existing: Record<string, unknown> | undefined | null,
  normalizedFields: Array<{ key: string; label: string; type?: string; disabled?: boolean }>,
  appliedKeys: string[],
): Record<string, { label: string; type: string }> | undefined {
  const out: Record<string, { label: string; type: string }> = {};
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    for (const [k, v] of Object.entries(existing)) {
      const kk = String(k ?? '').trim();
      if (!kk || !v || typeof v !== 'object' || Array.isArray(v)) continue;
      const vr = v as Record<string, unknown>;
      const label = str(vr.label);
      const type = str(vr.type);
      if (label?.trim() && type?.trim()) {
        out[kk] = { label: label.trim(), type: type.trim() };
      }
    }
  }
  const byKey = new Map(normalizedFields.map((f) => [String(f.key ?? '').trim(), f] as const));
  for (const k of appliedKeys) {
    const kk = String(k ?? '').trim();
    if (!kk) continue;
    const fld = byKey.get(kk);
    if (!fld || fld.disabled) continue;
    out[kk] = {
      label: String(fld.label ?? '').trim() || humanizeCustomerLeadFieldKey(kk),
      type: String(fld.type ?? 'text'),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function conversationOriginForCustomerLeads(c: LeanConversation): Record<string, unknown> | null {
  const o = c.conversationOrigin as Record<string, unknown> | undefined;
  if (!o || typeof o !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const k of ['pageUrl', 'websiteOrigin', 'referrer'] as const) {
    const v = str(o[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function locationForCustomerLeads(c: LeanConversation): Record<string, unknown> | null {
  const loc = c.location as Record<string, unknown> | undefined;
  if (!loc || typeof loc !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const k of ['country', 'countryCode', 'region', 'city', 'timezone', 'source'] as const) {
    const v = str(loc[k]);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Leads list + detail: device summary without raw UA / userAgentHash. */
function deviceInfoForCustomerLeadsList(c: LeanConversation): Record<string, unknown> | null {
  const d = c.deviceInfo as Record<string, unknown> | undefined;
  if (!d || typeof d !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const k of ['deviceType', 'browser', 'browserVersion', 'os', 'osVersion', 'language'] as const) {
    const v = str(d[k]);
    if (v) out[k] = v;
  }
  const sw = d.screenWidth;
  const sh = d.screenHeight;
  if (typeof sw === 'number' && Number.isFinite(sw) && typeof sh === 'number' && Number.isFinite(sh)) {
    out.screenWidth = sw;
    out.screenHeight = sh;
  }
  return Object.keys(out).length ? out : null;
}

export function serializeCustomerWorkspaceLeadListRow(c: LeanConversation, botId: string): Record<string, unknown> {
  const _id = c._id as Types.ObjectId;
  const id = _id.toString();
  const capturedLeadData = extractCapturedLeadDataForWorkspace(c);
  const leadFieldKeys = Array.isArray(c.leadFieldKeys)
    ? (c.leadFieldKeys as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;
  const leadSid = c.leadSourceMessageId;
  let leadSourceMessageId: string | undefined;
  if (leadSid instanceof Types.ObjectId) leadSourceMessageId = leadSid.toString();
  else if (typeof leadSid === 'string' && Types.ObjectId.isValid(leadSid)) leadSourceMessageId = leadSid;

  const origin = conversationOriginForCustomerLeads(c);
  const loc = locationForCustomerLeads(c);
  const dev = deviceInfoForCustomerLeadsList(c);

  return {
    conversationId: id,
    botId,
    ...(capturedLeadData ? { capturedLeadData } : {}),
    ...(leadFieldKeys?.length ? { leadFieldKeys } : {}),
    leadCapturedAt: iso(c.leadCapturedAt),
    ...(leadSourceMessageId ? { leadSourceMessageId } : {}),
    hasLead: bool(c.hasLead),
    startedFrom: str(c.startedFrom) ?? null,
    sessionSource: str(c.sessionSource) ?? null,
    lastActivityAt: iso(c.lastActivityAt) ?? iso(c.createdAt),
    startedAt: iso(c.startedAt),
    totalMessages: num(c.totalMessages),
    totalCreditsUsed: num(c.totalCreditsUsed),
    conversationOrigin: origin,
    location: loc,
    deviceInfo: dev,
  };
}

/** Single lead row for customer detail — omits visitor ids and leadCaptureMeta. */
export function serializeCustomerWorkspaceLeadDetail(c: LeanConversation, botId: string): Record<string, unknown> {
  const _id = c._id as Types.ObjectId;
  const id = _id.toString();
  const capturedLeadData = extractCapturedLeadDataForWorkspace(c);
  const capturedLeadFieldMessageIds = extractCapturedLeadFieldMessageIdsForWorkspace(c);
  const leadFieldKeys = Array.isArray(c.leadFieldKeys)
    ? (c.leadFieldKeys as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;
  const leadSid = c.leadSourceMessageId;
  let leadSourceMessageId: string | undefined;
  if (leadSid instanceof Types.ObjectId) leadSourceMessageId = leadSid.toString();
  else if (typeof leadSid === 'string' && Types.ObjectId.isValid(leadSid)) leadSourceMessageId = leadSid;

  const counters = conversationCounters(c);
  const origin = conversationOriginForCustomerLeads(c);
  const loc = locationForCustomerLeads(c);
  const dev = deviceInfoForCustomerLeadsList(c);
  const capturedLeadFieldMetaOut = extractCapturedLeadFieldMetaLean(c as Record<string, unknown>);

  return {
    conversationId: id,
    botId,
    ...(capturedLeadData ? { capturedLeadData } : {}),
    ...(capturedLeadFieldMessageIds ? { capturedLeadFieldMessageIds } : {}),
    ...(leadFieldKeys?.length ? { leadFieldKeys } : {}),
    ...(capturedLeadFieldMetaOut ? { capturedLeadFieldMeta: capturedLeadFieldMetaOut } : {}),
    leadCapturedAt: iso(c.leadCapturedAt),
    ...(leadSourceMessageId ? { leadSourceMessageId } : {}),
    hasLead: bool(c.hasLead),
    startedFrom: str(c.startedFrom) ?? undefined,
    sessionSource: str(c.sessionSource) ?? undefined,
    status: str(c.status) ?? 'active',
    startedAt: iso(c.startedAt),
    lastUserMessageAt: iso(c.lastUserMessageAt),
    lastAssistantMessageAt: iso(c.lastAssistantMessageAt),
    lastMessageAt: iso(c.lastMessageAt),
    lastActivityAt: iso(c.lastActivityAt) ?? iso(c.createdAt),
    createdAt: iso(c.createdAt),
    totalUserMessages: counters.totalUserMessages,
    totalAssistantMessages: counters.totalAssistantMessages,
    totalMessages: counters.totalMessages,
    totalCreditsUsed: counters.totalCreditsUsed,
    sourcesUsedCount: counters.sourcesUsedCount,
    conversationOrigin: origin,
    location: loc,
    deviceInfo: dev,
    hasVoice: bool(c.hasVoice),
    hasDictation: bool(c.hasDictation),
    hasAttachment: bool(c.hasAttachment),
  };
}

/** Stages through filters + `_leadSortAt`, before `$sort` / pagination (shared by list + facet). */
export function buildWorkspaceLeadsPreSortStages(params: {
  botOid: Types.ObjectId;
  filters?: WorkspaceLeadsListFilters | null;
  beforeSortAtIso?: string | null;
  /**
   * Required when `filters.leadCompletion` is set — same expression as GET …/analytics/leads
   * ({@link mongoLeadCompleteExpr}).
   */
  leadCompleteExpr?: Record<string, unknown> | null;
}): Record<string, unknown>[] {
  const pre: Record<string, unknown>[] = [{ botId: params.botOid }, { hasLead: true }];
  const f = params.filters;
  const sf = f?.startedFrom?.trim();
  if (sf) {
    const keys = [...new Set(sf.split(',').map((x) => x.trim()).filter(Boolean))].filter((k) =>
      STARTED_FROM_VALUES.has(k),
    );
    if (keys.length === 1) pre.push({ startedFrom: keys[0] });
    else if (keys.length > 1) pre.push({ startedFrom: { $in: keys } });
  } else if (f?.includePreview === false) {
    pre.push({ startedFrom: { $nin: [...PREVIEW_STARTED_FROM_VALUES] } });
  }
  if (f?.countryCode) pre.push({ 'location.countryCode': f.countryCode });
  if (f?.fieldKey) pre.push({ [`capturedLeadData.${f.fieldKey}`]: { $exists: true, $nin: [null, '', undefined] } });
  const matchStage = pre.length === 1 ? pre[0] : { $and: pre };

  const pipeline: Record<string, unknown>[] = [
    { $match: matchStage },
    {
      $addFields: {
        _leadSortAt: { $ifNull: ['$leadCapturedAt', { $ifNull: ['$lastActivityAt', '$createdAt'] }] },
      },
    },
  ];

  if (f?.dateFrom) {
    const d = new Date(f.dateFrom);
    if (Number.isFinite(d.getTime())) pipeline.push({ $match: { _leadSortAt: { $gte: d } } });
  }
  if (f?.dateTo) {
    const d = new Date(f.dateTo);
    if (Number.isFinite(d.getTime())) pipeline.push({ $match: { _leadSortAt: { $lte: d } } });
  }

  if (f?.search && f.search.trim()) {
    const esc = escapeRegexForMongo(f.search.trim().slice(0, 120));
    pipeline.push({
      $match: {
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: [{ $objectToArray: '$capturedLeadData' }, []] },
                  as: 'pair',
                  cond: {
                    $and: [
                      { $eq: [{ $type: '$$pair.v' }, 'string'] },
                      {
                        $regexMatch: {
                          input: '$$pair.v',
                          regex: esc,
                          options: 'i',
                        },
                      },
                    ],
                  },
                },
              },
            },
            0,
          ],
        },
      },
    });
  }

  const lc = f?.leadCompletion;
  const completeExpr = params.leadCompleteExpr;
  if ((lc === 'complete' || lc === 'partial') && completeExpr) {
    if (lc === 'complete') {
      pipeline.push({ $match: { $expr: { $eq: [completeExpr, true] } } });
    } else {
      pipeline.push({ $match: { $expr: { $ne: [completeExpr, true] } } });
    }
  }

  if (params.beforeSortAtIso) {
    const d = new Date(params.beforeSortAtIso);
    if (Number.isFinite(d.getTime())) pipeline.push({ $match: { _leadSortAt: { $lt: d } } });
  }

  return pipeline;
}

/**
 * Single aggregation with `$facet`: paged rows, total count, complete-lead rollup (analytics parity), max capture time.
 */
export function buildWorkspaceLeadsListFacetPipeline(params: {
  botOid: Types.ObjectId;
  filters?: WorkspaceLeadsListFilters | null;
  beforeSortAtIso?: string | null;
  limit: number;
  skip: number;
  /**
   * Mongo aggregation expression (boolean) for “complete” leads — same semantics as GET …/analytics/leads
   * ({@link mongoLeadCompleteExpr}).
   */
  leadCompleteExpr: Record<string, unknown>;
}): Record<string, unknown>[] {
  const take = Math.max(1, params.limit) + 1;
  const skip = Math.max(0, params.skip);
  const pre = buildWorkspaceLeadsPreSortStages(params);
  const sortStage = { $sort: { _leadSortAt: -1, _id: -1 } as Record<string, unknown> };
  const completeMatch = {
    $match: { $expr: { $eq: [params.leadCompleteExpr, true] } },
  };

  return [
    ...pre,
    {
      $facet: {
        pageRows: [sortStage, { $skip: skip }, { $limit: take }],
        total: [{ $count: 'n' }],
        complete: [completeMatch, { $count: 'n' }],
        latest: [{ $group: { _id: null, d: { $max: '$_leadSortAt' } } }, { $project: { _id: 0, d: 1 } }],
      },
    },
  ];
}

/**
 * Aggregation pipeline: `hasLead` conversations, sort by coalesced `leadCapturedAt` / `lastActivityAt` / `createdAt`.
 * Adds `_leadSortAt` on each row until callers strip it after pagination.
 * @deprecated Prefer `buildWorkspaceLeadsListFacetPipeline` for workspace list; kept for tests.
 */
export function buildWorkspaceLeadsAggregationPipeline(params: {
  botOid: Types.ObjectId;
  filters?: WorkspaceLeadsListFilters | null;
  beforeSortAtIso?: string | null;
  limit: number;
}): Record<string, unknown>[] {
  const take = Math.max(1, params.limit) + 1;
  return [
    ...buildWorkspaceLeadsPreSortStages(params),
    { $sort: { _leadSortAt: -1, _id: -1 } },
    { $limit: take },
  ];
}
