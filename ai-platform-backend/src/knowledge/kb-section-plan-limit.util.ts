import { HttpException, HttpStatus } from '@nestjs/common';
import { getUtf8ByteCount } from './knowledge-byte-size.util';
import { DEFAULT_KB_FIELD_LIMITS } from './knowledge-plan-limits';
import {
  KNOWLEDGE_QA_MAX,
  KNOWLEDGE_QA_QUESTIONS_MAX,
  KNOWLEDGE_SNIPPETS_MAX,
} from '../workspace/shared/bot-field-limits';
import { EXAMPLE_QUESTIONS_STORAGE_MAX } from '../workspace/shared/example-questions.util';

type LimitThrow = {
  errorCode: string;
  message: string;
  maxBytes: number;
  actualBytes: number;
  itemIndex: number;
};

function throwLimit(p: LimitThrow): never {
  throw new HttpException(
    {
      error: p.message,
      message: p.message,
      errorCode: p.errorCode,
      maxBytes: p.maxBytes,
      actualBytes: p.actualBytes,
      itemIndex: p.itemIndex,
    },
    HttpStatus.BAD_REQUEST,
  );
}

/**
 * Validates raw FAQ payload (before clamp/normalize). Skips entries that {@link normalizeFaqs} would drop.
 */
export function assertFaqsWithinPlanLimits(input: unknown): void {
  const L = DEFAULT_KB_FIELD_LIMITS;
  const parsed =
    typeof input === 'string'
      ? (() => {
          try {
            return JSON.parse(input) as unknown;
          } catch {
            return [];
          }
        })()
      : input;
  if (!Array.isArray(parsed)) return;

  let sectionTotal = 0;
  let included = 0;

  for (const item of parsed) {
    if (included >= KNOWLEDGE_QA_MAX) break;
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const title = String(o.title ?? '').trim();
    const answer = String(o.answer ?? '').trim();
    const legacyQ = String(o.question ?? '').trim();
    let questions: string[] = [];
    if (Array.isArray(o.questions)) {
      questions = o.questions.map((q) => String(q ?? '').trim()).filter(Boolean);
    }
    if (legacyQ) questions = [legacyQ, ...questions.filter((q) => q !== legacyQ)];
    questions = [...new Set(questions)].slice(0, KNOWLEDGE_QA_QUESTIONS_MAX);

    if (!answer) continue;
    if (questions.length === 0 && !title) continue;
    if (questions.length === 0) questions = [title || 'Question'];

    const idx = included;
    included++;

    const titleB = getUtf8ByteCount(title);
    if (titleB > L.faqTitleMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_faq_title_size',
        message: `FAQ title exceeds the maximum size (${L.faqTitleMaxBytes} UTF-8 bytes).`,
        maxBytes: L.faqTitleMaxBytes,
        actualBytes: titleB,
      });
    }

    const questionsUtf8Total = questions.reduce((sum, q) => sum + getUtf8ByteCount(q), 0);
    if (questionsUtf8Total > L.faqQuestionMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_faq_question_size',
        message: `FAQ questions combined exceed the maximum size (${L.faqQuestionMaxBytes} UTF-8 bytes total).`,
        maxBytes: L.faqQuestionMaxBytes,
        actualBytes: questionsUtf8Total,
      });
    }

    const answerB = getUtf8ByteCount(answer);
    if (answerB > L.faqAnswerMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_faq_answer_size',
        message: `FAQ answer exceeds the maximum size (${L.faqAnswerMaxBytes} UTF-8 bytes).`,
        maxBytes: L.faqAnswerMaxBytes,
        actualBytes: answerB,
      });
    }

    const itemTotal =
      titleB + answerB + questions.reduce((sum, q) => sum + getUtf8ByteCount(q), 0);
    sectionTotal += itemTotal;
    if (sectionTotal > L.faqTotalMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_faq_total_size',
        message: `Combined FAQ knowledge exceeds the maximum total size (${L.faqTotalMaxBytes} UTF-8 bytes).`,
        maxBytes: L.faqTotalMaxBytes,
        actualBytes: sectionTotal,
      });
    }
  }
}

/**
 * Validates raw snippet / note list (before clamp). Skips rows without body text that normalize would drop.
 */
