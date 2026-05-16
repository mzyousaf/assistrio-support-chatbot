import { buildFaqEmbeddingText, buildNoteEmbeddingText, buildQaEmbeddingText } from './faq-note-embedding.helper';
import { getUtf8ByteCount } from './knowledge-byte-size.util';
import {
  knowledgeBaseItemIsEffectivelyDeleted,
  knowledgeItemNotDeletedClause,
} from './knowledge-base-item-access.service';
import { effectiveKbDocumentFileMetaLean } from './knowledge-base-document-sync-fields.util';
import type { KnowledgeBaseItemSourceType } from '../models/knowledge-base-item.schema';
import type { BotKnowledgeSizeStored } from './knowledge-plan-limits';
import { DEFAULT_BOT_KNOWLEDGE_SIZE, DEFAULT_KB_FIELD_LIMITS } from './knowledge-plan-limits';
import { resolveBotKnowledgeSizeConfig, type ResolvedBotKnowledgeSize } from './resolve-bot-knowledge-size.util';

/** Lean fields used by {@link calculateKnowledgeUsageFromItems} (extend as needed at call sites). */
export type KnowledgeBaseItemUsageLean = {
  sourceType: KnowledgeBaseItemSourceType | string;
  active?: boolean;
  deletedAt?: Date | null;
  title?: string;
  content?: string;
  rawContent?: string;
  characterCount?: number;
  isContentExtracted?: boolean;
  extractionStatus?: string | null;
  fileMeta?: Record<string, unknown>;
  file?: Record<string, unknown>;
  faqMeta?: { title?: string; questions?: string[]; answer?: string };
  tableMeta?: {
    importPhase?: string | null;
    importFileSize?: number;
    importError?: string | null;
    importErrorCode?: string | null;
  };
  suggestionMeta?: { chipText?: string; scopedInformation?: string };
  trainingError?: string | null;
  extractionError?: string | null;
};

export type KnowledgeUsageBreakdown = {
  /** All billable stored UTF-8 bytes (includes `out_of_storage` / plan-limit rows). */
  totalBytes: number;
  /** Billable bytes that may be trained (excludes `out_of_storage` rows). */
  trainableBytes: number;
  maxBytes?: number;
  remainingBytes?: number;
  percentUsed?: number;

  documentBytes: number;
  faqBytes: number;
  noteBytes: number;
  tableBytes: number;
  suggestionBytes: number;
  otherBytes: number;

  itemCount: number;
  documentCount: number;
  faqCount: number;
  noteCount: number;
  tableCount: number;
  suggestionCount: number;

  /** Sum of `tableMeta.importFileSize` for counted table rows (informational; not included in `totalBytes`). */
  tableImportFileSizeBytesSum?: number;
};

/** Same value as {@link PLAN_LIMIT_BOT_KB_TOTAL_CODE} in `bot-knowledge-total-limit.service` (avoid circular imports). */
export const PLAN_LIMIT_BOT_KB_TOTAL_TRAINING_ERROR = 'plan_limit_bot_kb_total' as const;

export const KNOWLEDGE_USAGE_LEAN_FIELDS =
  'sourceType content rawContent characterCount title active deletedAt file fileMeta faqMeta tableMeta suggestionMeta isContentExtracted extractionStatus status trainingError extractionError' as const;

/** Re-export Mongo fragment for live, non-deleted KB rows (`active !== false`, no `deletedAt`). */
export { knowledgeItemNotDeletedClause };

export function emptyKnowledgeUsageBreakdown(): KnowledgeUsageBreakdown {
  return {
    totalBytes: 0,
    trainableBytes: 0,
    documentBytes: 0,
    faqBytes: 0,
    noteBytes: 0,
    tableBytes: 0,
    suggestionBytes: 0,
    otherBytes: 0,
    itemCount: 0,
    documentCount: 0,
    faqCount: 0,
    noteCount: 0,
    tableCount: 0,
    suggestionCount: 0,
  };
}

