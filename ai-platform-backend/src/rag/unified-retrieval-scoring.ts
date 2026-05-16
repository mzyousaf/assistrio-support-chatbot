/**
 * Modular scoring for unified knowledge retrieval: semantic, lexical, exact phrase,
 * heading match, title match, FAQ question match. Configurable weights for a balanced hybrid.
 */

import type { KnowledgeItem } from '../knowledge';
import { tokenize } from './retrieval-helpers';

/** Normalize for phrase match: lowercase, collapse whitespace. */
function normalizeForPhrase(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Full score breakdown for one item (inspectable in debug). */
export interface UnifiedScoreBreakdown {
  semanticScore: number;
  lexicalScore: number;
  exactPhraseScore: number;
  headingMatchScore: number;
  titleMatchScore: number;
  faqQuestionMatchScore: number;
  combinedScore: number;
}

/** Configurable weights for unified retrieval combined score. Tune for balance across sources. */
export interface UnifiedRetrievalWeights {
  semantic: number;
  lexical: number;
  exactPhrase: number;
  headingMatch: number;
  titleMatch: number;
  faqQuestionMatch: number;
}

/** Balanced default: less reliance on semantic so FAQs and notes compete. */
export const DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS: UnifiedRetrievalWeights = {
  semantic: 0.35,
  lexical: 0.20,
  exactPhrase: 0.15,
  headingMatch: 0.10,
  titleMatch: 0.10,
  faqQuestionMatch: 0.10,
};

const MIN_PHRASE_LENGTH = 3;

/**
 * Exact phrase score (0–1): reward when normalized query or significant phrases appear in item text.
 */
export function exactPhraseScore(query: string, normalizedText: string): number {
  const q = normalizeForPhrase(query);
  const t = (normalizedText || '').trim();
  if (!q || !t || q.length < MIN_PHRASE_LENGTH) return 0;
  const qLower = q.toLowerCase();
  const tLower = t.toLowerCase();
  if (qLower.length >= MIN_PHRASE_LENGTH && tLower.includes(qLower)) return 1.0;
  const words = qLower.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return 0;
  let inOrder = 0;
  let lastIdx = -1;
  for (const w of words) {
    const idx = tLower.indexOf(w, lastIdx + 1);
    if (idx >= 0) {
      inOrder++;
      lastIdx = idx;
    }
  }
  if (inOrder === words.length && words.length >= 2) return 0.5;
  if (inOrder > 0) return (inOrder / words.length) * 0.4;
  return 0;
}

/**
 * Heading/section match (0–1): reward when query tokens appear in section heading.
 */
export function headingMatchScore(query: string, section: string | undefined): number {
  if (!section || !(section.trim().length >= 2)) return 0;
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return 0;
  const headingTokens = tokenize(section);
  let match = 0;
  for (const t of headingTokens) {
    if (qTokens.has(t)) match++;
  }
  const ratio = match / Math.max(qTokens.size, headingTokens.length, 1);
  if (ratio >= 0.7 && headingTokens.length >= 2) return Math.min(1, ratio + 0.15);
  return Math.min(1, ratio);
}

/**
 * Title match (0–1): reward when query tokens appear in item title (document, FAQ question, note, HTML page).
 */
export function titleMatchScore(query: string, title: string | undefined): number {
  if (!title || !(title.trim().length >= 2)) return 0;
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return 0;
  const titleTokens = tokenize(title);
  let match = 0;
  for (const t of titleTokens) {
    if (qTokens.has(t)) match++;
  }
  const ratio = match / Math.max(qTokens.size, 1);
  const qNorm = normalizeForPhrase(query);
  const titleNorm = normalizeForPhrase(title);
  if (qNorm.length >= MIN_PHRASE_LENGTH && titleNorm.includes(qNorm)) return 1;
  return Math.min(1, ratio);
}

/**
 * FAQ question match (0–1): when the item is an FAQ, reward close match between query and question (title).
 */
export function faqQuestionMatchScore(
  query: string,
  sourceType: string,
  title: string | undefined,
): number {
  if (sourceType !== 'faq' || !title?.trim()) return 0;
  const qNorm = normalizeForPhrase(query);
  const questionNorm = normalizeForPhrase(title);
  if (qNorm.length >= MIN_PHRASE_LENGTH && questionNorm.includes(qNorm)) return 1;
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return 0;
  const questionTokens = tokenize(title);
  let match = 0;
  for (const t of questionTokens) {
    if (qTokens.has(t)) match++;
  }
  const ratio = match / Math.max(qTokens.size, 1);
  return Math.min(1, ratio);
}

/**
 * Compute combined score from breakdown using configurable weights.
 */
export function computeUnifiedCombinedScore(
  breakdown: Omit<UnifiedScoreBreakdown, 'combinedScore'>,
  weights: UnifiedRetrievalWeights = DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS,
): number {
  const w = weights;
  return Math.min(
    1,
    breakdown.semanticScore * w.semantic +
      breakdown.lexicalScore * w.lexical +
      breakdown.exactPhraseScore * w.exactPhrase +
      breakdown.headingMatchScore * w.headingMatch +
      breakdown.titleMatchScore * w.titleMatch +
      breakdown.faqQuestionMatchScore * w.faqQuestionMatch,
  );
}

/**
 * Score one knowledge item: all components + combined. Reusable for reranking and evidence selection.
 */
export function scoreKnowledgeItem(
  query: string,
  item: KnowledgeItem,
  semanticScore: number,
  lexicalScore: number,
  weights: UnifiedRetrievalWeights = DEFAULT_UNIFIED_RETRIEVAL_WEIGHTS,
): UnifiedScoreBreakdown {
  const exactPhrase = exactPhraseScore(query, item.normalizedText);
  const headingMatch = headingMatchScore(query, item.section);
  const titleMatch = titleMatchScore(query, item.title);
  const faqQuestionMatch = faqQuestionMatchScore(query, item.sourceType, item.title);

  const breakdown: Omit<UnifiedScoreBreakdown, 'combinedScore'> = {
    semanticScore,
    lexicalScore,
    exactPhraseScore: exactPhrase,
    headingMatchScore: headingMatch,
    titleMatchScore: titleMatch,
    faqQuestionMatchScore: faqQuestionMatch,
  };

  const combinedScore = computeUnifiedCombinedScore(breakdown, weights);

  return {
    ...breakdown,
    combinedScore,
  };
}
