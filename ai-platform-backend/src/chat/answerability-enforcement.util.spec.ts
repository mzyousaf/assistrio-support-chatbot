import {
  deriveFallbackEnforcementReason,
  KNOWLEDGE_SOURCES_FALLBACK_MESSAGE,
  resolveAnswerabilityEnforcedFallbackMessage,
  resolveAnswerabilityFallbackLogReason,
  shouldPersistAssistantSourcesForTurn,
  shouldSkipCompletionForAnswerabilityFallback,
} from './answerability-enforcement.util';
import {
  classifyQuestion,
  computeAnswerabilityContext,
  evaluateEvidenceStrength,
} from './answerability.helper';
import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';

const WELCOME_MESSAGE_PROMPT = 'Give me 5 friendly welcome messages for my website chatbot.';

function mkItem(combinedScore: number, id = 'x', title = 'T'): RankedKnowledgeItem {
  return {
    id,
    botId: 'b',
    sourceType: 'document',
    sourceId: 's',
    title,
    section: undefined,
    text: 'content',
    normalizedText: 'content',
    active: true,
    status: 'ready',
    semanticScore: combinedScore * 0.5,
    lexicalScore: combinedScore * 0.5,
    combinedScore,
  };
}

const WIDGET_ONLY_EVIDENCE: RankedKnowledgeItem[] = [
  mkItem(0.42, 'w1', 'Website Chat Widget'),
  mkItem(0.39, 'w2', 'AI Customer Support Chatbot'),
];

describe('answerability enforcement helpers', () => {
  it('skips completion when shouldUseFallback is true', () => {
    expect(shouldSkipCompletionForAnswerabilityFallback(true)).toBe(true);
    expect(shouldSkipCompletionForAnswerabilityFallback(false)).toBe(false);
  });

  it('does not persist sources when fallback is enforced', () => {
    expect(shouldPersistAssistantSourcesForTurn(true)).toBe(false);
    expect(shouldPersistAssistantSourcesForTurn(false)).toBe(true);
  });

  it('uses knowledge-sources fallback copy', () => {
    expect(resolveAnswerabilityEnforcedFallbackMessage()).toBe(KNOWLEDGE_SOURCES_FALLBACK_MESSAGE);
    expect(KNOWLEDGE_SOURCES_FALLBACK_MESSAGE).toContain('available knowledge sources');
  });

  it('uses clear log reason for enforced answerability fallback', () => {
    expect(resolveAnswerabilityFallbackLogReason(true, 'knowledge_only_creative_request')).toBe(
      'knowledge_only_creative_request',
    );
    expect(resolveAnswerabilityFallbackLogReason(true)).toBe('answerability_fallback_enforced');
    expect(resolveAnswerabilityFallbackLogReason(false)).toBeUndefined();
  });

  it('derives knowledge_only_creative_request for generative welcome prompts', () => {
    const ctx = computeAnswerabilityContext(
      classifyQuestion(WELCOME_MESSAGE_PROMPT),
      evaluateEvidenceStrength(WIDGET_ONLY_EVIDENCE),
      WELCOME_MESSAGE_PROMPT,
      { answerMode: 'knowledge_only', evidenceItems: WIDGET_ONLY_EVIDENCE },
    );
    expect(ctx.shouldUseFallback).toBe(true);
    expect(
      deriveFallbackEnforcementReason('knowledge_only', ctx, WELCOME_MESSAGE_PROMPT),
    ).toBe('knowledge_only_creative_request');
  });
});
