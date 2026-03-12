/**
 * Mapping helpers: normalize document chunks, FAQs, notes, and HTML chunks
 * into the unified KnowledgeItem format. Does not replace existing retrieval.
 */

import type { KnowledgeItem, KnowledgeItemStatus } from './knowledge.types';
import { normalizeKnowledgeText } from './normalize';

/** Input for mapping a document chunk (e.g. from Chunk model + optional document meta). */
export interface DocumentChunkInput {
  id: string;
  documentId: string;
  botId: string;
  text: string;
  title?: string;
  section?: string;
  url?: string;
  sourceType?: string;
  status?: string;
  active?: boolean;
}

/** Input for mapping an FAQ (e.g. from bot.faqs). */
export interface FaqInput {
  id?: string;
  botId: string;
  question: string;
  answer: string;
  active?: boolean;
}

/** Input for mapping a note (e.g. knowledge description or standalone note). */
export interface NoteInput {
  id?: string;
  botId: string;
  title: string;
  text: string;
  active?: boolean;
}

/** Input for mapping an HTML page chunk (uploaded .html or fetched web page). */
export interface HtmlPageChunkInput {
  id?: string;
  botId: string;
  url: string;
  pageTitle: string;
  section?: string;
  text: string;
  active?: boolean;
  status?: string;
}

function toStatus(s: string | undefined): KnowledgeItemStatus {
  if (s === 'ready' || s === 'failed' || s === 'pending') return s;
  if (s === 'queued' || s === 'processing') return 'pending';
  return 'ready';
}

/**
 * Map a document chunk to a KnowledgeItem.
 */
export function mapDocumentChunkToKnowledgeItem(chunk: DocumentChunkInput): KnowledgeItem {
  const text = (chunk.text ?? '').trim();
  const title = (chunk.title ?? 'Document').trim() || 'Document';
  return {
    id: chunk.id,
    botId: String(chunk.botId),
    sourceType: 'document',
    sourceId: chunk.documentId,
    title,
    section: chunk.section?.trim() || undefined,
    text,
    normalizedText: normalizeKnowledgeText(text),
    metadata: {
      ...(chunk.url && { url: chunk.url }),
      ...(chunk.sourceType && { sourceType: chunk.sourceType as 'upload' | 'url' | 'manual' }),
    },
    active: chunk.active !== false,
    status: toStatus(chunk.status),
  };
}

/**
 * Map an FAQ to a KnowledgeItem.
 * Title is the question; text is "Q: question\nA: answer" for prompt compatibility.
 */
export function mapFaqToKnowledgeItem(faq: FaqInput): KnowledgeItem {
  const question = (faq.question ?? '').trim();
  const answer = (faq.answer ?? '').trim();
  const text = `Q: ${question}\nA: ${answer}`;
  const id = faq.id ?? `faq-${faq.botId}-${question.slice(0, 40).replace(/\s+/g, '-')}`;
  return {
    id,
    botId: String(faq.botId),
    sourceType: 'faq',
    sourceId: id,
    title: question || 'FAQ',
    section: undefined,
    text,
    normalizedText: normalizeKnowledgeText(text),
    metadata: { sourceType: 'faq' },
    active: faq.active !== false,
    status: 'ready',
  };
}

/**
 * Map a note to a KnowledgeItem.
 */
export function mapNoteToKnowledgeItem(note: NoteInput): KnowledgeItem {
  const text = (note.text ?? '').trim();
  const title = (note.title ?? 'Note').trim() || 'Note';
  const id = note.id ?? `note-${note.botId}-${title.slice(0, 30).replace(/\s+/g, '-')}`;
  return {
    id,
    botId: String(note.botId),
    sourceType: 'note',
    sourceId: id,
    title,
    section: undefined,
    text,
    normalizedText: normalizeKnowledgeText(text),
    metadata: { sourceType: 'note' },
    active: note.active !== false,
    status: 'ready',
  };
}

/**
 * Map an HTML page chunk to a KnowledgeItem.
 * Supports page title, source URL, and optional section heading.
 */
export function mapHtmlPageChunkToKnowledgeItem(htmlChunk: HtmlPageChunkInput): KnowledgeItem {
  const text = (htmlChunk.text ?? '').trim();
  const id =
    htmlChunk.id ??
    `html-${htmlChunk.botId}-${(htmlChunk.url + htmlChunk.section).slice(0, 50).replace(/\W/g, '-')}`;
  return {
    id,
    botId: String(htmlChunk.botId),
    sourceType: 'html',
    sourceId: id,
    title: (htmlChunk.pageTitle ?? 'HTML Page').trim() || 'HTML Page',
    section: htmlChunk.section?.trim() || undefined,
    text,
    normalizedText: normalizeKnowledgeText(text),
    metadata: {
      url: htmlChunk.url,
      pageTitle: (htmlChunk.pageTitle ?? '').trim() || 'HTML Page',
      sourceType: 'html',
    },
    active: htmlChunk.active !== false,
    status: toStatus(htmlChunk.status),
  };
}
