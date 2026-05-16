import {
  buildFaqEmbeddingText,
  buildNoteEmbeddingText,
  buildQaEmbeddingText,
  buildTableEmbeddingText,
} from './faq-note-embedding.helper';
import { getUtf8ByteCount } from './knowledge-byte-size.util';
import { calculateTableKnowledgeUsageBytes, type KnowledgeBaseItemUsageLean } from './knowledge-usage.util';

/** Incoming FAQ payload (normalized workspace/bot shape). */
export function incomingFaqSectionUtf8Bytes(
  faqs: Array<{
    title?: string;
    questions?: string[];
    question?: string;
    answer: string;
    active?: boolean;
  }>,
): number {
  let total = 0;
  for (let i = 0; i < faqs.length; i++) {
    const faq = faqs[i]!;
    if (faq.active === false) continue;
    const groupTitle = (faq.title ?? '').trim();
    const rawQuestions = Array.isArray(faq.questions) && faq.questions.length
      ? faq.questions
      : faq.question != null && String(faq.question).trim()
        ? [String(faq.question).trim()]
        : [];
    const questions = rawQuestions.map((q) => String(q ?? '').trim()).filter(Boolean);
    const answer = (faq.answer ?? '').trim();
    if (!answer) continue;
    if (questions.length === 0 && !groupTitle) continue;
    const primaryQ = questions[0] ?? '';
    const line =
      questions.length > 0 || groupTitle
        ? buildQaEmbeddingText(groupTitle, questions, answer)
        : buildFaqEmbeddingText(primaryQ, answer);
    total += getUtf8ByteCount(line);
  }
  return total;
}

export function incomingNoteSnippetSectionUtf8Bytes(
  snippets: Array<{ title: string; snippet: string; active?: boolean }>,
): number {
  let total = 0;
  for (const row of snippets) {
    const stitle = (row.title ?? '').trim() || 'Snippet';
    const body = (row.snippet ?? '').trim();
    const active = row.active !== false;
    const hasContent = stitle.length > 0 && body.length > 0;
    if (!hasContent || !active) continue;
    total += getUtf8ByteCount(buildNoteEmbeddingText(stitle, body));
  }
  return total;
}

/** Scoped suggestion: only `context` UTF-8 bytes count toward bot KB total (chip label is UI-only). */
export function incomingSuggestionSectionUtf8Bytes(
  questions: Array<{ label: string; context?: string }>,
): number {
  let total = 0;
  for (const q of questions) {
    const scoped = (q.context ?? '').trim();
    if (!scoped) continue;
    total += getUtf8ByteCount(scoped);
  }
  return total;
}

export function incomingTableSectionUtf8Bytes(
  tables: Array<{
    title: string;
    columns: string[];
    rows: string[][];
    active?: boolean;
  }>,
): number {
  let total = 0;
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i]!;
    const title = (t.title ?? '').trim() || `Table ${i + 1}`;
    const columns = Array.isArray(t.columns) ? t.columns.map((c) => String(c ?? '')) : [];
    const rows = Array.isArray(t.rows) ? t.rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])) : [];
    const active = t.active !== false;
    const hasContent = columns.length > 0 && rows.length > 0;
    if (!hasContent || !active) continue;
    const textForHash = buildTableEmbeddingText(title, columns, rows);
    const lean: KnowledgeBaseItemUsageLean = {
      sourceType: 'table',
      content: textForHash,
      rawContent: JSON.stringify({ title, columns, rows }),
    };
    total += calculateTableKnowledgeUsageBytes(lean);
  }
  return total;
}
