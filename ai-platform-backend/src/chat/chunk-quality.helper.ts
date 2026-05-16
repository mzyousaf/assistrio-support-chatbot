/**
 * Chunk text normalization and quality signals for document RAG.
 * Used for retrieval scoring and debug; does not alter text sent to the model.
 */

const MIN_USEFUL_CHUNK_LENGTH = 40;

/**
 * Normalize chunk text for retrieval/scoring: collapse whitespace, trim, reduce repeated newlines.
 * Does not strip content; only makes scoring more consistent.
 */
export function normalizeChunkText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Quality signals for a set of chunks (for debug/diagnostics).
 */
export interface ChunkQualitySignals {
  /** Average character length of chunk texts (after normalization). */
  avgChunkLength: number;
  /** Minimum chunk length. */
  minChunkLength: number;
  /** True if any chunk is shorter than MIN_USEFUL_CHUNK_LENGTH. */
  anyTooShort: boolean;
  /** Number of chunks below minimum useful length. */
  tooShortCount: number;
}

export function getChunkQualitySignals(
  chunks: Array<{ text: string }>,
): ChunkQualitySignals {
  if (!chunks?.length) {
    return { avgChunkLength: 0, minChunkLength: 0, anyTooShort: false, tooShortCount: 0 };
  }
  const lengths = chunks.map((c) => normalizeChunkText(c.text).length);
  const sum = lengths.reduce((a, b) => a + b, 0);
  const min = Math.min(...lengths);
  const tooShortCount = lengths.filter((l) => l < MIN_USEFUL_CHUNK_LENGTH).length;
  return {
    avgChunkLength: Math.round(sum / lengths.length),
    minChunkLength: min,
    anyTooShort: tooShortCount > 0,
    tooShortCount,
  };
}

/** Safe excerpt for debug (max chars). */
export const DEBUG_EXCERPT_MAX_CHARS = 120;

export function excerptForDebug(text: string, maxChars: number = DEBUG_EXCERPT_MAX_CHARS): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trim() + '…';
}
