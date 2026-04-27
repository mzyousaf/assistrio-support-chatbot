/**
 * Suggestion chips: each item has a `label` (chip text) and optional `context` (scoped facts
 * for the first reply when that chip is used — no full KB retrieval).
 * Legacy storage: `string` entries are treated as label-only.
 */

import { clampStr, BOT_FIELD_MAX } from './bot-field-limits';

export const EXAMPLE_QUESTION_CONTEXT_MAX = BOT_FIELD_MAX.exampleQuestionContext;

export type ExampleQuestionDoc = { label: string; context?: string };

const MAX_SUGGESTIONS = 5;

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
    const label = item.trim();
    return label ? { label: label.slice(0, BOT_FIELD_MAX.exampleQuestion) } : null;
  }
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    const labelRaw = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
    const label = String(labelRaw).trim().slice(0, BOT_FIELD_MAX.exampleQuestion);
    if (!label) return null;
    const ctxRaw = typeof o.context === 'string' ? o.context.trim() : '';
    if (!ctxRaw) return { label };
    return { label, context: ctxRaw.slice(0, BOT_FIELD_MAX.exampleQuestionContext) };
  }
  return null;
}

/** Public widget / preview: label strings only (do not expose scoped context in embed). */
export function exampleQuestionsToPublicLabels(raw: unknown): string[] {
  return parseExampleQuestionsFromDoc(raw)
    .map((x) => x.label)
    .filter(Boolean)
    .slice(0, 6);
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
export function normalizeExampleQuestionsForStorage(input: unknown): ExampleQuestionDoc[] {
  if (!Array.isArray(input)) return [];
  const out: ExampleQuestionDoc[] = [];
  for (const item of input) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (typeof item === 'string') {
      const label = clampStr(item.trim(), BOT_FIELD_MAX.exampleQuestion);
      if (label) out.push({ label });
      continue;
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const labelRaw = typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
      const label = clampStr(String(labelRaw).trim(), BOT_FIELD_MAX.exampleQuestion);
      if (!label) continue;
      const ctx = typeof o.context === 'string' && o.context.trim() ? clampStr(o.context.trim(), EXAMPLE_QUESTION_CONTEXT_MAX) : undefined;
      out.push({ label, ...(ctx ? { context: ctx } : {}) });
    }
  }
  return out;
}
