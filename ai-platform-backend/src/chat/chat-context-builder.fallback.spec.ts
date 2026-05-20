import { buildChatKnowledgeContext, formatPromptFromContext } from './chat-context-builder';
import { KNOWLEDGE_SOURCES_FALLBACK_MESSAGE } from './answerability-enforcement.util';

const WELCOME_MESSAGE_PROMPT = 'Give me 5 friendly welcome messages for my website chatbot.';

const disabledLeadCapture = {
  enabled: false,
  requiredFields: [] as string[],
  optionalFields: [] as string[],
  collected: {},
  missingRequired: [] as string[],
  shouldAskNow: false,
  fieldLabels: {},
};

describe('formatPromptFromContext (answerability fallback)', () => {
  const evidence = [
    {
      sourceType: 'document' as const,
      title: 'Website Chat Widget',
      text: 'Embed a chat widget on your site.',
    },
  ];

  it('omits encouraging evidence wording when shouldUseFallback is true', () => {
    const ctx = buildChatKnowledgeContext({
      botName: 'Bot',
      leadCapture: disabledLeadCapture,
      conversationMessages: [],
      currentUserMessage: WELCOME_MESSAGE_PROMPT,
      retrievalConfidence: 'medium',
      documentDirectAnswerLikely: true,
      unifiedEvidence: evidence,
      answerability: {
        evidenceStrongEnough: true,
        directAnswerLikely: false,
        shouldUseFallback: true,
        shouldAnswerGenerally: false,
      },
      answerMode: 'knowledge_only',
    });
    const { userPrompt } = formatPromptFromContext(ctx);
    expect(userPrompt).not.toContain('Do not refuse when the evidence contains');
    expect(userPrompt).toContain('does not directly support this request');
    expect(userPrompt).toContain('Do not create examples, copy, templates, or suggestions');
    expect(userPrompt).toContain(KNOWLEDGE_SOURCES_FALLBACK_MESSAGE);
  });

  it('keeps standard evidence guidance when shouldUseFallback is false', () => {
    const ctx = buildChatKnowledgeContext({
      botName: 'Bot',
      leadCapture: disabledLeadCapture,
      conversationMessages: [],
      currentUserMessage: 'What are your opening hours?',
      retrievalConfidence: 'high',
      documentDirectAnswerLikely: true,
      unifiedEvidence: evidence,
      answerability: {
        evidenceStrongEnough: true,
        directAnswerLikely: true,
        shouldUseFallback: false,
        shouldAnswerGenerally: false,
      },
      answerMode: 'knowledge_first',
    });
    const { userPrompt } = formatPromptFromContext(ctx);
    expect(userPrompt).toContain('Do not refuse when the evidence contains');
  });
});
