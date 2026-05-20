/**
 * Unit tests for answerability and fallback logic.
 */

import {
  classifyQuestion,
  computeAnswerabilityContext,
  evaluateEvidenceStrength,
  isCompanyOverviewQuestion,
  isCreativeOrGenerativeRequest,
  isRoughCompanyOverviewIntent,
} from './answerability.helper';
import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';

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

const ASSISTRIO_OVERVIEW_QUESTION =
  'Explain what Assistrio does and include its main features.';

const ASSISTRIO_EVIDENCE: RankedKnowledgeItem[] = [
  mkItem(
    0.32,
    '1',
    'Introduction to Assistrio Products',
  ),
  mkItem(0.28, '2', 'Assistrio Company Information'),
  mkItem(0.26, '3', 'How Assistrio Works'),
  mkItem(0.24, '4', 'Key Value Proposition'),
];

const ASSISTRIO_OVERVIEW_WITH_COMPANY_TITLE: RankedKnowledgeItem[] = [
  mkItem(0.4, 'o1', 'Company Overview'),
  mkItem(0.35, 'o2', 'Introduction to Assistrio Products'),
  mkItem(0.33, 'o3', 'Assistrio Company Information'),
  mkItem(0.31, 'o4', 'How Assistrio Works'),
];

const TYPO_OVERVIEW_QUESTION =
  'Give me What Assitro do and what are its main fearture';

const OVERVIEW_QUESTION_VARIANTS = [
  'What does Assistrio do?',
  'What Assitro do?',
  TYPO_OVERVIEW_QUESTION,
  'Tell me about Assistrio',
  'Explain Assistrio',
  'Assistrio main features',
];

describe('classifyQuestion', () => {
  it('classifies Assistrio overview as company_factual', () => {
    expect(classifyQuestion(ASSISTRIO_OVERVIEW_QUESTION)).toBe('company_factual');
    expect(isCompanyOverviewQuestion(ASSISTRIO_OVERVIEW_QUESTION)).toBe(true);
  });

  it('classifies greetings and short greetings', () => {
    expect(classifyQuestion('Hi')).toBe('greeting_small_talk');
  });

  it('classifies company factual questions', () => {
    expect(classifyQuestion('What are your opening hours?')).toBe('company_factual');
  });

  it('classifies typo/rough overview questions as company_factual', () => {
    expect(classifyQuestion(TYPO_OVERVIEW_QUESTION)).toBe('company_factual');
    expect(isRoughCompanyOverviewIntent(TYPO_OVERVIEW_QUESTION)).toBe(true);
    expect(isCompanyOverviewQuestion(TYPO_OVERVIEW_QUESTION)).toBe(true);
  });

  it.each(OVERVIEW_QUESTION_VARIANTS)('detects overview intent: %s', (question) => {
    expect(isRoughCompanyOverviewIntent(question)).toBe(true);
    expect(classifyQuestion(question)).toBe('company_factual');
  });
});

describe('computeAnswerabilityContext', () => {
  it('does not fallback for Assistrio overview with relevant medium-score chunks', () => {
    const classification = classifyQuestion(ASSISTRIO_OVERVIEW_QUESTION);
    const strength = evaluateEvidenceStrength(ASSISTRIO_EVIDENCE);
    const ctx = computeAnswerabilityContext(classification, strength, ASSISTRIO_OVERVIEW_QUESTION);
    expect(ctx.shouldUseFallback).toBe(false);
    expect(ctx.evidenceStrongEnough).toBe(true);
    expect(ctx.companySpecificQuestion).toBe(true);
  });

  it('still fallbacks for company factual with no evidence', () => {
    const ctx = computeAnswerabilityContext('company_factual', {
      topCombinedScore: 0,
      scoreGap: 0,
      evidenceItemCount: 0,
    });
    expect(ctx.shouldUseFallback).toBe(true);
  });

  it('still fallbacks for company factual with unrelated weak evidence', () => {
    const ctx = computeAnswerabilityContext(
      'company_factual',
      { topCombinedScore: 0.08, scoreGap: 0.01, evidenceItemCount: 1 },
      'What is the exact wire transfer SWIFT code?',
    );
    expect(ctx.shouldUseFallback).toBe(true);
  });

  it('medium confidence with directly relevant chunks should still answer', () => {
    const ctx = computeAnswerabilityContext(
      'company_factual',
      evaluateEvidenceStrength(ASSISTRIO_EVIDENCE),
      ASSISTRIO_OVERVIEW_QUESTION,
    );
    expect(ctx.shouldUseFallback).toBe(false);
    expect(ctx.evidenceStrongEnough).toBe(true);
  });
});