export function documentKnowledgeItemIsMultipartPreviewPending(row: Record<string, unknown>): boolean {
  const fm = effectiveKbDocumentFileMetaLean(row);
  const sid = String(fm.uploadSessionId ?? '').trim();
  const bucket = String(fm.storageBucket ?? '').trim();
  const key = String(fm.storageKey ?? '').trim();
  return Boolean(sid && (!bucket || !key));
}

export function documentKnowledgeItemHasCountableExtractedContent(row: {
  content?: string;
  characterCount?: number;
}): boolean {
  if (String(row.content ?? '').trim().length > 0) return true;
  const cc = row.characterCount;
  return typeof cc === 'number' && Number.isFinite(cc) && cc > 0;
}

export function tableKnowledgeItemImportInFlight(tableMeta?: { importPhase?: string | null }): boolean {
  const p = tableMeta?.importPhase;
  return p === 'import_queued' || p === 'importing';
}

export function tableKnowledgeItemImportFailedWithoutGrid(row: {
  tableMeta?: { importPhase?: string | null };
  content?: string;
  rawContent?: string;
}): boolean {
  if (row.tableMeta?.importPhase !== 'import_failed') return false;
  return !String(row.content ?? '').trim() && !String(row.rawContent ?? '').trim();
}

export function suggestionKnowledgeItemHasTrainableScope(row: {
  content?: string;
  suggestionMeta?: { scopedInformation?: string };
}): boolean {
  if (String(row.suggestionMeta?.scopedInformation ?? '').trim().length > 0) return true;
  return String(row.content ?? '').trim().length > 0;
}

/**
 * `out_of_storage` row: stored content counts toward {@link knowledgeBaseItemEligibleForKbUsageAggregation}
 * but is excluded from trainable totals / training until reconciled.
 */
export function knowledgeBaseItemIsOutOfStoragePlanLimit(row: KnowledgeBaseItemUsageLean): boolean {
  const c = PLAN_LIMIT_BOT_KB_TOTAL_TRAINING_ERROR;
  if (String(row.trainingError ?? '').trim() === c) return true;
  if (String(row.extractionError ?? '').trim() === c) return true;
  const tm = row.tableMeta;
  if (tm && typeof tm === 'object') {
    if (String(tm.importErrorCode ?? '').trim() === c) return true;
    if (String(tm.importError ?? '').trim() === c) return true;
  }
  return false;
}

/**
 * Whether this row should participate in bot-level **stored** KB byte totals (not soft-deleted by `deletedAt`;
 * reply-excluded `active: false` still counts), not multipart preview, no in-flight table import without grid, etc.
 * Includes `out_of_storage` rows.
 */
export function knowledgeBaseItemEligibleForKbUsageAggregation(row: KnowledgeBaseItemUsageLean): boolean {
  if (knowledgeBaseItemIsEffectivelyDeleted(row)) return false;
  const st = String(row.sourceType ?? '');

  if (st === 'document') {
    if (documentKnowledgeItemIsMultipartPreviewPending(row as Record<string, unknown>)) return false;
    if (!documentKnowledgeItemHasCountableExtractedContent(row)) return false;
    return true;
  }

  if (st === 'table') {
    if (tableKnowledgeItemImportInFlight(row.tableMeta)) return false;
    if (tableKnowledgeItemImportFailedWithoutGrid(row)) return false;
    return true;
  }

  if (st === 'suggestion') {
    return suggestionKnowledgeItemHasTrainableScope(row);
  }

  return true;
}

/** Stored-eligible rows whose bytes count toward the trainable (under-cap training) budget. */
export function knowledgeBaseItemEligibleForTrainableKbAggregation(row: KnowledgeBaseItemUsageLean): boolean {
  if (!knowledgeBaseItemEligibleForKbUsageAggregation(row)) return false;
  if (knowledgeBaseItemIsOutOfStoragePlanLimit(row)) return false;
  return true;
}

export function calculateDocumentKnowledgeUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  const text = String(item.content ?? '');
  if (text.length > 0) return getUtf8ByteCount(text);
  const cc = item.characterCount;
  if (typeof cc === 'number' && Number.isFinite(cc) && cc > 0) return cc;
  return 0;
}

export function calculateFaqKnowledgeUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  const fm = item.faqMeta;
  if (fm && typeof fm === 'object') {
    const groupTitle = String(fm.title ?? '').trim();
    const rawQs = Array.isArray(fm.questions) ? fm.questions : [];
    const questions = rawQs.map((q) => String(q ?? '').trim()).filter(Boolean);
    const answer = String(fm.answer ?? '').trim();
    const primaryQ = questions[0] ?? '';
    const line =
      questions.length > 0 || groupTitle
        ? buildQaEmbeddingText(groupTitle, questions, answer)
        : buildFaqEmbeddingText(primaryQ, answer);
    return getUtf8ByteCount(line);
  }
  return getUtf8ByteCount(String(item.content ?? ''));
}

export function calculateNoteKnowledgeUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  const raw = item.rawContent;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const p = JSON.parse(raw) as { title?: string; snippet?: string };
      const title = String(p.title ?? item.title ?? '').trim() || 'Snippet';
      const body = String(p.snippet ?? '').trim();
      return getUtf8ByteCount(buildNoteEmbeddingText(title, body));
    } catch {
      /* fall through */
    }
  }
  return getUtf8ByteCount(buildNoteEmbeddingText(item.title, String(item.content ?? '')));
}

export function calculateTableKnowledgeUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  return getUtf8ByteCount(String(item.content ?? '')) + getUtf8ByteCount(String(item.rawContent ?? ''));
}

/**
 * Billable KB bytes for suggestions: **scoped information only** (UTF-8).
 * Chip / label text is UI-only and does not count toward bot total or suggestion section totals.
 * `content` stores the embedding line (chip + scoped) and must not be used for metering.
 */
export function calculateSuggestionKnowledgeUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  const scoped = String(item.suggestionMeta?.scopedInformation ?? '').trim();
  if (scoped.length > 0) {
    return getUtf8ByteCount(scoped);
  }
  const raw = item.rawContent;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw) as { context?: string; description?: string; scopedInformation?: string };
      const ctx = String(p.context ?? p.description ?? p.scopedInformation ?? '').trim();
      if (ctx.length > 0) return getUtf8ByteCount(ctx);
    } catch {
      /* ignore */
    }
  }
  return 0;
}

export function calculateOtherKnowledgeUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  return getUtf8ByteCount(String(item.content ?? '')) + getUtf8ByteCount(String(item.rawContent ?? ''));
}

/** Byte contribution for one row; callers should gate with {@link knowledgeBaseItemEligibleForKbUsageAggregation}. */
export function calculateKnowledgeItemUsageBytes(item: KnowledgeBaseItemUsageLean): number {
  const st = String(item.sourceType ?? '');
  switch (st) {
    case 'document':
      return calculateDocumentKnowledgeUsageBytes(item);
    case 'faq':
      return calculateFaqKnowledgeUsageBytes(item);
    case 'note':
      return calculateNoteKnowledgeUsageBytes(item);
    case 'table':
      return calculateTableKnowledgeUsageBytes(item);
    case 'suggestion':
      return calculateSuggestionKnowledgeUsageBytes(item);
    default:
      return calculateOtherKnowledgeUsageBytes(item);
  }
}

export function calculateKnowledgeUsageFromItems(items: KnowledgeBaseItemUsageLean[]): KnowledgeUsageBreakdown {
  const out = emptyKnowledgeUsageBreakdown();
  let tableImportSum = 0;
  for (const item of items) {
    if (!knowledgeBaseItemEligibleForKbUsageAggregation(item)) continue;
    const bytes = calculateKnowledgeItemUsageBytes(item);
    if (bytes <= 0) continue;
    const st = String(item.sourceType ?? '');
    out.totalBytes += bytes;
    if (knowledgeBaseItemEligibleForTrainableKbAggregation(item)) {
      out.trainableBytes += bytes;
    }
    out.itemCount += 1;
    if (st === 'document') {
      out.documentBytes += bytes;
      out.documentCount += 1;
    } else if (st === 'faq') {
      out.faqBytes += bytes;
      out.faqCount += 1;
    } else if (st === 'note') {
      out.noteBytes += bytes;
      out.noteCount += 1;
    } else if (st === 'table') {
      out.tableBytes += bytes;
      out.tableCount += 1;
      const iz = item.tableMeta?.importFileSize;
      if (typeof iz === 'number' && Number.isFinite(iz) && iz > 0) tableImportSum += iz;
    } else if (st === 'suggestion') {
      out.suggestionBytes += bytes;
      out.suggestionCount += 1;
    } else {
      out.otherBytes += bytes;
    }
  }
  if (tableImportSum > 0) out.tableImportFileSizeBytesSum = tableImportSum;
  return out;
}

