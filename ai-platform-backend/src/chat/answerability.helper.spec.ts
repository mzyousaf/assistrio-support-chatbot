/**
 * Unit tests for answerability and fallback logic.
 */

import {
  classifyQuestion,
  evaluateEvidenceStrength,
  computeAnswerabilityContext,
} from './answerability.helper';
import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';

function mkItem(combinedScore: number, id = 'x'): RankedKnowledgeItem {
  return {
    id,
    botId: 'b',
    sourceType: 'document',
    sourceId: 's',
    title: 'T',
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

describe('classifyQuestion', () => {
  it('classifies greetings and short greetings', () => {
    expect(classifyQuestion('Hi')).toBe('greeting_small_talk');
    expect(classifyQuestion('Hello there!')).toBe('greeting_small_talk');
    expect(classifyQuestion('Good morning')).toBe('greeting_small_talk');
  });

  it('classifies company factual questions', () => {
    expect(classifyQuestion('What are your opening hours?')).toBe('company_factual');
    expect(classifyQuestion('How much does it cost?')).toBe('company_factual');
    expect(classifyQuestion('What is your refund policy?')).toBe('company_factual');
  });

  it('classifies open-ended advice', () => {
    expect(classifyQuestion('How can I get help?')).toBe('open_ended_advice');
    expect(classifyQuestion('What should I do?')).toBe('open_ended_advice');
  });

  it('returns unclear for very short input', () => {
    expect(classifyQuestion('ab')).toBe('unclear_underspecified_factual');
  });

  it('returns general_conversational for other messages', () => {
    expect(classifyQuestion('Tell me more about something')).toBe('general_conversational');
  });
});

describe('evaluateEvidenceStrength', () => {
  it('returns zeros when no items', () => {
    const s = evaluateEvidenceStrength([]);
    expect(s.topCombinedScore).toBe(0);
    expect(s.scoreGap).toBe(0);
    expect(s.evidenceItemCount).toBe(0);
  });

  it('computes top score and gap from ranked items', () => {
    const items = [mkItem(0.6), mkItem(0.3), mkItem(0.2)];
    const s = evaluateEvidenceStrength(items);
    expect(s.topCombinedScore).toBe(0.6);
    expect(s.scoreGap).toBe(0.3);
    expect(s.evidenceItemCount).toBe(3);
  });

  it('sets hasStrongMatchSignal when top score is high or gap is clear', () => {
    expect(evaluateEvidenceStrength([mkItem(0.55)]).hasStrongMatchSignal).toBe(true);
    expect(evaluateEvidenceStrength([mkItem(0.2), mkItem(0.02)]).hasStrongMatchSignal).toBe(true);
  });
});

describe('computeAnswerabilityContext', () => {
  it('sets shouldAnswerGenerally for greeting', () => {
    const ctx = computeAnswerabilityContext('greeting_small_talk', {
      topCombinedScore: 0,
      scoreGap: 0,
      evidenceItemCount: 0,
    });
    expect(ctx.shouldAnswerGenerally).toBe(true);
    expect(ctx.shouldUseFallback).toBe(false);
    expect(ctx.companySpecificQuestion).toBe(false);
  });

  it('sets shouldUseFallback for company factual with no evidence', () => {
    const ctx = computeAnswerabilityContext('company_factual', {
      topCombinedScore: 0,
      scoreGap: 0,
      evidenceItemCount: 0,
    });
    expect(ctx.companySpecificQuestion).toBe(true);
    expect(ctx.shouldUseFallback).toBe(true);
    expect(ctx.evidenceStrongEnough).toBe(false);
  });

  it('sets evidenceStrongEnough and directAnswerLikely for company factual with strong evidence', () => {
    const ctx = computeAnswerabilityContext('company_factual', {
      topCombinedScore: 0.55,
      scoreGap: 0.2,
      evidenceItemCount: 3,
      hasStrongMatchSignal: true,
    });
    expect(ctx.evidenceStrongEnough).toBe(true);
    expect(ctx.directAnswerLikely).toBe(true);
    expect(ctx.shouldUseFallback).toBe(false);
  });

  it('includes decisionExplanation', () => {
    const ctx = computeAnswerabilityContext('company_factual', {
      topCombinedScore: 0,
      scoreGap: 0,
      evidenceItemCount: 0,
    });
    expect(ctx.decisionExplanation).toBeDefined();
    expect(ctx.decisionExplanation.length).toBeGreaterThan(0);
  });
});
