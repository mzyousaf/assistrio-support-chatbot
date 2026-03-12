/**
 * Unit tests for token budget helpers.
 */

import {
  estimateTokens,
  trimChunksToBudget,
  trimConversationToBudget,
  trimEvidenceToTokenBudget,
} from './token-budget.helper';

describe('estimateTokens', () => {
  it('returns 0 for empty or non-string', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null as unknown as string)).toBe(0);
  });

  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});

describe('trimConversationToBudget', () => {
  it('keeps recent messages within budget', () => {
    const messages = [
      { role: 'user', content: 'a'.repeat(100) },
      { role: 'assistant', content: 'b'.repeat(100) },
      { role: 'user', content: 'c'.repeat(100) },
    ];
    const trimmed = trimConversationToBudget(messages, 50);
    expect(trimmed.length).toBeLessThanOrEqual(messages.length);
    expect(trimmed.length).toBeGreaterThan(0);
  });

  it('preserves order (newest at end)', () => {
    const messages = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: 'third' },
    ];
    const trimmed = trimConversationToBudget(messages, 100);
    expect(trimmed[0].content).toBe('first');
    expect(trimmed[trimmed.length - 1].content).toBe('third');
  });
});

describe('trimChunksToBudget', () => {
  it('drops lowest-priority chunks when over budget', () => {
    const chunks = [
      { text: 'a'.repeat(200), score: 0.9 },
      { text: 'b'.repeat(200), score: 0.5 },
      { text: 'c'.repeat(200), score: 0.3 },
    ];
    const trimmed = trimChunksToBudget(chunks, 100);
    expect(trimmed.length).toBeLessThan(chunks.length);
    expect(trimmed[0].text).toBe('a'.repeat(200));
  });

  it('returns empty when budget is 0', () => {
    const trimmed = trimChunksToBudget([{ text: 'hello', score: 1 }], 0);
    expect(trimmed.length).toBe(0);
  });
});

describe('trimEvidenceToTokenBudget', () => {
  it('keeps items in rank order until budget is exceeded', () => {
    const items = [
      { text: 'a'.repeat(80) },
      { text: 'b'.repeat(80) },
      { text: 'c'.repeat(80) },
    ];
    const { kept, trimmedOut, tokensUsed } = trimEvidenceToTokenBudget(items, 50);
    expect(kept.length).toBeLessThanOrEqual(items.length);
    expect(trimmedOut.length + kept.length).toBe(items.length);
    expect(tokensUsed).toBeLessThanOrEqual(50);
  });

  it('returns all items when under budget', () => {
    const items = [{ text: 'short' }, { text: 'also short' }];
    const { kept, trimmedOut } = trimEvidenceToTokenBudget(items, 100);
    expect(kept.length).toBe(2);
    expect(trimmedOut.length).toBe(0);
  });
});