export type BotForKnowledgeUsageLimit = {
  botConfig?: { knowledgeSize?: Partial<BotKnowledgeSizeStored> | null } | null;
} | null;

export function buildKnowledgeUsageWithLimit(
  usage: KnowledgeUsageBreakdown,
  bot?: BotForKnowledgeUsageLimit,
): KnowledgeUsageBreakdown {
  if (bot == null) {
    return {
      ...usage,
      maxBytes: undefined,
      remainingBytes: undefined,
      percentUsed: undefined,
    };
  }
  const resolved: ResolvedBotKnowledgeSize = resolveBotKnowledgeSizeConfig(bot);
  const maxBytes = resolved.maxBytes;
  if (typeof maxBytes !== 'number' || !Number.isFinite(maxBytes) || maxBytes <= 0) {
    return {
      ...usage,
      maxBytes: undefined,
      remainingBytes: undefined,
      percentUsed: undefined,
    };
  }
  const totalBytes = usage.totalBytes;
  const remainingBytes = maxBytes - totalBytes;
  const percentUsed = (totalBytes / maxBytes) * 100;
  return {
    ...usage,
    maxBytes,
    remainingBytes,
    percentUsed,
  };
}

/** Customer/admin API shape for bot knowledge byte usage (UTF-8 totals + plan caps). */
export type KnowledgeUsageSectionLimitsApi = {
  faqTotalMaxBytes: number;
  snippetTotalMaxBytes: number;
  suggestionTotalMaxBytes: number;
};

export type KnowledgeUsageApiPayload = {
  totalBytes: number;
  trainableBytes: number;
  maxBytes: number;
  remainingBytes: number;
  percentUsed: number;
  documentBytes: number;
  faqBytes: number;
  noteBytes: number;
  tableBytes: number;
  suggestionBytes: number;
  sectionLimits: KnowledgeUsageSectionLimitsApi;
};

export function knowledgeUsageBreakdownToApiPayload(usage: KnowledgeUsageBreakdown): KnowledgeUsageApiPayload {
  const maxBytes =
    typeof usage.maxBytes === 'number' && Number.isFinite(usage.maxBytes) && usage.maxBytes > 0
      ? usage.maxBytes
      : DEFAULT_BOT_KNOWLEDGE_SIZE.maxBytes;
  const totalBytes = usage.totalBytes;
  const trainableBytes = usage.trainableBytes;
  const remainingBytes =
    typeof usage.remainingBytes === 'number' && Number.isFinite(usage.remainingBytes)
      ? usage.remainingBytes
      : maxBytes - totalBytes;
  const percentRaw =
    typeof usage.percentUsed === 'number' && Number.isFinite(usage.percentUsed)
      ? usage.percentUsed
      : maxBytes > 0
        ? (totalBytes / maxBytes) * 100
        : 0;
  const percentUsed = Math.round(percentRaw * 100) / 100;
  return {
    totalBytes,
    trainableBytes,
    maxBytes,
    remainingBytes,
    percentUsed,
    documentBytes: usage.documentBytes,
    faqBytes: usage.faqBytes,
    noteBytes: usage.noteBytes,
    tableBytes: usage.tableBytes,
    suggestionBytes: usage.suggestionBytes,
    sectionLimits: {
      faqTotalMaxBytes: DEFAULT_KB_FIELD_LIMITS.faqTotalMaxBytes,
      snippetTotalMaxBytes: DEFAULT_KB_FIELD_LIMITS.snippetTotalMaxBytes,
      suggestionTotalMaxBytes: DEFAULT_KB_FIELD_LIMITS.suggestionTotalMaxBytes,
    },
  };
}
