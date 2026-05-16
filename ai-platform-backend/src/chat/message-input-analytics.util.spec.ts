import type { MessageSpeechInput } from '../models/message.schema';
import type { ExampleQuestionDoc } from '../workspace/shared/example-questions.util';
import {
  deriveSpeechTextStats,
  inferSuggestedQuestionForFirstTurn,
  messageInputRouteDefaultsFromRunChatInput,
  parseMessageAnalyticsFromUnknown,
  resolveMessageInputAnalytics,
  sanitizeVoiceMetaForPersistence,
} from './message-input-analytics.util';

describe('parseMessageAnalyticsFromUnknown', () => {
  it('strips billing-related keys', () => {
    const p = parseMessageAnalyticsFromUnknown({
      inputType: 'text',
      creditCost: 99,
      billingType: 'x',
      voiceMeta: { creditReason: 'y', isVoiceMessage: true },
    });
    expect(p?.inputType).toBe('text');
    expect((p?.voiceMeta as { creditReason?: string })?.creditReason).toBeUndefined();
  });
});

describe('resolveMessageInputAnalytics', () => {
  const kbSid = '507f1f77bcf86cd799439011';

  it('uses text + keyboard when metadata missing', () => {
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
    });
    expect(r).toEqual({ inputType: 'text', inputMethod: 'keyboard' });
  });

  it('uses text + api for workspace route default', () => {
    const r = resolveMessageInputAnalytics({
      routeDefault: messageInputRouteDefaultsFromRunChatInput({
        conversationOrigin: { embedType: 'workspace_chat' },
      }),
    });
    expect(r).toEqual({ inputType: 'text', inputMethod: 'api' });
  });

  it('falls back on invalid client enums', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: { inputType: 'nope', inputMethod: 'bogus' },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
    });
    expect(r.inputType).toBe('text');
    expect(r.inputMethod).toBe('keyboard');
  });

  it('keeps text input type when attachments are present (method becomes file_upload)', () => {
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      hasAttachments: true,
      text: 'Hey',
    });
    expect(r).toMatchObject({ inputType: 'text', inputMethod: 'file_upload' });
  });

  it('keeps dictation when files are present with dictate transcript', () => {
    const speech: MessageSpeechInput = { mode: 'dictate', transcript: 'Note' };
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      speechInput: speech,
      hasAttachments: true,
      text: 'Note',
    });
    expect(r.inputType).toBe('dictation');
    expect(r.inputMethod).toBe('microphone_transcription');
  });

  it('preserves client suggested_question', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: { inputType: 'suggested_question', inputMethod: 'suggested_question' },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      hasAttachments: false,
    });
    expect(r.inputType).toBe('suggested_question');
    expect(r.inputMethod).toBe('suggested_question');
  });

  it('preserves client quick_reply', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: { inputType: 'quick_reply', inputMethod: 'quick_reply' },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
    });
    expect(r.inputType).toBe('quick_reply');
    expect(r.inputMethod).toBe('quick_reply');
  });

  it('sets dictation from speechInput dictate transcript (legacy: Whisper / microphone)', () => {
    const speech: MessageSpeechInput = { mode: 'dictate', transcript: 'Hello world' };
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      speechInput: speech,
      text: 'Hello world',
    });
    expect(r.inputType).toBe('dictation');
    expect(r.inputMethod).toBe('microphone_transcription');
    expect(r.voiceMeta?.isDictationMessage).toBe(true);
    expect(r.voiceMeta?.transcriptionProvider).toBe('whisper');
    expect(r.voiceMeta?.speechToTextCharacters).toBe(11);
    expect(r.voiceMeta?.speechToTextWords).toBe(2);
  });

  it('sets dictation browser method when speechInput declares browser_speech_recognition', () => {
    const speech: MessageSpeechInput = {
      mode: 'dictate',
      transcript: 'Hello world',
      dictationProvider: 'browser_speech_recognition',
    };
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      speechInput: speech,
      text: 'Hello world',
    });
    expect(r.inputType).toBe('dictation');
    expect(r.inputMethod).toBe('browser_speech_recognition');
    expect(r.voiceMeta?.transcriptionProvider).toBe('browser_speech_recognition');
  });

  it('sets voice from speechInput voice with audio', () => {
    const speech: MessageSpeechInput = {
      mode: 'voice',
      audioUrl: 'https://cdn.example/a.mp3',
      transcript: 'Hi',
      mimeType: 'audio/mpeg',
      durationMs: 5000,
    };
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      speechInput: speech,
      text: 'Hi',
    });
    expect(r.inputType).toBe('voice');
    expect(r.inputMethod).toBe('microphone');
    expect(r.voiceMeta?.isVoiceMessage).toBe(true);
    expect(r.voiceMeta?.audioDurationSeconds).toBe(5);
    expect(r.voiceMeta?.transcriptionProvider).toBe('whisper');
  });

  it('browser_speech_recognition implies dictation when type not voice', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: { inputType: 'text', inputMethod: 'browser_speech_recognition' },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
    });
    expect(r.inputType).toBe('dictation');
    expect(r.voiceMeta?.isDictationMessage).toBe(true);
  });

  it('microphone_transcription without inputType resolves to dictation', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: {
        inputMethod: 'microphone_transcription',
        voiceMeta: { isDictationMessage: true, transcriptionProvider: 'whisper', transcriptionStatus: 'success' },
      },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      text: 'Hello',
    });
    expect(r.inputType).toBe('dictation');
    expect(r.inputMethod).toBe('microphone_transcription');
    expect(r.voiceMeta?.isDictationMessage).toBe(true);
    expect(r.voiceMeta?.transcriptionProvider).toBe('whisper');
  });

  it('accepts Whisper dictation client payload dictation + microphone_transcription', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: {
        inputType: 'dictation',
        inputMethod: 'microphone_transcription',
        voiceMeta: {
          isDictationMessage: true,
          transcriptionProvider: 'whisper',
          transcriptionStatus: 'success',
          speechToTextCharacters: 3,
          speechToTextWords: 1,
        },
      },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      text: 'hey',
    });
    expect(r.inputType).toBe('dictation');
    expect(r.inputMethod).toBe('microphone_transcription');
    expect(r.voiceMeta?.isDictationMessage).toBe(true);
    expect(r.voiceMeta?.transcriptionProvider).toBe('whisper');
  });

  it('infers suggested_question on first turn with KB suggestionId', () => {
    const r = resolveMessageInputAnalytics({
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      inferredSuggestedQuestion: inferSuggestedQuestionForFirstTurn({
        priorUserMessageCount: 0,
        suggestionId: kbSid,
        messageForMatch: 'Any text',
        exampleQuestions: [],
      }),
    });
    expect(r.inputType).toBe('suggested_question');
    expect(r.inputMethod).toBe('suggested_question');
  });

  it('derives speech stats from message text when missing in voiceMeta', () => {
    const r = resolveMessageInputAnalytics({
      messageAnalytics: { inputType: 'dictation', inputMethod: 'browser_speech_recognition', voiceMeta: {} },
      routeDefault: { inputType: 'text', inputMethod: 'keyboard' },
      text: 'one two',
    });
    expect(r.voiceMeta?.speechToTextCharacters).toBe(7);
    expect(r.voiceMeta?.speechToTextWords).toBe(2);
  });
});

