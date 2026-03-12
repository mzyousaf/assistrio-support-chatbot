/**
 * Hybrid retrieval helpers: lexical scoring, combined score, confidence, diversity.
 * Kept isolated for future vector DB / search index migration.
 */

import type {
  EnrichedChunk,
  HybridScoreWeights,
  LexicalBreakdown,
  RetrievalConfidence,
  RetrievalConfidenceThresholds,
} from './retrieval.types';
import { DEFAULT_CONFIDENCE_THRESHOLDS, DEFAULT_HYBRID_WEIGHTS } from './retrieval.types';

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
 * Used as fallback/boost when combined with semantic score.
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

/** Normalize for phrase match: lowercase, collapse whitespace. */
function normalizeForPhrase(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Title match bonus when query tokens appear in document title. */
const TITLE_MATCH_BONUS_MAX = 0.25;
/** Chunk/section heading match (e.g. "9. Contact Support") so section headings rank higher. */
const CHUNK_HEADING_BONUS_MAX = 0.3;
/** Extra when query closely matches heading (most query tokens in heading). */
const HEADING_CLOSE_MATCH_EXTRA = 0.08;
/** Phrase/substring bonus when query appears in chunk (normalized). */
const PHRASE_MATCH_BONUS_MAX = 0.2;
/** FAQ question line match: when user query matches the Q: line in FAQ-style chunks. */
const FAQ_QUESTION_BONUS_MAX = 0.25;

/**
 * Extract the FAQ question line from chunk text (standardized format [Section]\nQ: ... or legacy Question: ...).
 * Returns the question text only, for use in lexical bonus.
 */
export function extractFaqQuestionFromChunk(chunkText: string): string | undefined {
  if (!chunkText || typeof chunkText !== 'string') return undefined;
  const t = chunkText.trim();
  const afterBracket = t.indexOf(']');
  if (afterBracket < 0) return undefined;
  const rest = t.slice(afterBracket + 1).trim();
  const qMatch = rest.match(/^(?:Q:\s*|Question[:\s\-)]*\s*)([\s\S]+?)(?=\n\s*A[\.\):\s]|\n\s*Answer\s|$)/i);
  if (qMatch) return qMatch[1].trim();
  const firstLine = rest.split('\n')[0]?.trim() ?? '';
  if (/^(?:Q\.?|Q\)|Question)\s*[:\-\s)]/i.test(firstLine)) {
    return firstLine.replace(/^(?:Q\.?|Q\)|Question)\s*[:\-\s)]*\s*/i, '').trim();
  }
  return undefined;
}

/**
 * Compute document-aware lexical score and optional breakdown (title, heading, phrase, FAQ question bonuses).
 * Stronger section/title/FAQ-question match so structured chunks are easier to retrieve.
 */
function computeDocumentLexical(
  query: string,
  chunkText: string,
  documentTitle?: string,
  chunkHeading?: string,
  faqQuestion?: string,
): { score: number; breakdown: LexicalBreakdown } {
  const base = lexicalScore(query, chunkText);
  const breakdown: LexicalBreakdown = {
    titleBonus: 0,
    headingBonus: 0,
    phraseBonus: 0,
    faqQuestionBonus: 0,
  };
  const qTrimmed = (query || '').trim();
  const qLower = qTrimmed.toLowerCase();
  const qNorm = normalizeForPhrase(query);
  const chunkNorm = normalizeForPhrase(chunkText);
  const qTokens = new Set(tokenize(query));

  if ((documentTitle || '').trim().length >= 2 && qTokens.size > 0) {
    const titleTokens = tokenize(documentTitle || '');
    let titleMatches = 0;
    for (const t of titleTokens) {
      if (qTokens.has(t)) titleMatches++;
    }
    breakdown.titleBonus = (titleMatches / Math.max(qTokens.size, 1)) * TITLE_MATCH_BONUS_MAX;
  }

  if ((chunkHeading || '').trim().length >= 2 && qTokens.size > 0) {
    const headingTokens = tokenize(chunkHeading || '');
    let headingMatches = 0;
    for (const t of headingTokens) {
      if (qTokens.has(t)) headingMatches++;
    }
    const ratio = headingMatches / Math.max(qTokens.size, 1);
    breakdown.headingBonus = ratio * CHUNK_HEADING_BONUS_MAX;
    if (ratio >= 0.7 && headingTokens.length >= 2) {
      breakdown.headingBonus = Math.min(1, breakdown.headingBonus + HEADING_CLOSE_MATCH_EXTRA);
    }
  }

  if (qNorm.length >= 3) {
    if (chunkNorm.includes(qNorm)) {
      breakdown.phraseBonus = PHRASE_MATCH_BONUS_MAX;
    } else {
      const qWords = qNorm.split(/\s+/).filter((w) => w.length > 0);
      if (qWords.length >= 2 && chunkNorm.length > 0) {
        let inOrder = 0;
        let lastIdx = -1;
        for (const w of qWords) {
          const idx = chunkNorm.indexOf(w, lastIdx + 1);
          if (idx >= 0) {
            inOrder++;
            lastIdx = idx;
          }
        }
        if (inOrder === qWords.length) {
          breakdown.phraseBonus = (inOrder / qWords.length) * PHRASE_MATCH_BONUS_MAX * 0.8;
        }
      }
    }
  }

  if ((faqQuestion || '').trim().length >= 2 && qTokens.size > 0) {
    const faqTokens = tokenize(faqQuestion || '');
    let faqMatches = 0;
    for (const t of faqTokens) {
      if (qTokens.has(t)) faqMatches++;
    }
    const tokenBonus = (faqMatches / Math.max(qTokens.size, 1)) * FAQ_QUESTION_BONUS_MAX;
    const faqNorm = normalizeForPhrase(faqQuestion || '');
    const phraseInFaq = qNorm.length >= 3 && faqNorm.includes(qNorm) ? FAQ_QUESTION_BONUS_MAX : 0;
    breakdown.faqQuestionBonus = Math.min(FAQ_QUESTION_BONUS_MAX, Math.max(tokenBonus, phraseInFaq));
  }

  const totalBonus = breakdown.titleBonus + breakdown.headingBonus + breakdown.phraseBonus + breakdown.faqQuestionBonus;
  const score = Math.min(1, base + totalBonus);
  return { score, breakdown };
}

