/**
 * Retrieval helpers used by unified retrieval and chat-engine: tokenize, lexicalScore,
 * extractChunkHeading, normalizeSourceExcerpt.
 */

/** Tokenize for lexical match: lowercase, split non-alphanumeric. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Lexical relevance score: overlap of query tokens with chunk text (0–1).
 * Used by unified-knowledge-retrieval and unified-retrieval-scoring.
 */
export function lexicalScore(query: string, chunkText: string): number {
  const qTokens = new Set(tokenize(query));
  const cTokens = tokenize(chunkText);
  if (qTokens.size === 0 || cTokens.length === 0) return 0;
  let match = 0;
  for (const t of cTokens) {
    if (qTokens.has(t)) match++;
  }
  return match / Math.max(qTokens.size, cTokens.length);
}

/** Extract section heading from chunk text when it starts with "[Title]" (from section-aware chunking). */
export function extractChunkHeading(chunkText: string): string | undefined {
  const m = (chunkText || '').trim().match(/^\[([^\]]+)\]\s*\n?/);
  return m ? m[1].trim() : undefined;
}

/**
 * Normalize chunk text for UI/source excerpt: trim, collapse whitespace, cap length.
 */
export const SOURCE_EXCERPT_MAX_CHARS = 400;

export function normalizeSourceExcerpt(text: string, maxChars: number = SOURCE_EXCERPT_MAX_CHARS): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trim() + '…';
}
