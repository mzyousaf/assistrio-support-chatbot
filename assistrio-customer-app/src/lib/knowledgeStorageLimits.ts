import type { CustomerKnowledgeUsage } from '@/api/types';
import { kbPlanLimitClientDescription, utf8ByteLength } from '@/lib/knowledgeContentUtf8Limits';

/** Total KB plan cap error from customer API (`errorCode`). */
export const KB_PLAN_LIMIT_BOT_KB_TOTAL_ERROR_CODE = 'plan_limit_bot_kb_total' as const;

/** Too many files in one document multipart upload (`POST .../documents`). */
export const KB_PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE = 'plan_limit_document_batch_count' as const;

/** Too many knowledge documents on the bot (`KNOWLEDGE_DOCUMENTS_MAX`). */
export const KB_PLAN_LIMIT_KNOWLEDGE_DOCUMENTS_COUNT_ERROR_CODE = 'plan_limit_knowledge_documents_count' as const;

export const KB_STORAGE_LOW_REMAINING_BYTES_THRESHOLD = 1024 * 1024;

/** % used — storage meter/badge enter “caution” styling (inclusive). */
export const KB_STORAGE_USAGE_WARN_PERCENT = 85;
/** % used — critical / near-cap styling (inclusive); used by {@link isKnowledgeStorageLow} high-percent branch. */
export const KB_STORAGE_USAGE_CRITICAL_PERCENT = 95;

/** When remaining storage is at or below this percent of the plan maximum, datasheet grid edits are blocked (view-only). */
export const KB_STORAGE_DATASHEET_VIEW_ONLY_REMAINING_PERCENT = 5;

/** Shown on datasheet detail / editor when {@link isKnowledgeStorageDatasheetViewOnly} is true. */
export const KB_STORAGE_DATASHEET_VIEW_ONLY_MESSAGE =
  'Less than 5% of your trained knowledge storage is left. This datasheet is view-only until you free space or upgrade your plan.';

export function isKnowledgeStorageDatasheetViewOnly(usage: CustomerKnowledgeUsage | null | undefined): boolean {
  if (!usage) return false;
  const max = usage.maxBytes;
  if (!Number.isFinite(max) || max <= 0) return false;
  const rem = usage.remainingBytes;
  if (typeof rem === 'number' && Number.isFinite(rem) && rem >= 0) {
    return rem / max <= KB_STORAGE_DATASHEET_VIEW_ONLY_REMAINING_PERCENT / 100;
  }
  const p = usage.percentUsed;
  if (typeof p === 'number' && Number.isFinite(p)) {
    return p >= 100 - KB_STORAGE_DATASHEET_VIEW_ONLY_REMAINING_PERCENT;
  }
  return false;
}

export function isKnowledgeStorageFull(knowledgeUsage: CustomerKnowledgeUsage | null | undefined): boolean {
  if (!knowledgeUsage) return false;
  const max = knowledgeUsage.maxBytes;
  if (!Number.isFinite(max) || max <= 0) return false;
  return knowledgeUsage.totalBytes >= max;
}

export function isKnowledgeStorageLow(knowledgeUsage: CustomerKnowledgeUsage | null | undefined): boolean {
  if (!knowledgeUsage) return false;
  const r = knowledgeUsage.remainingBytes;
  const p = knowledgeUsage.percentUsed;
  const lowRemain = typeof r === 'number' && Number.isFinite(r) && r < KB_STORAGE_LOW_REMAINING_BYTES_THRESHOLD;
  const highPct =
    typeof p === 'number' && Number.isFinite(p) && p >= KB_STORAGE_USAGE_CRITICAL_PERCENT;
  return lowRemain || highPct;
}

/** Client-side outcome before an action that adds UTF-8 bytes toward {@link CustomerKnowledgeUsage.totalBytes}. */
export type KnowledgeStorageIncreaseOutcome = 'allow' | 'limit_modal' | 'low_warn';

/**
 * When `additionalUtf8Bytes` > 0: block at/over cap, else warn if projected usage enters the “low headroom” band.
 * Non-positive deltas → `allow` (shrinks or no net growth — no storage modals from this helper).
 */
export function knowledgeStorageIncreaseOutcome(
  usage: CustomerKnowledgeUsage | null | undefined,
  additionalUtf8Bytes: number,
): KnowledgeStorageIncreaseOutcome {
  if (additionalUtf8Bytes <= 0) return 'allow';
  if (!usage || !Number.isFinite(usage.maxBytes) || usage.maxBytes <= 0) return 'allow';
  const max = usage.maxBytes;
  const total = usage.totalBytes;
  if (total >= max) return 'limit_modal';
  if (total + additionalUtf8Bytes > max) return 'limit_modal';
  const projected = total + additionalUtf8Bytes;
  const remainingAfter = max - projected;
  const pctAfter = (projected / max) * 100;
  const lowRemain =
    typeof remainingAfter === 'number' &&
    Number.isFinite(remainingAfter) &&
    remainingAfter < KB_STORAGE_LOW_REMAINING_BYTES_THRESHOLD;
  const highPct = Number.isFinite(pctAfter) && pctAfter >= KB_STORAGE_USAGE_CRITICAL_PERCENT;
  if (lowRemain || highPct) return 'low_warn';
  return 'allow';
}