export function assertSnippetsWithinPlanLimits(input: unknown): void {
  const L = DEFAULT_KB_FIELD_LIMITS;
  const parsed =
    typeof input === 'string'
      ? (() => {
          try {
            return JSON.parse(input) as unknown;
          } catch {
            return [];
          }
        })()
      : input;
  if (!Array.isArray(parsed)) return;

  let sectionTotal = 0;
  let included = 0;

  for (const item of parsed) {
    if (included >= KNOWLEDGE_SNIPPETS_MAX) break;
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const titleRaw = String(o.title ?? o.label ?? '').trim();
    const snippet = String(o.snippet ?? o.description ?? '').trim();
    if (!snippet) continue;

    const idx = included;
    included++;

    const effectiveTitle = titleRaw || 'Snippet';
    const titleB = getUtf8ByteCount(effectiveTitle);
    if (titleB > L.snippetTitleMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_snippet_title_size',
        message: `Snippet title exceeds the maximum size (${L.snippetTitleMaxBytes} UTF-8 bytes).`,
        maxBytes: L.snippetTitleMaxBytes,
        actualBytes: titleB,
      });
    }

    const snippetB = getUtf8ByteCount(snippet);
    if (snippetB > L.snippetDescriptionMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_snippet_description_size',
        message: `Snippet body exceeds the maximum size (${L.snippetDescriptionMaxBytes} UTF-8 bytes).`,
        maxBytes: L.snippetDescriptionMaxBytes,
        actualBytes: snippetB,
      });
    }

    const itemTotal = titleB + snippetB;
    sectionTotal += itemTotal;
    if (sectionTotal > L.snippetTotalMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_snippet_total_size',
        message: `Combined snippet knowledge exceeds the maximum total size (${L.snippetTotalMaxBytes} UTF-8 bytes).`,
        maxBytes: L.snippetTotalMaxBytes,
        actualBytes: sectionTotal,
      });
    }
  }
}

/**
 * Validates example questions / suggestion chips (label + optional scoped context).
 * Per-field: chip text ≤ {@link DEFAULT_KB_FIELD_LIMITS.suggestionTextMaxBytes};
 * each scoped field ≤ {@link DEFAULT_KB_FIELD_LIMITS.suggestionDescriptionMaxBytes}.
 * **Section total** (`suggestionTotalMaxBytes`) counts **scoped information UTF-8 bytes only** (first non-empty among
 * `context` / `description` / `scopedInformation`, matching normalized storage). Chip text does not count.
 */
export function assertSuggestionsWithinPlanLimits(input: unknown): void {
  const L = DEFAULT_KB_FIELD_LIMITS;
  if (!Array.isArray(input)) return;

  let sectionTotal = 0;
  let included = 0;

  for (const item of input) {
    if (included >= EXAMPLE_QUESTIONS_STORAGE_MAX) break;

    if (typeof item === 'string') {
      const label = item.trim();
      if (!label) continue;
      const idx = included;
      included++;
      const labelB = getUtf8ByteCount(label);
      if (labelB > L.suggestionTextMaxBytes) {
        throwLimit({
          itemIndex: idx,
          errorCode: 'plan_limit_suggestion_text_size',
          message: `Suggestion text exceeds the maximum size (${L.suggestionTextMaxBytes} UTF-8 bytes).`,
          maxBytes: L.suggestionTextMaxBytes,
          actualBytes: labelB,
        });
      }
      /* Label-only: still enforce chip max size; does not consume suggestion section byte cap. */
      continue;
    }

    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const labelRaw =
      typeof o.label === 'string' ? o.label : typeof o.text === 'string' ? o.text : '';
    const label = String(labelRaw).trim();
    if (!label) continue;

    const idx = included;
    included++;

    const labelB = getUtf8ByteCount(label);
    if (labelB > L.suggestionTextMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_suggestion_text_size',
        message: `Suggestion text exceeds the maximum size (${L.suggestionTextMaxBytes} UTF-8 bytes).`,
        maxBytes: L.suggestionTextMaxBytes,
        actualBytes: labelB,
      });
    }

    const scopedKeys = ['context', 'description', 'scopedInformation'] as const;
    let itemScopedBytes = 0;
    let tookScoped = false;
    for (const key of scopedKeys) {
      const raw = o[key];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const trimmed = raw.trim();
      const b = getUtf8ByteCount(trimmed);
      if (b > L.suggestionDescriptionMaxBytes) {
        throwLimit({
          itemIndex: idx,
          errorCode: 'plan_limit_suggestion_description_size',
          message: `Suggestion scoped content exceeds the maximum size (${L.suggestionDescriptionMaxBytes} UTF-8 bytes).`,
          maxBytes: L.suggestionDescriptionMaxBytes,
          actualBytes: b,
        });
      }
      if (!tookScoped) {
        itemScopedBytes = b;
        tookScoped = true;
      }
    }

    sectionTotal += itemScopedBytes;
    if (sectionTotal > L.suggestionTotalMaxBytes) {
      throwLimit({
        itemIndex: idx,
        errorCode: 'plan_limit_suggestion_total_size',
        message: `Combined suggestions exceed the maximum total size (${L.suggestionTotalMaxBytes} UTF-8 bytes).`,
        maxBytes: L.suggestionTotalMaxBytes,
        actualBytes: sectionTotal,
      });
    }
  }
}
