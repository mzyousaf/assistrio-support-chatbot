/**
 * Importance-based budgeting for the unified evidence prompt path.
 * Priority: system + current message + top evidence (protected) > more evidence > conversation (oldest trimmed first).
 */

import { estimateTokens, trimConversationToBudget } from './token-budget.helper';

/** Configurable options for evidence-mode prompt budgeting. */
export interface EvidenceBudgetOptions {
  /** Minimum number of top-ranked evidence items to always keep (if available). */
  minTopEvidenceItems?: number;
  /** Minimum token budget reserved for evidence before conversation gets space. */
  minEvidenceTokensReserved?: number;
  /** Maximum tokens allowed for the evidence block. */
  maxEvidenceTokens?: number;
  /** Maximum tokens allowed for conversation history (so evidence is not crowded out). */
  maxConversationTokens?: number;
  /** Optional cap on number of evidence items (in addition to token cap). */
  maxEvidenceItems?: number;
}

export const DEFAULT_EVIDENCE_BUDGET_OPTIONS: Required<EvidenceBudgetOptions> = {
  minTopEvidenceItems: 3,
  minEvidenceTokensReserved: 400,
  maxEvidenceTokens: 2200,
  maxConversationTokens: 900,
  maxEvidenceItems: 30,
};

/** Reason code for why trimming was applied (debug). */
export type EvidenceTrimReason =
  | 'evidence_over_budget'
  | 'conversation_over_budget'
  | 'max_evidence_items'
  | 'none';

/** Token distribution by block after budgeting (debug). */
export interface EvidenceBudgetTokenDistribution {
  systemEstimate: number;
  userEvidence: number;
  userConversation: number;
  userCurrentMessage: number;
  userTotal: number;
}

/** Result of priority-aware evidence + conversation budgeting. */
export interface EvidenceBudgetResult<T extends { text: string }> {
  /** Evidence items kept (in rank order; top items protected first). */
  evidenceKept: T[];
  /** Evidence items trimmed out (lower-ranked). */
  evidenceTrimmedOut: T[];
  /** Conversation messages kept (most recent preserved). */
  conversationKept: Array<{ role: string; content: string }>;
  /** Conversation messages trimmed (oldest). */
  conversationTrimmedOut: Array<{ role: string; content: string }>;
  /** Number of top evidence items protected (never trimmed). */
  protectedEvidenceCount: number;
  /** Token distribution by block. */
  tokenDistribution: EvidenceBudgetTokenDistribution;
  /** Why evidence was trimmed (for debug). */
  evidenceTrimReason: EvidenceTrimReason;
  /** Why conversation was trimmed (for debug). */
  conversationTrimReason: EvidenceTrimReason;
  /** Human-readable summary of trimming (debug). */
  trimSummary: string;
}

const BUFFER_TOKENS = 80;

/**
 * Trim evidence to fit budget while protecting the top N items.
 * Items are in rank order; we keep the first minTopEvidenceItems (protected), then add more until token budget is reached.
 * Deterministic: always trim from the tail (lower-ranked).
 */
export function trimEvidenceWithProtection<T extends { text: string }>(
  items: T[],
  maxTokens: number,
  minTopEvidenceItems: number,
  maxItems?: number,
): { kept: T[]; trimmedOut: T[]; tokensUsed: number; protectedCount: number } {
  if (items.length === 0) {
    return { kept: [], trimmedOut: [], tokensUsed: 0, protectedCount: 0 };
  }
  const effectiveMaxItems = maxItems != null ? Math.min(maxItems, items.length) : items.length;
  const protectedCount = Math.min(minTopEvidenceItems, items.length);
  const protectedItems = items.slice(0, protectedCount);
  const protectedTokens = protectedItems.reduce((sum, i) => sum + estimateTokens(i.text || ''), 0);
  let tokensUsed = protectedTokens;
  const kept: T[] = [...protectedItems];
  for (let i = protectedCount; i < effectiveMaxItems; i++) {
    const item = items[i];
    const t = estimateTokens(item.text || '');
    if (tokensUsed + t <= maxTokens) {
      kept.push(item);
      tokensUsed += t;
    } else break;
  }
  const keptSet = new Set(kept);
  const trimmedOut = items.filter((i) => !keptSet.has(i));
  return { kept, trimmedOut, tokensUsed, protectedCount };
}

