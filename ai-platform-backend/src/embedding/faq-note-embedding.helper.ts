/**
 * Single source of truth for FAQ and note embedding input text and change detection.
 * Used for embedding generation and hash-based skip when content unchanged.
 */

import * as crypto from 'crypto';

/** Format used for FAQ embedding input (must stay stable for hash). */
export function buildFaqEmbeddingText(question: string, answer: string): string {
  const q = (question ?? '').trim();
  const a = (answer ?? '').trim();
  return `Question: ${q}\nAnswer: ${a}`;
}

/** Format used for note embedding input (title optional). */
export function buildNoteEmbeddingText(title: string | undefined, text: string): string {
  const t = (text ?? '').trim();
  const titlePart = (title ?? '').trim();
  if (titlePart) return `Title: ${titlePart}\nText: ${t}`;
  return `Title:\nText: ${t}`;
}

/** Normalize text for stable hashing: lowercase, trim, collapse whitespace, single newlines. */
export function normalizeForEmbeddingInput(text: string): string {
  if (text == null || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

/** Compute a stable hash of the embedding input string (for change detection). */
export function computeEmbeddingInputHash(input: string): string {
  const normalized = normalizeForEmbeddingInput(input);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 32);
}

/**
 * Return whether an embedding may be used for semantic scoring in retrieval.
 * Only true when status is 'ready', stored hash matches current content hash, and embedding exists.
 * Prevents stale or pending/failed embeddings from affecting semantic score.
 */
export function isEmbeddingValidForSemantic(
  status: string | undefined,
  storedHash: string | undefined,
  currentHash: string,
  embedding: number[] | undefined | null,
): boolean {
  if (status !== 'ready') return false;
  if (storedHash !== currentHash) return false;
  return Array.isArray(embedding) && embedding.length > 0;
}

/** FAQ with optional embedding metadata (from DB). */
export interface FaqWithEmbeddingMeta {
  question: string;
  answer: string;
  embeddingInputHash?: string;
  embeddingStatus?: 'pending' | 'ready' | 'failed';
  embedding?: number[];
  embeddingUpdatedAt?: Date;
  embeddingError?: string | null;
}

/**
 * Merge new FAQ content with existing embedding state. Matches by content hash across all current FAQs
 * so reordering does not mark unchanged items as pending. Only question/answer changes set pending.
 */
export function mergeFaqsForSave(
  currentFaqs: FaqWithEmbeddingMeta[] | undefined,
  newFaqs: Array<{ question: string; answer: string }>,
): Array<FaqWithEmbeddingMeta & { question: string; answer: string }> {
  return newFaqs.map((f) => {
    const input = buildFaqEmbeddingText(f.question, f.answer);
    const newHash = computeEmbeddingInputHash(input);
    const existing = currentFaqs?.find(
      (cur) => cur.embeddingStatus === 'ready' && cur.embeddingInputHash === newHash && cur.embedding?.length,
    );
    if (existing) {
      return {
        question: f.question,
        answer: f.answer,
        embedding: existing.embedding,
        embeddingStatus: 'ready' as const,
        embeddingUpdatedAt: existing.embeddingUpdatedAt,
        embeddingInputHash: existing.embeddingInputHash,
        embeddingError: existing.embeddingError ?? null,
      };
    }
    return {
      question: f.question,
      answer: f.answer,
      embeddingStatus: 'pending' as const,
      embeddingInputHash: newHash,
      embeddingError: null,
    };
  });
}

/**
 * Get note embedding state for save. If content unchanged and ready, keep; else set pending.
 */
export function getNoteEmbeddingStateForSave(
  currentHash: string | undefined,
  currentStatus: 'pending' | 'ready' | 'failed' | undefined,
  newKnowledgeDescription: string,
): { noteEmbeddingInputHash: string; noteEmbeddingStatus: 'pending' | 'ready' | 'failed' } {
  const input = buildNoteEmbeddingText(undefined, newKnowledgeDescription);
  const newHash = computeEmbeddingInputHash(input);
  const sameHash = currentHash === newHash && currentStatus === 'ready';
  return {
    noteEmbeddingInputHash: newHash,
    noteEmbeddingStatus: sameHash ? 'ready' : 'pending',
  };
}
