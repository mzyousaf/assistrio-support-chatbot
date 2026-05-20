import { buildSystemPrompt } from './system-prompt.builder';
import {
  classifyQuestion,
  computeAnswerabilityContext,
  evaluateEvidenceStrength,
} from './answerability.helper';
import { formatPromptFromContext } from './chat-context-builder';
import { buildChatKnowledgeContext } from './chat-context-builder';

const QUESTION = 'Explain what Assistrio does and include its main features.';

const evidence = [
  {
    sourceType: 'document',
    title: 'Introduction to Assistrio Products',
    text:
      'Assistrio is an AI-powered customer support platform. Businesses deploy intelligent chatbots trained on their documentation for instant answers.',
  },
  {
    sourceType: 'document',
    title: 'Key Value Proposition',
    text:
      'Main features include knowledge-base training from documents, websites, PDFs, and wikis, 24/7 availability, and consistent answers from company content.',
  },
];

describe('Assistrio overview RAG refusal guard', () => {
  it('does not instruct fallback when overview evidence is present', () => {
    const classification = classifyQuestion(QUESTION);
    const strength = evaluateEvidenceStrength(
      evidence.map((e, i) => ({
        id: String(i),
        botId: 'b',
        sourceType: 'document' as const,
        sourceId: 's',
        title: e.title,
        text: e.text,
        normalizedText: e.text,
        active: true,
        status: 'ready',
        combinedScore: 0.3 - i * 0.02,
        semanticScore: 0.2,
        lexicalScore: 0.2,
      })),
    );
    const answerability = computeAnswerabilityContext(classification, strength, QUESTION);
    expect(answerability.shouldUseFallback).toBe(false);

    const ctx = buildChatKnowledgeContext({
      botName: 'Assistrio',
      tone: 'friendly',
      responseLength: 'medium',
      maxTokens: 256,
      leadCapture: {
        enabled: false,
        requiredFields: [],
        optionalFields: [],
        collected: {},
        missingRequired: [],
        fieldLabels: {},
        shouldAskNow: false,
      },
      conversationMessages: [],
      currentUserMessage: QUESTION,
      retrievalConfidence: 'medium',
      unifiedEvidence: evidence,
      answerability: {
        evidenceStrongEnough: answerability.evidenceStrongEnough,
        directAnswerLikely: answerability.directAnswerLikely,
        shouldUseFallback: answerability.shouldUseFallback,
        shouldAnswerGenerally: answerability.shouldAnswerGenerally,
      },
    });

    const { systemPrompt, userPrompt } = formatPromptFromContext(ctx);
    expect(systemPrompt).not.toContain('does not clearly support an answer');
    expect(systemPrompt).toContain('synthesize');
    expect(userPrompt).toContain('Introduction to Assistrio Products');
    expect(userPrompt).toContain('Do not refuse');
  });
});
