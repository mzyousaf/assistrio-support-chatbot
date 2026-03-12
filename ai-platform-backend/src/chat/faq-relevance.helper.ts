/**
 * FAQ relevance ranking: select top FAQs by relevance to the current user message.
 * Uses lightweight text similarity (no embeddings) so it is fast and backward-compatible.
 * Can be extended later to use embedding similarity when FAQ embeddings are stored.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

const DEFAULT_TOP_N = 5;

/** Tokenize for scoring: lowercase, split on non-alphanumeric, filter empty. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Simple relevance score: overlap of tokens between user message and (question + answer).
 * Weights question slightly higher than answer so question match matters more.
 */
function scoreFaq(userTokens: string[], question: string, answer: string): number {
  const qTokens = new Set(tokenize(question));
  const aTokens = new Set(tokenize(answer));
  const combined = new Set([...qTokens, ...aTokens]);

  let score = 0;
  for (const t of userTokens) {
    if (qTokens.has(t)) score += 1.5;
    else if (aTokens.has(t)) score += 1;
  }
  if (combined.size === 0) return 0;
  const norm = userTokens.length + 1;
  return score / norm;
}

/**
 * Rank FAQs by relevance to the user message and return the top N.
 * If there are fewer FAQs than N, returns all. Order is by score descending.
 */
export function rankFaqsByRelevance(
  faqs: FaqItem[],
  userMessage: string,
  topN: number = DEFAULT_TOP_N,
): FaqItem[] {
  if (!Array.isArray(faqs) || faqs.length === 0) return [];
  const msg = (userMessage || '').trim();
  const userTokens = tokenize(msg);
  if (userTokens.length === 0) return faqs.slice(0, topN);

  const scored = faqs.map((faq) => ({
    faq,
    score: scoreFaq(userTokens, faq.question, faq.answer),
  }));
  scored.sort((a, b) => b.score - a.score);
  const n = Math.min(topN, scored.length);
  return scored.slice(0, n).map((s) => s.faq);
}
