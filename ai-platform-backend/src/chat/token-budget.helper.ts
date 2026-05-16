/**
 * Approximate token budgeting for prompt assembly.
 * Uses character-based estimate (~4 chars per token) to avoid oversized prompts.
 * Priority order for trimming: conversation history (oldest first), then FAQs, then document chunks.
 */

/** Rough chars per token for English (OpenAI). */
const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateTokens(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.replace(/\s+/g, ' ').length / CHARS_PER_TOKEN_ESTIMATE);
}

export interface SectionBudget {
  systemMaxTokens: number;
  userMaxTokens: number;
  /** Reserve for current message + lead + minimal knowledge. */
  reservedUserTokens: number;
}

export const DEFAULT_SECTION_BUDGET: SectionBudget = {
  systemMaxTokens: 2000,
  userMaxTokens: 3500,
  reservedUserTokens: 800,
};

/**
 * Trim conversation messages to fit within remaining user budget (oldest messages first).
 * Preserves order; trims from the start so recent context is kept.
 */
export function trimConversationToBudget(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Array<{ role: string; content: string }> {
  let total = 0;
  const out: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const t = estimateTokens(m.content || '');
    if (total + t <= maxTokens) {
      out.unshift(m);
      total += t;
    } else break;
  }
  return out;
}

/**
 * Trim document chunk texts to a max total token count (by dropping lowest-priority chunks).
 */
export function trimChunksToBudget(
  chunks: Array<{ text: string; score?: number }>,
  maxTokens: number,
): Array<{ text: string; score?: number }> {
  const withTokens = chunks.map((c) => ({ ...c, tokens: estimateTokens(c.text) }));
  let total = 0;
  const out: Array<{ text: string; score?: number }> = [];
  for (const c of withTokens) {
    if (total + c.tokens <= maxTokens) {
      out.push({ text: c.text, score: c.score });
      total += c.tokens;
    } else break;
  }
  return out;
}

/** Result of trimming evidence list to token budget (kept in rank order, trimmed from end). */
export interface TrimEvidenceResult<T> {
  kept: T[];
  trimmedOut: T[];
  tokensUsed: number;
}

/**
 * Trim evidence items to fit within maxTokens (by dropping lowest-ranked from end).
 * Items must have a .text field. Use for evidence-first prompt assembly.
 */
export function trimEvidenceToTokenBudget<T extends { text: string }>(
  items: T[],
  maxTokens: number,
): TrimEvidenceResult<T> {
  let total = 0;
  const kept: T[] = [];
  for (const item of items) {
    const t = estimateTokens(item.text || '');
    if (total + t <= maxTokens) {
      kept.push(item);
      total += t;
    } else break;
  }
  const keptSet = new Set(kept);
  const trimmedOut = items.filter((i) => !keptSet.has(i));
  return { kept, trimmedOut, tokensUsed: total };
}
