import {
  buildConversationTurnAnalyticsPatch,
  mergeLeadFieldKeys,
  resolveUserInputTypeCounterKey,
  userTurnFlags,
} from './conversation-turn-analytics.util';

describe('resolveUserInputTypeCounterKey', () => {
  it('counts voice via meta over text inputType', () => {
    expect(
      resolveUserInputTypeCounterKey({ inputType: 'text', voiceMeta: { isVoiceMessage: true } }),
    ).toBe('voiceMessageCount');
  });
  it('suggested_question', () => {
    expect(resolveUserInputTypeCounterKey({ inputType: 'suggested_question' })).toBe(
      'suggestedQuestionMessageCount',
    );
  });
  it('quick_reply', () => {
    expect(resolveUserInputTypeCounterKey({ inputType: 'quick_reply' })).toBe('quickReplyMessageCount');
  });
  it('attachment-only maps to attachmentMessageCount', () => {
    expect(
      resolveUserInputTypeCounterKey({ inputType: 'attachment', hasAttachments: false, hasTextContent: false }),
    ).toBe('attachmentMessageCount');
  });
  it('unknown maps to text bucket', () => {
    expect(resolveUserInputTypeCounterKey({ inputType: 'unknown' })).toBe('textMessageCount');
  });
  it('text + attachments still bills text modality', () => {
    expect(
      resolveUserInputTypeCounterKey({
        inputType: 'text',
        hasAttachments: true,
        hasTextContent: true,
      }),
    ).toBe('textMessageCount');
  });
});

describe('userTurnFlags', () => {
  it('sets hasVoice for voice inputType', () => {
    expect(userTurnFlags({ inputType: 'voice' })).toEqual({ hasVoice: true });
  });
  it('sets hasDictation', () => {
    expect(userTurnFlags({ inputType: 'dictation' })).toEqual({ hasDictation: true });
  });
  it('sets hasAttachment when inputType is attachment without files array', () => {
    expect(userTurnFlags({ inputType: 'attachment', attachmentCount: 0 })).toEqual({ hasAttachment: true });
  });
  it('sets hasAttachment when attachmentCount > 0', () => {
    expect(userTurnFlags({ inputType: 'text', attachmentCount: 1 })).toEqual({ hasAttachment: true });
  });
});

