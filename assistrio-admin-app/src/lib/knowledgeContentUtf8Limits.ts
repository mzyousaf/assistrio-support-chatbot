/**
 * Knowledge text limits (UTF-8 bytes). Keep aligned with
 * `ai-platform-backend/src/workspace/shared/bot-field-limits.ts` and `bot-payload` normalization
 * and `ai-platform-backend/src/knowledge/knowledge-plan-limits.ts` → `DEFAULT_KB_FIELD_LIMITS`.
 */
import { KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX, KNOWLEDGE_DOCUMENTS_MAX } from '@/lib/botFieldLimits';

export const KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES = 200;
/** Workspace document titles (PATCH title). Matches backend `workspace-bot-documents.controller.base`. */
export const KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS = 1;
/** Snippet bodies, Q&A answers, document manual edit (body field), etc. */
export const KNOWLEDGE_ITEM_BODY_MAX_UTF8_BYTES = 1024 * 1024;

/** FAQ / snippet / suggestion section caps (plan defaults, Step 4). */
export const KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES = 200;
/** Combined UTF-8 budget for all question lines on one Q&A row (shared pool). */
export const KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES = 1000;
export const KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES = 1 * 1024 * 1024;
export const KB_PLAN_SNIPPET_TITLE_MAX_UTF8_BYTES = 200;
export const KB_PLAN_SNIPPET_BODY_MAX_UTF8_BYTES = 1 * 1024 * 1024;
/** Suggestion chip label / text (UTF-8 bytes). */
export const KB_PLAN_SUGGESTION_TEXT_MAX_UTF8_BYTES = 500;
/** Optional scoped context / description on a suggestion (UTF-8 bytes). */
export const KB_PLAN_SUGGESTION_DESCRIPTION_MAX_UTF8_BYTES = 1 * 1024 * 1024;

const KB_PLAN_LIMIT_HINTS: Record<string, string> = {
  plan_limit_faq_title_size: 'Shorten the FAQ title and try again.',
  plan_limit_faq_question_size:
    'Shorten your question lines — combined they must stay within the limit for this Q&A entry.',
  plan_limit_faq_answer_size: 'Shorten the answer and try again.',
  plan_limit_faq_total_size: 'This bot’s Q&A section is too large in total. Remove or shorten entries.',
  plan_limit_snippet_title_size: 'Shorten the note title and try again.',
  plan_limit_snippet_description_size: 'Shorten the note body and try again.',
  plan_limit_snippet_total_size: 'This bot’s notes section is too large in total. Remove or shorten entries.',
  plan_limit_suggestion_text_size: 'Shorten the suggestion label and try again.',
  plan_limit_suggestion_description_size: 'Shorten the optional scoped text and try again.',
  plan_limit_suggestion_total_size: 'This bot’s suggestions use too much space in total. Remove or shorten entries.',
  plan_limit_bot_kb_total:
    'This bot has reached its knowledge limit. Delete some knowledge or free up space in Knowledge overview.',
  plan_limit_document_batch_count: `You can upload up to ${KNOWLEDGE_DOCUMENT_UPLOAD_BATCH_MAX} files at a time.`,
  plan_limit_knowledge_documents_count: `Each bot can have at most ${KNOWLEDGE_DOCUMENTS_MAX} documents. Remove one to add another.`,
};

function formatPlanLimitKbUsageLine(errorBody: unknown): string | null {
  if (!errorBody || typeof errorBody !== 'object') return null;
  const b = errorBody as Record<string, unknown>;
  if (b.errorCode !== 'plan_limit_bot_kb_total') return null;
  const cur = b.currentBytes;
  const max = b.maxBytes;
  if (typeof cur !== 'number' || typeof max !== 'number' || !Number.isFinite(cur) || !Number.isFinite(max)) {
    return null;
  }
  const curMb = (cur / (1024 * 1024)).toFixed(2);
  const maxMb = (max / (1024 * 1024)).toFixed(2);
  return `Usage: ${curMb} MB / ${maxMb} MB`;
}