describe('sanitizeVoiceMetaForPersistence', () => {
  it('clamps numeric fields', () => {
    const v = sanitizeVoiceMetaForPersistence({
      speechToTextCharacters: 999999999,
      audioDurationSeconds: 99999,
      audioSizeBytes: 200 * 1024 * 1024,
      transcriptionStatus: 'success',
    });
    expect(v?.speechToTextCharacters).toBe(100000);
    expect(v?.audioDurationSeconds).toBe(3600);
    expect(v?.audioSizeBytes).toBe(100 * 1024 * 1024);
  });

  it('drops invalid transcriptionStatus', () => {
    const v = sanitizeVoiceMetaForPersistence({
      transcriptionStatus: 'hacked',
      isVoiceMessage: true,
    });
    expect(v?.transcriptionStatus).toBeUndefined();
    expect(v?.isVoiceMessage).toBe(true);
  });
});

describe('deriveSpeechTextStats', () => {
  it('counts words', () => {
    expect(deriveSpeechTextStats('  a  b  c ')).toEqual({ chars: 10, words: 3 });
  });
});

describe('inferSuggestedQuestionForFirstTurn', () => {
  const kbSuggestionId = '507f1f77bcf86cd799439011';
  const questions: ExampleQuestionDoc[] = [{ label: 'Pricing?', context: 'scope' }];

  it('returns false when not first user turn', () => {
    expect(
      inferSuggestedQuestionForFirstTurn({
        priorUserMessageCount: 1,
        suggestionId: kbSuggestionId,
        messageForMatch: 'x',
        exampleQuestions: questions,
      }),
    ).toBe(false);
  });

  it('matches legacy label on first turn', () => {
    expect(
      inferSuggestedQuestionForFirstTurn({
        priorUserMessageCount: 0,
        messageForMatch: 'Pricing?',
        exampleQuestions: questions,
      }),
    ).toBe(true);
  });
});
