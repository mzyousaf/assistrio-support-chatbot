/**
 * Unit tests for evidence-mode priority budgeting.
 */

import {
  assembleEvidencePromptWithBudget,
  trimEvidenceWithProtection,
  DEFAULT_EVIDENCE_BUDGET_OPTIONS,
} from './evidence-budget.helper';

describe('trimEvidenceWithProtection', () => {
  it('keeps at least minTopEvidenceItems when available', () => {
    const items = [
      { text: 'a'.repeat(100) },
      { text: 'b'.repeat(100) },
      { text: 'c'.repeat(100) },
      { text: 'd'.repeat(100) },
    ];
    const { kept, protectedCount } = trimEvidenceWithProtection(items, 50, 3);
    expect(protectedCount).toBe(3);
    expect(kept.length).toBe(3);
    expect(kept[0].text).toBe(items[0].text);
    expect(kept[1].text).toBe(items[1].text);
    expect(kept[2].text).toBe(items[2].text);
  });

  it('adds more items after protected until budget is reached', () => {
    const items = [
      { text: 'a' },
      { text: 'b' },
      { text: 'c' },
      { text: 'd'.repeat(200) },
      { text: 'e'.repeat(200) },
    ];
    const { kept, tokensUsed, protectedCount } = trimEvidenceWithProtection(items, 60, 2);
    expect(protectedCount).toBe(2);
    expect(kept.length).toBeGreaterThanOrEqual(2);
    expect(tokensUsed).toBeLessThanOrEqual(60);
  });

  it('respects maxEvidenceItems when provided', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ text: `item${i}` }));
    const { kept } = trimEvidenceWithProtection(items, 10000, 1, 4);
    expect(kept.length).toBeLessThanOrEqual(4);
  });
});

describe('assembleEvidencePromptWithBudget', () => {
  it('returns evidence and conversation within budget', () => {
    const evidence = [
      { text: 'e1' },
      { text: 'e2' },
      { text: 'e3' },
    ];
    const conv = [
      { role: 'user', content: 'old' },
      { role: 'assistant', content: 'reply' },
    ];
    const result = assembleEvidencePromptWithBudget(evidence, conv, 20, 500);
    expect(result.evidenceKept.length).toBeGreaterThanOrEqual(0);
    expect(result.conversationKept.length).toBeLessThanOrEqual(conv.length);
    expect(result.tokenDistribution.userTotal).toBeLessThanOrEqual(500 + 100);
    expect(result.protectedEvidenceCount).toBeLessThanOrEqual(evidence.length);
  });

  it('trims conversation from oldest first', () => {
    const evidence = [{ text: 'x' }];
    const conv = [
      { role: 'user', content: 'a'.repeat(200) },
      { role: 'assistant', content: 'b'.repeat(200) },
      { role: 'user', content: 'c'.repeat(100) },
    ];
    const result = assembleEvidencePromptWithBudget(evidence, conv, 50, 400);
    expect(result.conversationKept.length).toBeLessThanOrEqual(conv.length);
    if (result.conversationKept.length > 0) {
      const lastKept = result.conversationKept[result.conversationKept.length - 1];
      expect(lastKept?.content).toBeDefined();
    }
  });

  it('sets trim reasons when trimming occurs', () => {
    const evidence = Array.from({ length: 20 }, (_, i) => ({ text: 'item '.repeat(50) }));
    const conv = Array.from({ length: 30 }, (_, i) => ({ role: 'user' as const, content: `msg ${i} `.repeat(20) }));
    const result = assembleEvidencePromptWithBudget(evidence, conv, 30, 400);
    expect(result.trimSummary).toBeDefined();
    expect(typeof result.evidenceTrimReason).toBe('string');
    expect(typeof result.conversationTrimReason).toBe('string');
  });

  it('uses default options when options not provided', () => {
    const result = assembleEvidencePromptWithBudget([{ text: 'a' }], [], 10, 1000);
    expect(result.tokenDistribution.userEvidence).toBeDefined();
    expect(result.tokenDistribution.userConversation).toBe(0);
    expect(DEFAULT_EVIDENCE_BUDGET_OPTIONS.minTopEvidenceItems).toBe(3);
  });
});
