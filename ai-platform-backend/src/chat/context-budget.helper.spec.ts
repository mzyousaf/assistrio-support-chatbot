/**
 * Unit tests for context budget assembly (history/chunk/FAQ trimming).
 */

import { assembleContextWithBudget } from './context-budget.helper';

describe('assembleContextWithBudget', () => {
  it('returns inputs unchanged when within budget', () => {
    const input = {
      conversationMessages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }],
      documentChunks: [{ text: 'short', score: 0.9 }],
      faqs: [{ question: 'Q?', answer: 'A' }],
      currentUserMessage: 'thanks',
    };
    const result = assembleContextWithBudget(input);
    expect(result.conversationMessages.length).toBe(2);
    expect(result.documentChunks.length).toBe(1);
    expect(result.faqs.length).toBe(1);
    expect(result.trimmed.historyDropped).toBe(0);
    expect(result.trimmed.chunksDropped).toBe(0);
    expect(result.trimmed.faqsDropped).toBe(0);
  });

  it('trims history when over budget', () => {
    const longMsg = 'x'.repeat(500);
    const input = {
      conversationMessages: Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: longMsg,
      })),
      documentChunks: [],
      faqs: [],
      currentUserMessage: 'last',
      budget: { systemMaxTokens: 2000, userMaxTokens: 1200, reservedUserTokens: 400 },
    };
    const result = assembleContextWithBudget(input);
    expect(result.conversationMessages.length).toBeLessThan(30);
    expect(result.trimmed.historyDropped).toBeGreaterThan(0);
  });

  it('returns tokenCounts and trimmed counts', () => {
    const result = assembleContextWithBudget({
      conversationMessages: [{ role: 'user', content: 'a' }],
      documentChunks: [],
      faqs: [],
      currentUserMessage: 'b',
    });
    expect(result.tokenCounts.currentMessage).toBeGreaterThan(0);
    expect(result.tokenCounts.totalUserEstimate).toBeGreaterThan(0);
  });
});
