/**
 * Central token-budget-aware context assembly.
 * Priority: preserve system/identity/grounding, current message, lead state,
 * then top document chunks, then top FAQs, then conversation history.
 * When trimming: history first (oldest), then FAQs (so docs keep space), then chunks last.
 */

import {
  estimateTokens,
  trimChunksToBudget,
  trimConversationToBudget,
} from './token-budget.helper';
import type { SectionBudget } from './token-budget.helper';

export interface BudgetAssemblyInput {
  conversationMessages: Array<{ role: string; content: string }>;
  documentChunks: Array<{ text: string; score?: number; documentId?: string; chunkId?: string; title?: string }>;
  faqs: Array<{ question: string; answer: string }>;
  currentUserMessage: string;
  knowledgeNotes?: string;
  /** Approximate lead block size in chars (for reserve). */
  leadBlockChars?: number;
  budget?: SectionBudget;
}

export interface BudgetAssemblyResult {
  conversationMessages: Array<{ role: string; content: string }>;
  documentChunks: Array<{ text: string; score?: number; documentId?: string; chunkId?: string; title?: string }>;
  faqs: Array<{ question: string; answer: string }>;
  tokenCounts: {
    conversation: number;
    chunks: number;
    faqs: number;
    currentMessage: number;
    notes: number;
    totalUserEstimate: number;
  };
  trimmed: {
    historyDropped: number;
    chunksDropped: number;
    faqsDropped: number;
  };
  /** Number of document chunks in final prompt (for debug). */
  finalDocumentChunkCount?: number;
  /** Number of FAQs in final prompt (for debug). */
  finalFaqCount?: number;
}

const DEFAULT_BUDGET: SectionBudget = {
  systemMaxTokens: 2000,
  userMaxTokens: 3500,
  reservedUserTokens: 800,
};

/**
 * Assemble context within token budget. Trims in order: history (oldest first), then chunks, then FAQs.
 * Does not trim current message, notes, or lead; reserves space for them.
 */
export function assembleContextWithBudget(input: BudgetAssemblyInput): BudgetAssemblyResult {
  const budget = input.budget ?? DEFAULT_BUDGET;
  const reserved = budget.reservedUserTokens;
  const maxUser = budget.userMaxTokens;
  const availableForSections = Math.max(0, maxUser - reserved);

  const currentTokens = estimateTokens(input.currentUserMessage);
  const notesTokens = estimateTokens(input.knowledgeNotes || '');
  const leadTokens = input.leadBlockChars ? Math.ceil(input.leadBlockChars / 4) : 100;
  const reservedActual = currentTokens + notesTokens + leadTokens + 100;
  const available = Math.max(0, maxUser - reservedActual);

  const chunkItems = input.documentChunks.map((c) => ({ text: c.text, score: c.score ?? 0 }));
  const faqItems = input.faqs.map((f) => ({ text: `Q: ${f.question}\nA: ${f.answer}`, ...f }));

  const tokensChunks = chunkItems.reduce((sum, c) => sum + estimateTokens(c.text), 0);
  const tokensFaqs = faqItems.reduce((sum, f) => sum + estimateTokens(f.text), 0);
  const tokensHistory = input.conversationMessages.reduce((sum, m) => sum + estimateTokens(m.content || ''), 0);
  const totalNeeded = tokensChunks + tokensFaqs + tokensHistory + currentTokens + notesTokens;

  const trimmed = { historyDropped: 0, chunksDropped: 0, faqsDropped: 0 };

  let conversationMessages = input.conversationMessages;
  let documentChunks = input.documentChunks;
  let faqs = input.faqs;

  if (totalNeeded <= available) {
    return {
      conversationMessages,
      documentChunks,
      faqs,
      tokenCounts: {
        conversation: tokensHistory,
        chunks: tokensChunks,
        faqs: tokensFaqs,
        currentMessage: currentTokens,
        notes: notesTokens,
        totalUserEstimate: totalNeeded,
      },
      trimmed,
      finalDocumentChunkCount: documentChunks.length,
      finalFaqCount: faqs.length,
    };
  }

  // 1) Trim history (oldest first) so recent context is kept
  const historyBudget = Math.floor(available * 0.5);
  const trimmedHistory = trimConversationToBudget(input.conversationMessages, historyBudget);
  trimmed.historyDropped = input.conversationMessages.length - trimmedHistory.length;
  conversationMessages = trimmedHistory;
  const afterHistory = estimateTokens(conversationMessages.map((m) => m.content).join('\n'));
  const remaining = available - afterHistory - currentTokens - notesTokens;

  // 2) Give document chunks priority: reserve at least 400 tokens or 55% of remaining; ensure at least one chunk when we have any
  const minChunkReserve = 400;
  const chunkBudget = Math.min(
    tokensChunks,
    Math.max(minChunkReserve, Math.floor(remaining * 0.55)),
  );
  const effectiveChunkBudget = documentChunks.length > 0 ? Math.max(chunkBudget, 80) : chunkBudget;
  if (documentChunks.length > 0 && tokensChunks > effectiveChunkBudget) {
    const trimmedChunkList = trimChunksToBudget(
      documentChunks.map((c) => ({ text: c.text, score: c.score })),
      effectiveChunkBudget,
    );
    const keptChunkCount = trimmedChunkList.length;
    documentChunks = documentChunks.slice(0, keptChunkCount);
    trimmed.chunksDropped = input.documentChunks.length - keptChunkCount;
  }
  const chunkTokensUsed = documentChunks.reduce((s, c) => s + estimateTokens(c.text), 0);
  const remainingForFaqs = Math.max(0, remaining - chunkTokensUsed);

  // 3) Trim FAQs to fit in the space left after document chunks
  const faqTokensTotal = faqItems.reduce((s, f) => s + estimateTokens(f.text), 0);
  if (remainingForFaqs < faqTokensTotal && faqs.length > 0) {
    let faqTokenSum = 0;
    let keep = 0;
    for (let i = 0; i < faqs.length; i++) {
      const t = estimateTokens(`Q: ${faqs[i].question}\nA: ${faqs[i].answer}`);
      if (faqTokenSum + t <= Math.max(150, remainingForFaqs)) {
        faqTokenSum += t;
        keep = i + 1;
      } else break;
    }
    faqs = faqs.slice(0, keep);
    trimmed.faqsDropped = input.faqs.length - faqs.length;
  }

  const finalHistoryTokens = conversationMessages.reduce((s, m) => s + estimateTokens(m.content || ''), 0);
  const finalChunkTokens = documentChunks.reduce((s, c) => s + estimateTokens(c.text), 0);
  const finalFaqTokens = faqs.reduce((s, f) => s + estimateTokens(f.question + f.answer), 0);

  return {
    conversationMessages,
    documentChunks,
    faqs,
    tokenCounts: {
      conversation: finalHistoryTokens,
      chunks: finalChunkTokens,
      faqs: finalFaqTokens,
      currentMessage: currentTokens,
      notes: notesTokens,
      totalUserEstimate: finalHistoryTokens + finalChunkTokens + finalFaqTokens + currentTokens + notesTokens,
    },
    trimmed,
    finalDocumentChunkCount: documentChunks.length,
    finalFaqCount: faqs.length,
  };
}
