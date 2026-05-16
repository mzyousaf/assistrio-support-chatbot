import type { CustomerConversationMessage } from '@/api/types';

function num(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n;
  return 0;
}

export type ConversationSpeechUsageSummary = {
  voiceMessageCount: number;
  dictationMessageCount: number;
  voiceCreditsUsed: number;
  dictationCreditsUsed: number;
  totalSpeechDurationSeconds: number;
  totalDictationDurationSeconds: number;
  totalAudioDurationSeconds: number;
  totalSpeechToTextWords: number;
  totalSpeechToTextCharacters: number;
  transcriptionSuccessCount: number;
  transcriptionFailedCount: number;
  hasAnySpeechUsage: boolean;
};

function addVoiceMetaTotals(m: CustomerConversationMessage, acc: ConversationSpeechUsageSummary): void {
  const v = m.voiceMeta;
  if (!v) return;
  if (v.speechDurationSeconds != null && Number.isFinite(v.speechDurationSeconds)) {
    acc.totalSpeechDurationSeconds += v.speechDurationSeconds;
  }
  if (v.dictationDurationSeconds != null && Number.isFinite(v.dictationDurationSeconds)) {
    acc.totalDictationDurationSeconds += v.dictationDurationSeconds;
  }
  if (v.audioDurationSeconds != null && Number.isFinite(v.audioDurationSeconds)) {
    acc.totalAudioDurationSeconds += v.audioDurationSeconds;
  }
  if (v.speechToTextWords != null && Number.isFinite(v.speechToTextWords)) {
    acc.totalSpeechToTextWords += v.speechToTextWords;
  }
  if (v.speechToTextCharacters != null && Number.isFinite(v.speechToTextCharacters)) {
    acc.totalSpeechToTextCharacters += v.speechToTextCharacters;
  }
}

function addSpeechInputDuration(m: CustomerConversationMessage, acc: ConversationSpeechUsageSummary): void {
  const si = m.speechInput;
  if (!si?.durationMs || !Number.isFinite(si.durationMs) || si.durationMs <= 0) return;
  const sec = si.durationMs / 1000;
  if (si.mode === 'voice') acc.totalAudioDurationSeconds += sec;
  if (si.mode === 'dictate') acc.totalDictationDurationSeconds += sec;
}

/**
 * Aggregate voice/dictation usage from loaded workspace messages (user turns only).
 * When both voice and dictation signals are true on one message, credits count toward voice only;
 * duration/word totals still accumulate from metadata.
 */
export function buildConversationSpeechUsageSummary(
  messages: CustomerConversationMessage[] | null | undefined,
): ConversationSpeechUsageSummary {
  const acc: ConversationSpeechUsageSummary = {
    voiceMessageCount: 0,
    dictationMessageCount: 0,
    voiceCreditsUsed: 0,
    dictationCreditsUsed: 0,
    totalSpeechDurationSeconds: 0,
    totalDictationDurationSeconds: 0,
    totalAudioDurationSeconds: 0,
    totalSpeechToTextWords: 0,
    totalSpeechToTextCharacters: 0,
    transcriptionSuccessCount: 0,
    transcriptionFailedCount: 0,
    hasAnySpeechUsage: false,
  };

  if (!messages?.length) {
    return acc;
  }

  for (const m of messages) {
    if ((m.role ?? '').toLowerCase() !== 'user') continue;

    const inputType = (m.inputType ?? '').trim().toLowerCase();
    const siMode = m.speechInput?.mode;
    const vm = m.voiceMeta;

    const isVoice =
      inputType === 'voice' || vm?.isVoiceMessage === true || siMode === 'voice';
    const isDict =
      inputType === 'dictation' || vm?.isDictationMessage === true || siMode === 'dictate';

    if (!isVoice && !isDict) continue;

    const credit = num(m.creditCost);

    if (isVoice && isDict) {
      acc.voiceMessageCount += 1;
      acc.voiceCreditsUsed += credit;
    } else if (isVoice) {
      acc.voiceMessageCount += 1;
      acc.voiceCreditsUsed += credit;
    } else {
      acc.dictationMessageCount += 1;
      acc.dictationCreditsUsed += credit;
    }

    addVoiceMetaTotals(m, acc);
    addSpeechInputDuration(m, acc);

    const ts = (vm?.transcriptionStatus ?? '').trim().toLowerCase();
    if (ts === 'success') acc.transcriptionSuccessCount += 1;
    else if (ts === 'failed') acc.transcriptionFailedCount += 1;
  }

  acc.hasAnySpeechUsage =
    acc.voiceMessageCount > 0 ||
    acc.dictationMessageCount > 0 ||
    acc.totalSpeechDurationSeconds > 0 ||
    acc.totalDictationDurationSeconds > 0 ||
    acc.totalAudioDurationSeconds > 0 ||
    acc.totalSpeechToTextWords > 0 ||
    acc.totalSpeechToTextCharacters > 0 ||
    acc.transcriptionSuccessCount > 0 ||
    acc.transcriptionFailedCount > 0;

  return acc;
}
