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
