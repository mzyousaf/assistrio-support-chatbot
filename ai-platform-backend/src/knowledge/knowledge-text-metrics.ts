import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  buildQaEmbeddingText,
  buildTableEmbeddingText,
} from './faq-note-embedding.helper';

/** Character count of trimmed string (leading/trailing whitespace removed). */
export function countCharactersTrimmed(s: string): number {
  return s.trim().length;
}

export interface TextMetrics {
  characterCount: number;
}

export function textMetrics(s: string): TextMetrics {
  return {
    characterCount: countCharactersTrimmed(s),
  };
}

export function metricsForFaqRow(faq: {
  title?: string;
  questions?: string[];
  question?: string;
  answer: string;
}): TextMetrics {
  const groupTitle = (faq.title ?? '').trim();
  const rawQuestions = Array.isArray(faq.questions) && faq.questions.length
    ? faq.questions
    : faq.question != null && String(faq.question).trim()
      ? [String(faq.question).trim()]
      : [];
  const questions = rawQuestions.map((q) => String(q ?? '').trim()).filter(Boolean);
  const answer = (faq.answer ?? '').trim();
  const primaryQ = questions[0] ?? '';
  const line =
    questions.length > 0 || groupTitle
      ? buildQaEmbeddingText(groupTitle, questions, answer)
      : buildFaqEmbeddingText(primaryQ, answer);
  return textMetrics(line);
}

export function metricsForSnippetRow(row: { title: string; snippet: string }): TextMetrics {
  const stitle = (row.title ?? '').trim() || 'Snippet';
  const body = (row.snippet ?? '').trim();
  return textMetrics(buildNoteEmbeddingText(stitle, body));
}

export function metricsForTableRow(row: {
  title: string;
  columns: string[];
  rows: string[][];
}): TextMetrics {
  const title = (row.title ?? '').trim() || 'Table';
  const columns = Array.isArray(row.columns) ? row.columns.map((c) => String(c ?? '')) : [];
  const rows = Array.isArray(row.rows) ? row.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [];
  return textMetrics(buildTableEmbeddingText(title, columns, rows));
}

export function metricsForDocumentContent(text: string | undefined | null): TextMetrics {
  return textMetrics(text ?? '');
}

/** After trim: require at least one non-whitespace character — same rule as ingestion “ready”. */
export function isTrainableExtractedDocumentText(trimmedContent: string): boolean {
  const m = metricsForDocumentContent(trimmedContent.trim());
  return m.characterCount > 0;
}

/**
 * Stats / persisted `characterCount` for suggestions: **scoped information only** (trimmed).
 * Chip text is UI-only and must not inflate `knowledgeStats` or training workload character totals.
 */
export function metricsForSuggestionRow(row: { chipText?: string; scopedInformation?: string }): TextMetrics {
  return textMetrics(String(row.scopedInformation ?? '').trim());
}

/** Best-effort metrics from a persisted item when `characterCount` was not set (e.g. legacy data). */
export function estimateTextMetricsFromKnowledgeItemLean(item: {
  sourceType: string;
  content?: string;
  title?: string;
  faqMeta?: { title?: string; questions?: string[]; answer?: string };
  rawContent?: string;
  suggestionMeta?: { scopedInformation?: string };
}): TextMetrics {
  const st = item.sourceType;
  if (st === 'faq' && item.faqMeta) {
    return metricsForFaqRow({
      title: item.faqMeta.title,
      questions: item.faqMeta.questions,
      answer: String(item.faqMeta.answer ?? ''),
    });
  }
  if (st === 'note' && item.rawContent) {
    try {
      const p = JSON.parse(item.rawContent) as { title?: string; snippet?: string };
      return metricsForSnippetRow({
        title: p.title ?? item.title ?? 'Snippet',
        snippet: p.snippet ?? '',
      });
    } catch {
      // fall through
    }
  }
  if (st === 'table' && item.rawContent) {
    try {
      const p = JSON.parse(item.rawContent) as { title?: string; columns?: string[]; rows?: string[][] };
      return metricsForTableRow({
        title: p.title ?? item.title ?? 'Table',
        columns: Array.isArray(p.columns) ? p.columns : [],
        rows: Array.isArray(p.rows) ? p.rows : [],
      });
    } catch {
      // fall through
    }
  }
  if (st === 'note' && !item.rawContent) {
    return textMetrics((item.content ?? '').trim());
  }
  if (st === 'suggestion') {
    const scopedMeta = String(item.suggestionMeta?.scopedInformation ?? '').trim();
    if (scopedMeta.length > 0) return textMetrics(scopedMeta);
    const raw = item.rawContent;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const p = JSON.parse(raw) as { context?: string; description?: string; scopedInformation?: string };
        const ctx = String(p.context ?? p.description ?? p.scopedInformation ?? '').trim();
        if (ctx.length > 0) return textMetrics(ctx);
      } catch {
        /* fall through */
      }
    }
    return textMetrics('');
  }
  return metricsForDocumentContent(item.content ?? '');
}
