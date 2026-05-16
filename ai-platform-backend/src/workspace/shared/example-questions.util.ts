/**
 * Suggestion chips: each item has a `label` (chip text) and optional `context` (scoped facts
 * for the first reply when that chip is used — no full KB retrieval).
 * Legacy storage: `string` entries are treated as label-only.
 *
 * **KB storage accounting:** chip/label UTF-8 is capped by `suggestionTextMaxBytes` but does **not** count toward
 * bot total KB usage, `suggestionBytes`, or `suggestionTotalMaxBytes`. Only scoped fields (`context` / `description` /
 * `scopedInformation` after normalize) count toward those totals.
 */

import { DEFAULT_KB_FIELD_LIMITS } from '../../knowledge/knowledge-plan-limits';
import { clampStrUtf8Bytes } from './bot-field-limits';

const L = DEFAULT_KB_FIELD_LIMITS;

/** UTF-8 cap for suggestion `context` / optional scoped text (aligned with plan snippet/suggestion body cap). */
export const EXAMPLE_QUESTION_CONTEXT_MAX = L.suggestionDescriptionMaxBytes;

/** Max suggestion chips stored on a bot (workspace PATCH / finalize). */
export const EXAMPLE_QUESTIONS_STORAGE_MAX = 10;

export type ExampleQuestionDoc = {
  label: string;
  context?: string;
  active?: boolean;
  /** When true, the embedded widget does not show this suggestion’s chip. */
  hideChipTextInChat?: boolean;
};

const MAX_SUGGESTIONS = EXAMPLE_QUESTIONS_STORAGE_MAX;

const SCOPED_KEYS = ['context', 'description', 'scopedInformation'] as const;

function firstScopedRawForStorage(o: Record<string, unknown>): string {
  for (const k of SCOPED_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * Read bot `exampleQuestions` from DB (string | object mix) into a normalized list.
 */
export function parseExampleQuestionsFromDoc(raw: unknown): ExampleQuestionDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: ExampleQuestionDoc[] = [];
  for (const item of raw) {
    const one = parseOne(item);
    if (one) {
      out.push(one);
    }
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

function parseOne(item: unknown): ExampleQuestionDoc | null {
  if (typeof item === 'string') {
    const label = clampStrUtf8Bytes(item.trim(), L.suggestionTextMaxBytes);
    return label ? { label, active: true } : null;
  }
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const labelRaw = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
    const label = clampStrUtf8Bytes(String(labelRaw).trim(), L.suggestionTextMaxBytes);
    if (!label) return null;
    const active = o.active === false ? false : true;
    const hideChipTextInChat =
      o.hideChipTextInChat === true || (o as { hideSuggestionChipText?: unknown }).hideSuggestionChipText === true
        ? true
        : undefined;
    const rawScoped = firstScopedRawForStorage(o);
    if (!rawScoped) {
      return hideChipTextInChat ? { label, active, hideChipTextInChat: true } : { label, active };
    }
    const ctx = clampStrUtf8Bytes(rawScoped, L.suggestionDescriptionMaxBytes);
    return {
      label,
      context: ctx,
      active,
      ...(hideChipTextInChat ? { hideChipTextInChat: true } : {}),
    };
  }
  return null;
}

/** Public widget / preview: label strings only (do not expose scoped context in embed). */
export function exampleQuestionsToPublicLabels(raw: unknown): string[] {
  return parseExampleQuestionsFromDoc(raw)
    .map((x) => x.label)
    .filter(Boolean)
    .slice(0, EXAMPLE_QUESTIONS_STORAGE_MAX);
}

/** Single object body for `POST …/knowledge/suggestions` (append one chip). */
export function parseExampleQuestionSingleAppendBody(body: unknown): ExampleQuestionDoc | null {
  return parseOne(body);
}

/**
 * When the visitor's **first** user message in the thread exactly matches a suggestion `label`
 * and that entry has `context`, return it so the chat engine can skip full RAG for this turn.
 */
export function findMatchingSuggestionContext(
  questions: ExampleQuestionDoc[],
  userMessageTrimmed: string,
  userMessageCount: number,
): string | null {
  if (userMessageCount !== 1) return null;
  const msg = userMessageTrimmed.trim();
  if (!msg) return null;
  const found = questions.find((q) => q.label.trim() === msg);
  const c = found?.context?.trim();
  return c ? c : null;
}

/**
 * Used when normalizing API PATCH input for persistence.
 */
/** Persist normalized docs to Mongo `exampleQuestions` (object rows; label-only omits `context`). */
export function exampleQuestionDocsToMongoArray(docs: ExampleQuestionDoc[]): unknown[] {
  return docs.map((q) => {
    const ctx = (q.context ?? '').trim();
    const active = q.active === false ? { active: false } : {};
    const hide = q.hideChipTextInChat === true ? { hideChipTextInChat: true } : {};
    return ctx ? { label: q.label, context: ctx, ...active, ...hide } : { label: q.label, ...active, ...hide };
  });
}

export function normalizeExampleQuestionsForStorage(input: unknown): ExampleQuestionDoc[] {
  if (!Array.isArray(input)) return [];
  const out: ExampleQuestionDoc[] = [];
  for (const item of input) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (typeof item === 'string') {
      const label = clampStrUtf8Bytes(item.trim(), L.suggestionTextMaxBytes);
      if (label) out.push({ label, active: true });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const labelRaw = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
      const label = clampStrUtf8Bytes(String(labelRaw).trim(), L.suggestionTextMaxBytes);
      if (!label) continue;
      const active = o.active === false ? false : true;
      const hideChipTextInChat =
        o.hideChipTextInChat === true || (o as { hideSuggestionChipText?: unknown }).hideSuggestionChipText === true
          ? true
          : undefined;
      const rawScoped = firstScopedRawForStorage(o);
      const ctx =
        rawScoped.length > 0
          ? clampStrUtf8Bytes(rawScoped, L.suggestionDescriptionMaxBytes)
          : undefined;
      out.push({
        label,
        ...(ctx ? { context: ctx } : {}),
        active,
        ...(hideChipTextInChat ? { hideChipTextInChat: true } : {}),
      });
    }
  }
  return out;
}