/**
 * Prefer a friendly line for known KB plan-limit `errorCode`s; otherwise use the server message.
 * For `plan_limit_bot_kb_total`, appends usage from the error JSON body when present.
 */
export function kbPlanLimitClientDescription(
  errorCode: string | undefined,
  serverMessage: string,
  errorBody?: unknown,
): string {
  const code = errorCode?.trim();
  if (!code) return serverMessage;

  if (code === 'plan_limit_bot_kb_total') {
    const hint = KB_PLAN_LIMIT_HINTS[code] ?? '';
    const msg = serverMessage.trim() || hint;
    const usage = formatPlanLimitKbUsageLine(errorBody);
    if (usage) return `${msg} ${usage}`;
    return msg;
  }

  if (code === 'plan_limit_document_batch_count') {
    return serverMessage.trim() || (KB_PLAN_LIMIT_HINTS[code] ?? '');
  }

  if (code === 'plan_limit_knowledge_documents_count') {
    return serverMessage.trim() || (KB_PLAN_LIMIT_HINTS[code] ?? '');
  }

  const hint = KB_PLAN_LIMIT_HINTS[code];
  if (!hint) return serverMessage;
  return serverMessage.trim() ? `${serverMessage} ${hint}` : hint;
}

/** Documents → Edit (pasted/manual body). Matches upload cap intent. */
export const KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES = 20 * 1024 * 1024;

/** Datasheet title + headers + cells (total stored UTF-8). Matches import upload cap intent. */
export const KNOWLEDGE_DATASHEET_GRID_TOTAL_MAX_UTF8_BYTES = 20 * 1024 * 1024;

/** Legacy alias: combined FAQ question UTF-8 pool size per Q&A row (not per line). */
export const KNOWLEDGE_QA_QUESTION_MAX_UTF8_BYTES = KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES;

const encoder = new TextEncoder();

export function utf8ByteLength(s: string): number {
  return encoder.encode(s).length;
}

/** Longest prefix of `s` whose UTF-8 encoding fits in `maxBytes`. */
export function clampStrUtf8Bytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  if (utf8ByteLength(s) <= maxBytes) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (encoder.encode(s.slice(0, mid)).length <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo);
}

/** UTF-8 length for all FAQ question strings on one row (shared meter budget). */
export function faqQuestionsCombinedUtf8Bytes(questions: readonly string[]): number {
  let n = 0;
  for (const q of questions) n += utf8ByteLength(q ?? '');
  return n;
}

/**
 * After replacing question line `index` with `newLine`, clamps that line so the combined UTF-8
 * total stays ≤ maxTotalBytes (other lines unchanged).
 */
export function clampFaqQuestionLineInCombinedBudget(
  questions: readonly string[],
  index: number,
  newLine: string,
  maxTotalBytes: number,
): string[] {
  const out = questions.map((q, i) => (i === index ? newLine : q));
  const othersBytes = out.reduce((s, q, j) => (j === index ? s : s + utf8ByteLength(q)), 0);
  const budget = Math.max(0, maxTotalBytes - othersBytes);
  return out.map((q, j) => (j === index ? clampStrUtf8Bytes(q, budget) : q));
}

/** Fits all lines into one combined UTF-8 cap by shortening longest lines first (normalize / hydrate). */
export function clampFaqQuestionsToCombinedUtf8Budget(questions: readonly string[], maxTotalBytes: number): string[] {
  if (maxTotalBytes <= 0) return [...questions].map(() => '');
  const qs = [...questions];
  while (true) {
    let total = 0;
    for (const q of qs) total += utf8ByteLength(q);
    if (total <= maxTotalBytes) return qs;
    let maxIdx = -1;
    let maxB = -1;
    for (let i = 0; i < qs.length; i++) {
      const b = utf8ByteLength(qs[i]!);
      if (b > maxB) {
        maxB = b;
        maxIdx = i;
      }
    }
    if (maxIdx < 0 || maxB <= 0) return qs;
    qs[maxIdx] = clampStrUtf8Bytes(qs[maxIdx]!, maxB - 1);
  }
}