/** Rough FAQ row size proxy (title + questions + answer UTF-8) for client-side storage delta. */
export function faqRowUtf8Estimate(row: { title?: string; questions?: string[]; answer?: string }): number {
  const t = String(row.title ?? '').trim();
  const qs = Array.isArray(row.questions)
    ? row.questions.map((q) => String(q ?? '').trim()).filter(Boolean)
    : [];
  const a = String(row.answer ?? '').trim();
  let s = utf8ByteLength(t) + utf8ByteLength(a);
  for (const q of qs) s += utf8ByteLength(q);
  return s;
}

/** Rough snippet row size proxy — matches list editors (default title when empty). */
export function snippetRowUtf8Estimate(row: { title?: string; snippet?: string }): number {
  const rawTitle = String(row.title ?? '').trim();
  const title = rawTitle || 'Snippet';
  const body = String(row.snippet ?? '').trim();
  return utf8ByteLength(title) + utf8ByteLength(body);
}

/**
 * Suggestion trainable bytes proxy: scoped chips only (label-only rows do not reserve KB text the same way).
 * Matches the spirit of backend suggestion KB rows with non-empty scoped text.
 */
export function suggestionScopedUtf8Estimate(label: string, context: string): number {
  const t = label.trim();
  const c = context.trim();
  if (!c) return 0;
  return utf8ByteLength(t) + utf8ByteLength(c);
}

export function documentManualUtf8Estimate(title: string, body: string): number {
  return utf8ByteLength(title.trim()) + utf8ByteLength(body);
}

export const KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE =
  'You are close to your trained knowledge storage limit. Changes that add more content may fail. Continue anyway?';

/**
 * Documents upload only: raw file size is separate from trained knowledge quota.
 * Maximum upload size is 20 MB per file — see upload UI copy.
 */
export const KNOWLEDGE_DOC_UPLOAD_FILESIZE_VS_QUOTA_MESSAGE =
  'File upload size is separate from trained knowledge storage. A large file may use much less space after text extraction. This upload may exceed your remaining trained knowledge allowance. Continue anyway?';

/** Re-export for upload field helpers. */
export {
  MAX_KB_UPLOAD_FILE_SIZE_LABEL,
  TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT,
} from '@/lib/trainedKnowledgeStorageCopy';

export type StorageLimitApiErrorInput = {
  ok?: boolean;
  errorCode?: string;
  error?: string;
  body?: unknown;
};

/** Server/user-facing line for storage plan cap, or `null` if `error` is not `plan_limit_bot_kb_total`. */
export function storageLimitMessageFromApiError(error: StorageLimitApiErrorInput): string | null {
  if (error.errorCode !== KB_PLAN_LIMIT_BOT_KB_TOTAL_ERROR_CODE) return null;
  return kbPlanLimitClientDescription(error.errorCode, error.error ?? '', error.body);
}

export function isPlanLimitBotKbTotalApiResult(res: Pick<StorageLimitApiErrorInput, 'ok' | 'errorCode'>): boolean {
  return res.ok === false && res.errorCode === KB_PLAN_LIMIT_BOT_KB_TOTAL_ERROR_CODE;
}

export function isPlanLimitDocumentBatchCountApiResult(res: Pick<StorageLimitApiErrorInput, 'ok' | 'errorCode'>): boolean {
  return res.ok === false && res.errorCode === KB_PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE;
}

export function isPlanLimitKnowledgeDocumentsCountApiResult(
  res: Pick<StorageLimitApiErrorInput, 'ok' | 'errorCode'>,
): boolean {
  return res.ok === false && res.errorCode === KB_PLAN_LIMIT_KNOWLEDGE_DOCUMENTS_COUNT_ERROR_CODE;
}

export function documentBatchCountLimitMessageFromApi(res: StorageLimitApiErrorInput): string {
  return kbPlanLimitClientDescription(
    KB_PLAN_LIMIT_DOCUMENT_BATCH_COUNT_ERROR_CODE,
    typeof res.error === 'string' ? res.error : '',
    res.body,
  );
}

export function knowledgeDocumentsCountLimitMessageFromApi(res: StorageLimitApiErrorInput): string {
  return kbPlanLimitClientDescription(
    KB_PLAN_LIMIT_KNOWLEDGE_DOCUMENTS_COUNT_ERROR_CODE,
    typeof res.error === 'string' ? res.error : '',
    res.body,
  );
}

export function isKbPlanLimitTrainingError(trainingError: string | null | undefined): boolean {
  return String(trainingError ?? '').trim() === KB_PLAN_LIMIT_BOT_KB_TOTAL_ERROR_CODE;
}

/** Document/table rows: training or extraction failed due to total KB cap. */
export function knowledgeRowIndicatesPlanLimitTotal(row: {
  trainingError?: string | null;
  extractionError?: string | null;
}): boolean {
  return isKbPlanLimitTrainingError(row.trainingError) || isKbPlanLimitTrainingError(row.extractionError);
}