const WELCOME_MESSAGE_PROMPT = 'Give me 5 friendly welcome messages for my website chatbot.';

const WIDGET_ONLY_EVIDENCE: RankedKnowledgeItem[] = [
  mkItem(0.42, 'w1', 'Website Chat Widget'),
  mkItem(0.39, 'w2', 'AI Customer Support Chatbot'),
];

describe('answerMode', () => {
  it('classifies welcome message prompt as creative/generative', () => {
    expect(isCreativeOrGenerativeRequest(WELCOME_MESSAGE_PROMPT)).toBe(true);
    expect(classifyQuestion(WELCOME_MESSAGE_PROMPT)).toBe('general_conversational');
  });

  it('knowledge_first allows welcome messages when related evidence exists', () => {
    const classification = classifyQuestion(WELCOME_MESSAGE_PROMPT);
    const strength = evaluateEvidenceStrength(WIDGET_ONLY_EVIDENCE);
    const ctx = computeAnswerabilityContext(classification, strength, WELCOME_MESSAGE_PROMPT, {
      answerMode: 'knowledge_first',
      evidenceItems: WIDGET_ONLY_EVIDENCE,
    });
    expect(ctx.shouldUseFallback).toBe(false);
  });

  it('knowledge_only fallbacks for welcome messages with only widget docs', () => {
    const classification = classifyQuestion(WELCOME_MESSAGE_PROMPT);
    const strength = evaluateEvidenceStrength(WIDGET_ONLY_EVIDENCE);
    const ctx = computeAnswerabilityContext(classification, strength, WELCOME_MESSAGE_PROMPT, {
      answerMode: 'knowledge_only',
      evidenceItems: WIDGET_ONLY_EVIDENCE,
    });
    expect(ctx.shouldUseFallback).toBe(true);
    expect(ctx.decisionExplanation).toContain('creative/generative');
  });

  it('knowledge_only answers factual KB-supported questions', () => {
    const ctx = computeAnswerabilityContext(
      'company_factual',
      evaluateEvidenceStrength(ASSISTRIO_EVIDENCE),
      ASSISTRIO_OVERVIEW_QUESTION,
      { answerMode: 'knowledge_only', evidenceItems: ASSISTRIO_EVIDENCE },
    );
    expect(ctx.shouldUseFallback).toBe(false);
    expect(ctx.evidenceStrongEnough).toBe(true);
  });

  it('knowledge_only fallbacks for unsupported factual questions', () => {
    const ctx = computeAnswerabilityContext(
      'company_factual',
      { topCombinedScore: 0.05, scoreGap: 0.01, evidenceItemCount: 1 },
      'What is the exact wire transfer SWIFT code?',
      { answerMode: 'knowledge_only', evidenceItems: [mkItem(0.05)] },
    );
    expect(ctx.shouldUseFallback).toBe(true);
  });

  it('knowledge_only answers typo overview with Company Overview evidence', () => {
    const classification = classifyQuestion(TYPO_OVERVIEW_QUESTION);
    const strength = evaluateEvidenceStrength(ASSISTRIO_OVERVIEW_WITH_COMPANY_TITLE);
    const ctx = computeAnswerabilityContext(classification, strength, TYPO_OVERVIEW_QUESTION, {
      answerMode: 'knowledge_only',
      evidenceItems: ASSISTRIO_OVERVIEW_WITH_COMPANY_TITLE,
    });
    expect(classification).toBe('company_factual');
    expect(ctx.shouldUseFallback).toBe(false);
    expect(ctx.decisionExplanation).toContain('overview question with sufficient direct evidence');
  });

  it('knowledge_only answers clean Tell me about Assistrio overview', () => {
    const question = 'Tell me about Assistrio';
    const ctx = computeAnswerabilityContext(
      classifyQuestion(question),
      evaluateEvidenceStrength(ASSISTRIO_OVERVIEW_WITH_COMPANY_TITLE),
      question,
      { answerMode: 'knowledge_only', evidenceItems: ASSISTRIO_OVERVIEW_WITH_COMPANY_TITLE },
    );
    expect(ctx.shouldUseFallback).toBe(false);
    expect(ctx.decisionExplanation).toContain('overview question with sufficient direct evidence');
  });
});
