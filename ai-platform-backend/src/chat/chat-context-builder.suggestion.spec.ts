import { buildChatKnowledgeContext, formatPromptFromContext } from './chat-context-builder';

describe('formatPromptFromContext (suggestion-scoped turns)', () => {
  it('uses selected-suggestion instructions when evidence exists', () => {
    const ctx = buildChatKnowledgeContext({
      botName: 'B',
      leadCapture: {
        enabled: false,
        requiredFields: [],
        optionalFields: [],
        collected: {},
        missingRequired: [],
        shouldAskNow: false,
        fieldLabels: {},
      },
      conversationMessages: [],
      currentUserMessage: 'Hello',
      unifiedEvidence: [
        { sourceType: 'suggestion', title: 'Chip', text: 'Only this.', section: undefined },
      ],
      suggestionScopeOnly: true,
    });
    const { userPrompt } = formatPromptFromContext(ctx);
    expect(userPrompt).toContain('--- Selected suggestion context (this turn only) ---');
    expect(userPrompt).toContain('Do not use the full knowledge base');
    expect(userPrompt).toContain('Only this.');
  });

  it('uses insufficient-context instructions when scope is on but there is no evidence', () => {
    const ctx = buildChatKnowledgeContext({
      botName: 'B',
      leadCapture: {
        enabled: false,
        requiredFields: [],
        optionalFields: [],
        collected: {},
        missingRequired: [],
        shouldAskNow: false,
        fieldLabels: {},
      },
      conversationMessages: [],
      currentUserMessage: 'Hello',
      unifiedEvidence: [],
      suggestionScopeOnly: true,
    });
    const { userPrompt } = formatPromptFromContext(ctx);
    expect(userPrompt).toContain('No retrievable context is available for this suggestion');
    expect(userPrompt).not.toContain('--- Retrieved Knowledge Evidence ---');
  });
});