describe('buildConversationTurnAnalyticsPatch', () => {
  const userAt = new Date('2026-06-01T10:00:00.000Z');
  const asstAt = new Date('2026-06-01T10:00:05.000Z');

  it('text message increments user, assistant, total, text, credits', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: {
        createdAt: userAt,
        inputType: 'text',
        hasTextContent: true,
        creditCost: 1,
      },
      assistantMessage: { createdAt: asstAt, sources: [] },
      conversationBefore: {},
    });
    expect(p.$inc).toMatchObject({
      totalUserMessages: 1,
      totalAssistantMessages: 1,
      totalMessages: 2,
      textMessageCount: 1,
      totalCreditsUsed: 1,
      sourcesUsedCount: 0,
    });
    expect((p.$set as Record<string, unknown>).lastMessageAt).toEqual(asstAt);
    expect((p.$set as Record<string, unknown>).firstUserMessageAt).toEqual(userAt);
  });

  it('text + attachment increments both textMessageCount and attachmentMessageCount', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: {
        createdAt: userAt,
        inputType: 'text',
        inputMethod: 'file_upload',
        hasTextContent: true,
        attachmentCount: 1,
        creditCost: 1,
      },
      assistantMessage: { createdAt: asstAt, sources: [] },
      conversationBefore: {},
    });
    expect(p.$inc).toMatchObject({
      textMessageCount: 1,
      attachmentMessageCount: 1,
      totalCreditsUsed: 1,
    });
  });

  it('assistant increments sourcesUsedCount', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: { createdAt: userAt, inputType: 'text', hasTextContent: true, creditCost: 1 },
      assistantMessage: {
        createdAt: asstAt,
        sources: [{ chunkId: 'a' }, { chunkId: 'b' }] as never[],
      },
      conversationBefore: { firstUserMessageAt: userAt },
    });
    expect((p.$inc as Record<string, number>).sourcesUsedCount).toBe(2);
    expect((p.$set as Record<string, unknown>).firstUserMessageAt).toBeUndefined();
  });

  it('voice increments voiceMessageCount and attachmentMessageCount when files attach', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: {
        createdAt: userAt,
        inputType: 'voice',
        attachmentCount: 1,
        creditCost: 2,
      },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: {},
    });
    expect((p.$inc as Record<string, number>).voiceMessageCount).toBe(1);
    expect((p.$inc as Record<string, number>).attachmentMessageCount).toBe(1);
    expect((p.$set as Record<string, unknown>).hasVoice).toBe(true);
  });

  it('dictation + attachment increments text + dictation + attachment when transcript present', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: {
        createdAt: userAt,
        inputType: 'dictation',
        voiceMeta: { isDictationMessage: true },
        attachmentCount: 2,
        hasTextContent: true,
        creditCost: 2,
      },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: {},
    });
    expect((p.$inc as Record<string, number>).dictationMessageCount).toBe(1);
    expect((p.$inc as Record<string, number>).attachmentMessageCount).toBe(1);
    expect((p.$inc as Record<string, number>).textMessageCount).toBe(1);
  });

  it('dictation increments dictationMessageCount', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: {
        createdAt: userAt,
        inputType: 'dictation',
        voiceMeta: { isDictationMessage: true },
        hasTextContent: true,
        creditCost: 3,
      },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: {},
    });
    expect((p.$inc as Record<string, number>).dictationMessageCount).toBe(1);
    expect((p.$inc as Record<string, number>).textMessageCount).toBe(1);
    expect((p.$set as Record<string, unknown>).hasDictation).toBe(true);
  });

  it('attachment-only increments attachment bucket only when credit is 0', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: { createdAt: userAt, inputType: 'attachment', attachmentCount: 1, creditCost: 0 },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: {},
    });
    expect((p.$inc as Record<string, number>).attachmentMessageCount).toBe(1);
    expect((p.$inc as Record<string, unknown>).textMessageCount).toBeUndefined();
    expect((p.$set as Record<string, unknown>).hasAttachment).toBe(true);
  });

  it('missing creditCost counts as 0', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: { createdAt: userAt, inputType: 'text', hasTextContent: true },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: {},
    });
    expect((p.$inc as Record<string, number>).totalCreditsUsed).toBe(0);
  });

  it('firstUserMessageAt only when missing before', () => {
    const existing = new Date('2025-01-01T00:00:00.000Z');
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: { createdAt: userAt, inputType: 'text', hasTextContent: true },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: { firstUserMessageAt: existing },
    });
    expect((p.$set as Record<string, unknown>).firstUserMessageAt).toBeUndefined();
  });

  it('timestamps: lastUserMessageAt, lastAssistantMessageAt, lastMessageAt, lastActivityAt', () => {
    const p = buildConversationTurnAnalyticsPatch({
      userMessage: { createdAt: userAt, inputType: 'text', hasTextContent: true },
      assistantMessage: { createdAt: asstAt },
      conversationBefore: { firstUserMessageAt: userAt },
    });
    const s = p.$set as Record<string, unknown>;
    expect(s.lastUserMessageAt).toEqual(userAt);
    expect(s.lastAssistantMessageAt).toEqual(asstAt);
    expect(s.lastMessageAt).toEqual(asstAt);
    expect(s.lastActivityAt).toEqual(asstAt);
  });
});

describe('mergeLeadFieldKeys', () => {
  it('merges and dedupes sorted', () => {
    expect(mergeLeadFieldKeys(['b', 'a'], ['a', 'c'])).toEqual(['a', 'b', 'c']);
  });
  it('handles empty existing', () => {
    expect(mergeLeadFieldKeys(undefined, ['email'])).toEqual(['email']);
  });
});