/**
 * Assemble evidence and conversation within user token budget using priority rules.
 * Priority: current message (reserved) > evidence (min reserved, then fill to max) > conversation (capped).
 */
export function assembleEvidencePromptWithBudget<T extends { text: string }>(
  evidenceItems: T[],
  conversationMessages: Array<{ role: string; content: string }>,
  currentMessageTokens: number,
  userMaxTokens: number,
  options?: EvidenceBudgetOptions | null,
): EvidenceBudgetResult<T> {
  const opts = { ...DEFAULT_EVIDENCE_BUDGET_OPTIONS, ...options };
  const reservedForCurrent = currentMessageTokens + BUFFER_TOKENS;
  const availableForEvidenceAndConv = Math.max(0, userMaxTokens - reservedForCurrent);

  // Evidence gets first claim (priority); cap at maxEvidenceTokens
  const evidenceBudget = Math.min(opts.maxEvidenceTokens, availableForEvidenceAndConv);

  const { kept: evidenceKept, trimmedOut: evidenceTrimmedOut, tokensUsed: evidenceTokensUsed, protectedCount } = trimEvidenceWithProtection(
    evidenceItems,
    evidenceBudget,
    opts.minTopEvidenceItems,
    opts.maxEvidenceItems,
  );

  const evidenceTrimReason: EvidenceTrimReason =
    evidenceTrimmedOut.length > 0
      ? evidenceItems.length > (opts.maxEvidenceItems ?? evidenceItems.length)
        ? 'max_evidence_items'
        : 'evidence_over_budget'
      : 'none';

  // Conversation: remaining space, capped at maxConversationTokens; reserve at least minEvidenceTokensReserved for evidence
  const remainingForConv = Math.max(0, availableForEvidenceAndConv - evidenceTokensUsed);
  const maxConvByReserve = Math.max(0, availableForEvidenceAndConv - opts.minEvidenceTokensReserved);
  const conversationBudget = Math.min(opts.maxConversationTokens, remainingForConv, maxConvByReserve);
  const conversationKept = trimConversationToBudget(conversationMessages, conversationBudget);
  const keptCount = conversationKept.length;
  const conversationTrimmedOut = conversationMessages.length > keptCount
    ? conversationMessages.slice(0, conversationMessages.length - keptCount)
    : [];
  const convTokensUsed = conversationKept.reduce((s, m) => s + estimateTokens(m.content ?? ''), 0);

  const conversationTrimReason: EvidenceTrimReason =
    conversationTrimmedOut.length > 0 ? 'conversation_over_budget' : 'none';

  const userTotal = evidenceTokensUsed + convTokensUsed + currentMessageTokens;
  const trimSummaryParts: string[] = [];
  if (evidenceTrimmedOut.length > 0) {
    trimSummaryParts.push(`${evidenceTrimmedOut.length} evidence item(s) trimmed (${evidenceTrimReason})`);
  }
  if (conversationTrimmedOut.length > 0) {
    trimSummaryParts.push(`${conversationTrimmedOut.length} conversation message(s) trimmed (${conversationTrimReason})`);
  }
  const trimSummary = trimSummaryParts.length > 0 ? trimSummaryParts.join('; ') : 'No trimming';

  return {
    evidenceKept,
    evidenceTrimmedOut,
    conversationKept,
    conversationTrimmedOut,
    protectedEvidenceCount: protectedCount,
    tokenDistribution: {
      systemEstimate: 0,
      userEvidence: evidenceTokensUsed,
      userConversation: convTokensUsed,
      userCurrentMessage: currentMessageTokens,
      userTotal,
    },
    evidenceTrimReason,
    conversationTrimReason,
    trimSummary,
  };
}