/**
 * Document-aware lexical score: token overlap + document title + chunk heading + phrase + FAQ question bonus.
 * Backward-compatible: returns a single number.
 */
export function documentLexicalScore(
  query: string,
  chunkText: string,
  documentTitle?: string,
  chunkHeading?: string,
): number {
  const faqQuestion = extractFaqQuestionFromChunk(chunkText);
  return computeDocumentLexical(query, chunkText, documentTitle, chunkHeading, faqQuestion).score;
}

/**
 * Document-aware lexical score with breakdown for debug (title, heading, phrase, FAQ question bonuses).
 */
export function documentLexicalScoreWithBreakdown(
  query: string,
  chunkText: string,
  documentTitle?: string,
  chunkHeading?: string,
): { score: number; breakdown: LexicalBreakdown } {
  const faqQuestion = extractFaqQuestionFromChunk(chunkText);
  return computeDocumentLexical(query, chunkText, documentTitle, chunkHeading, faqQuestion);
}

/** Extract section heading from chunk text when it starts with "[Title]" (from section-aware chunking). */
export function extractChunkHeading(chunkText: string): string | undefined {
  const m = (chunkText || '').trim().match(/^\[([^\]]+)\]\s*\n?/);
  return m ? m[1].trim() : undefined;
}

/**
 * Combine semantic and lexical scores with configurable weights.
 */
export function combinedScore(
  semantic: number,
  lexical: number,
  weights: HybridScoreWeights = DEFAULT_HYBRID_WEIGHTS,
): number {
  const s = Math.max(0, Math.min(1, semantic));
  const l = Math.max(0, Math.min(1, lexical));
  return weights.semantic * s + weights.lexical * l;
}

/**
 * Classify retrieval confidence from top chunk combined score.
 */
export function getRetrievalConfidence(
  topCombinedScore: number,
  thresholds: RetrievalConfidenceThresholds = DEFAULT_CONFIDENCE_THRESHOLDS,
): RetrievalConfidence {
  if (topCombinedScore >= thresholds.highMin) return 'high';
  if (topCombinedScore >= thresholds.mediumMin) return 'medium';
  return 'low';
}

/** Default max chunks per document for diversity (avoid 4 from same doc). */
const DEFAULT_MAX_CHUNKS_PER_DOC = 2;

/**
 * Apply diversity: cap chunks per document so we don't return too many near-duplicates from one doc.
 * Input chunks must be sorted by combinedScore desc. Returns new array, stable order.
 */
export function applyChunkDiversity(
  chunks: EnrichedChunk[],
  maxPerDoc: number = DEFAULT_MAX_CHUNKS_PER_DOC,
): EnrichedChunk[] {
  const perDoc = new Map<string, number>();
  const out: EnrichedChunk[] = [];
  for (const c of chunks) {
    const docId = c.documentId;
    const count = perDoc.get(docId) ?? 0;
    if (count < maxPerDoc) {
      perDoc.set(docId, count + 1);
      out.push(c);
    }
  }
  return out;
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
