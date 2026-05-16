import { describe, expect, it } from 'vitest';
import type { CustomerConversationMessage } from '@/api/types';
import { buildConversationSpeechUsageSummary } from './conversationSpeechUsageSummary';

describe('buildConversationSpeechUsageSummary', () => {
  it('ignores assistant messages', () => {
    const messages: CustomerConversationMessage[] = [
      {
        id: '1',
        messageId: '1',
        role: 'assistant',
        content: 'Hi',
        text: 'Hi',
        createdAt: '2024-01-01T00:00:00.000Z',
        inputType: 'voice',
        creditCost: 2,
      },
    ];
    const s = buildConversationSpeechUsageSummary(messages);
    expect(s.voiceMessageCount).toBe(0);
    expect(s.hasAnySpeechUsage).toBe(false);
  });

  it('classifies voice user message and sums credits', () => {
    const messages: CustomerConversationMessage[] = [
      {
        id: '1',
        messageId: '1',
        role: 'user',
        content: 'hello',
        text: 'hello',
        createdAt: '2024-01-01T00:00:00.000Z',
        inputType: 'voice',
        creditCost: 1.5,
        voiceMeta: {
          speechToTextWords: 2,
          speechToTextCharacters: 10,
          speechDurationSeconds: 3,
          transcriptionStatus: 'success',
        },
      },
    ];
    const s = buildConversationSpeechUsageSummary(messages);
    expect(s.voiceMessageCount).toBe(1);
    expect(s.dictationMessageCount).toBe(0);
    expect(s.voiceCreditsUsed).toBe(1.5);
    expect(s.totalSpeechToTextWords).toBe(2);
    expect(s.transcriptionSuccessCount).toBe(1);
    expect(s.hasAnySpeechUsage).toBe(true);
  });

  it('when both voice and dictation flags, counts once toward voice and credits go to voice', () => {
    const messages: CustomerConversationMessage[] = [
      {
        id: '1',
        messageId: '1',
        role: 'user',
        content: 'x',
        text: 'x',
        createdAt: '2024-01-01T00:00:00.000Z',
        inputType: 'voice',
        creditCost: 2,
        voiceMeta: {
          isVoiceMessage: true,
          isDictationMessage: true,
          dictationDurationSeconds: 4,
          speechDurationSeconds: 1,
        },
      },
    ];
    const s = buildConversationSpeechUsageSummary(messages);
    expect(s.voiceMessageCount).toBe(1);
    expect(s.dictationMessageCount).toBe(0);
    expect(s.voiceCreditsUsed).toBe(2);
    expect(s.totalSpeechDurationSeconds).toBe(1);
    expect(s.totalDictationDurationSeconds).toBe(4);
  });
});
