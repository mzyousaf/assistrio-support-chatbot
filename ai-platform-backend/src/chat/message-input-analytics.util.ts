import { Types } from 'mongoose';
import type {
  MessageInputMethod,
  MessageInputType,
  MessageSpeechInput,
  MessageVoiceMeta,
} from '../models/message.schema';
import { findMatchingSuggestionContext } from '../workspace/shared/example-questions.util';
import type { ExampleQuestionDoc } from '../workspace/shared/example-questions.util';

const INPUT_TYPES = new Set<MessageInputType>([
  'text',
  'voice',
  'dictation',
  'attachment',
  'quick_reply',
  'suggested_question',
  'unknown',
]);

const INPUT_METHODS = new Set<MessageInputMethod>([
  'keyboard',
  'microphone',
  'microphone_transcription',
  'browser_speech_recognition',
  'file_upload',
  'quick_reply',
  'suggested_question',
  'api',
  'unknown',
]);

const TRANSCRIPTION_STATUSES = new Set<MessageVoiceMeta['transcriptionStatus']>([
  'pending',
  'success',
  'failed',
  'not_required',
]);

const MAX_TRANSCRIPTION_STR = 100;
const MAX_AUDIO_MIME = 100;
const MAX_SPEECH_SEC = 3600;
const MAX_STT_CHARS = 100000;
const MAX_STT_WORDS = 50000;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

export type MessageAnalyticsPayload = {
  inputType?: string;
  inputMethod?: string;
  voiceMeta?: Record<string, unknown>;
};

function parseIsoDate(v: unknown): Date | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v.trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

/** Clamp finite numbers into [min, max]; non-finite input yields undefined. */
function clampInt(n: unknown, min: number, max: number): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function trimStr(s: unknown, max: number): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

/** Safe subset from client JSON (drops billing / credit fields). */
export function parseMessageAnalyticsFromUnknown(raw: unknown): MessageAnalyticsPayload | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if ('creditCost' in o || 'creditReason' in o || 'billingType' in o || 'quotaPeriod' in o || 'chargedAt' in o) {
    const { creditCost: _c, creditReason: _r, billingType: _b, quotaPeriod: _q, chargedAt: _a, ...rest } = o;
    return parseMessageAnalyticsFromUnknown(rest);
  }
  const inputType = typeof o.inputType === 'string' ? o.inputType.trim() : undefined;
  const inputMethod = typeof o.inputMethod === 'string' ? o.inputMethod.trim() : undefined;
  const vmRaw = o.voiceMeta;
  let voiceMeta: Record<string, unknown> | undefined;
  if (vmRaw && typeof vmRaw === 'object' && !Array.isArray(vmRaw)) {
    voiceMeta = { ...(vmRaw as Record<string, unknown>) };
    delete voiceMeta.creditCost;
    delete voiceMeta.creditReason;
    delete voiceMeta.billingType;
  }
  const out: MessageAnalyticsPayload = {};
  if (inputType) out.inputType = inputType;
  if (inputMethod) out.inputMethod = inputMethod;
  if (voiceMeta && Object.keys(voiceMeta).length) out.voiceMeta = voiceMeta;
  return Object.keys(out).length ? out : undefined;
}

export function countWordsInText(text: string): number {
  const t = String(text ?? '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

export function deriveSpeechTextStats(text: string | undefined): { chars: number; words: number } {
  const t = String(text ?? '');
  return { chars: t.length, words: countWordsInText(t) };
}

function coerceInputType(v: string | undefined): MessageInputType | undefined {
  if (!v) return undefined;
  const x = v as MessageInputType;
  return INPUT_TYPES.has(x) ? x : undefined;
}

function coerceInputMethod(v: string | undefined): MessageInputMethod | undefined {
  if (!v) return undefined;
  const x = v as MessageInputMethod;
  return INPUT_METHODS.has(x) ? x : undefined;
}

export function sanitizeVoiceMetaForPersistence(raw: Record<string, unknown> | undefined | null): MessageVoiceMeta | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: MessageVoiceMeta = {};

  if (raw.isVoiceMessage === true) out.isVoiceMessage = true;
  if (raw.isDictationMessage === true) out.isDictationMessage = true;

  const sds = clampInt(raw.speechDurationSeconds, 0, MAX_SPEECH_SEC);
  if (sds !== undefined) out.speechDurationSeconds = sds;
  const stc = clampInt(raw.speechToTextCharacters, 0, MAX_STT_CHARS);
  if (stc !== undefined) out.speechToTextCharacters = stc;
  const stw = clampInt(raw.speechToTextWords, 0, MAX_STT_WORDS);
  if (stw !== undefined) out.speechToTextWords = stw;
  const dds = clampInt(raw.dictationDurationSeconds, 0, MAX_SPEECH_SEC);
  if (dds !== undefined) out.dictationDurationSeconds = dds;
  const ads = clampInt(raw.audioDurationSeconds, 0, MAX_SPEECH_SEC);
  if (ads !== undefined) out.audioDurationSeconds = ads;
  const asb = clampInt(raw.audioSizeBytes, 0, MAX_AUDIO_BYTES);
  if (asb !== undefined) out.audioSizeBytes = asb;

  const tp = trimStr(raw.transcriptionProvider, MAX_TRANSCRIPTION_STR);
  if (tp) out.transcriptionProvider = tp;
  const ts = typeof raw.transcriptionStatus === 'string' ? raw.transcriptionStatus.trim() : '';
  if (ts && TRANSCRIPTION_STATUSES.has(ts as MessageVoiceMeta['transcriptionStatus'])) {
    out.transcriptionStatus = ts as MessageVoiceMeta['transcriptionStatus'];
  }
  const mt = trimStr(raw.audioMimeType, MAX_AUDIO_MIME);
  if (mt) out.audioMimeType = mt;

  const dsc = clampInt(raw.dictationSessionCount, 1, 500);
  if (dsc !== undefined) out.dictationSessionCount = dsc;

  const dsa = parseIsoDate(raw.dictationStartedAt);
  if (dsa) out.dictationStartedAt = dsa;
  const dea = parseIsoDate(raw.dictationEndedAt);
  if (dea) out.dictationEndedAt = dea;

  return Object.keys(out).length ? out : undefined;
}

export type ResolveMessageInputAnalyticsParams = {
  messageAnalytics?: unknown;
  routeDefault?: { inputType?: MessageInputType; inputMethod?: MessageInputMethod };
  hasAttachments?: boolean;
  text?: string;
  speechInput?: MessageSpeechInput | null;
  /** First user message: KB `suggestionId` or legacy example-question label match. */
  inferredSuggestedQuestion?: boolean;
};

export function resolveMessageInputAnalytics(input: ResolveMessageInputAnalyticsParams): {
  inputType: MessageInputType;
  inputMethod: MessageInputMethod;
  voiceMeta?: MessageVoiceMeta;
} {
  const routeType = input.routeDefault?.inputType ?? 'text';
  const routeMethod = input.routeDefault?.inputMethod ?? 'keyboard';
  const parsed = parseMessageAnalyticsFromUnknown(input.messageAnalytics);

  let inputType: MessageInputType = routeType;
  let inputMethod: MessageInputMethod = routeMethod;
  let voiceMetaObj: Record<string, unknown> = parsed?.voiceMeta ? { ...parsed.voiceMeta } : {};

  const clientType = coerceInputType(parsed?.inputType);
  const clientMethod = coerceInputMethod(parsed?.inputMethod);
  if (clientType) inputType = clientType;
  if (clientMethod) inputMethod = clientMethod;

  const si = input.speechInput ?? undefined;
  const hasVoiceTurn =
    si?.mode === 'voice' &&
    Boolean((si.transcript && si.transcript.trim()) || (si.audioUrl && si.audioUrl.trim()));
  const hasDictateTurn = si?.mode === 'dictate' && Boolean((si.transcript ?? '').trim());

  if (hasVoiceTurn) {
    inputType = 'voice';
    inputMethod = 'microphone';
    voiceMetaObj.isVoiceMessage = true;
    const tr = (si.transcript ?? '').trim();
    if (tr) {
      voiceMetaObj.transcriptionStatus = voiceMetaObj.transcriptionStatus ?? 'success';
      const { chars, words } = deriveSpeechTextStats(tr);
      voiceMetaObj.speechToTextCharacters = voiceMetaObj.speechToTextCharacters ?? chars;
      voiceMetaObj.speechToTextWords = voiceMetaObj.speechToTextWords ?? words;
    } else {
      voiceMetaObj.transcriptionStatus = voiceMetaObj.transcriptionStatus ?? 'pending';
    }
    if (si.mimeType?.trim()) voiceMetaObj.audioMimeType = voiceMetaObj.audioMimeType ?? si.mimeType.trim();
    if (typeof si.durationMs === 'number' && Number.isFinite(si.durationMs) && si.durationMs >= 0) {
      const sec = Math.min(MAX_SPEECH_SEC, si.durationMs / 1000);
      voiceMetaObj.audioDurationSeconds = voiceMetaObj.audioDurationSeconds ?? sec;
    }
    if (typeof si.audioSizeBytes === 'number' && Number.isFinite(si.audioSizeBytes) && si.audioSizeBytes >= 0) {
      const b = clampInt(si.audioSizeBytes, 0, MAX_AUDIO_BYTES);
      if (b !== undefined) voiceMetaObj.audioSizeBytes = voiceMetaObj.audioSizeBytes ?? b;
    }
    voiceMetaObj.transcriptionProvider =
      trimStr(voiceMetaObj.transcriptionProvider, MAX_TRANSCRIPTION_STR) ?? 'whisper';
  } else if (hasDictateTurn) {
    inputType = 'dictation';
    const p = si.dictationProvider;
    const useBrowserDictation = p === 'browser_speech_recognition';
    if (useBrowserDictation) {
      inputMethod = 'browser_speech_recognition';
      voiceMetaObj.transcriptionProvider =
        trimStr(voiceMetaObj.transcriptionProvider, MAX_TRANSCRIPTION_STR) ?? 'browser_speech_recognition';
    } else {
      inputMethod = 'microphone_transcription';
      voiceMetaObj.transcriptionProvider =
        trimStr(voiceMetaObj.transcriptionProvider, MAX_TRANSCRIPTION_STR) ?? 'whisper';
    }
    voiceMetaObj.isDictationMessage = true;
    const ts0 = voiceMetaObj.transcriptionStatus;
    const tsStr = typeof ts0 === 'string' ? ts0.trim() : '';
    if (!tsStr || !TRANSCRIPTION_STATUSES.has(tsStr as MessageVoiceMeta['transcriptionStatus'])) {
      voiceMetaObj.transcriptionStatus = 'success';
    }
    const tr = (si.transcript ?? '').trim();
    const { chars, words } = deriveSpeechTextStats(tr);
    voiceMetaObj.speechToTextCharacters = voiceMetaObj.speechToTextCharacters ?? chars;
    voiceMetaObj.speechToTextWords = voiceMetaObj.speechToTextWords ?? words;
    if (typeof si.dictationDurationMs === 'number' && Number.isFinite(si.dictationDurationMs) && si.dictationDurationMs >= 0) {
      const sec = Math.min(MAX_SPEECH_SEC, si.dictationDurationMs / 1000);
      voiceMetaObj.dictationDurationSeconds = voiceMetaObj.dictationDurationSeconds ?? sec;
      voiceMetaObj.audioDurationSeconds = voiceMetaObj.audioDurationSeconds ?? sec;
    }
    if (si.mimeType?.trim()) {
      voiceMetaObj.audioMimeType = voiceMetaObj.audioMimeType ?? si.mimeType.trim().slice(0, MAX_AUDIO_MIME);
    }
    if (typeof si.audioSizeBytes === 'number' && Number.isFinite(si.audioSizeBytes) && si.audioSizeBytes >= 0) {
      const b = clampInt(si.audioSizeBytes, 0, MAX_AUDIO_BYTES);
      if (b !== undefined) voiceMetaObj.audioSizeBytes = voiceMetaObj.audioSizeBytes ?? b;
    }
  }

  const hasFiles = input.hasAttachments === true;
  if (hasFiles && inputType !== 'voice' && inputType !== 'dictation') {
    if (inputMethod === 'keyboard' || inputMethod === 'api' || inputMethod === 'unknown') {
      inputMethod = 'file_upload';
    }
  }

  if (
    input.inferredSuggestedQuestion &&
    inputType !== 'voice' &&
    inputType !== 'dictation' &&
    inputType !== 'suggested_question' &&
    inputType !== 'quick_reply' &&
    !hasFiles
  ) {
    inputType = 'suggested_question';
    inputMethod = 'suggested_question';
  }

  if (inputMethod === 'browser_speech_recognition' && inputType !== 'voice') {
    inputType = 'dictation';
    voiceMetaObj.isDictationMessage = true;
  }

  if (inputMethod === 'microphone_transcription' && inputType !== 'voice') {
    inputType = 'dictation';
    voiceMetaObj.isDictationMessage = true;
  }

  if (inputType === 'voice') {
    voiceMetaObj.isVoiceMessage = true;
  }
  if (inputType === 'dictation') {
    voiceMetaObj.isDictationMessage = true;
  }

  const textForDerive = String(input.text ?? '');
  if ((inputType === 'dictation' || inputType === 'voice') && textForDerive) {
    const { chars, words } = deriveSpeechTextStats(textForDerive);
    if (voiceMetaObj.speechToTextCharacters == null) voiceMetaObj.speechToTextCharacters = chars;
    if (voiceMetaObj.speechToTextWords == null) voiceMetaObj.speechToTextWords = words;
  }

  if (!INPUT_TYPES.has(inputType)) inputType = 'text';
  if (!INPUT_METHODS.has(inputMethod)) inputMethod = 'unknown';

  const voiceMeta = sanitizeVoiceMetaForPersistence(voiceMetaObj);
  return {
    inputType,
    inputMethod,
    ...(voiceMeta ? { voiceMeta } : {}),
  };
}

/** Route defaults: workspace playground chat uses API; embed UIs use keyboard. */
export function messageInputRouteDefaultsFromRunChatInput(input: {
  conversationOrigin?: { embedType?: string } | null;
}): { inputType: MessageInputType; inputMethod: MessageInputMethod } {
  const et = String(input.conversationOrigin?.embedType ?? '').trim();
  if (et === 'workspace_chat') {
    return { inputType: 'text', inputMethod: 'api' };
  }
  return { inputType: 'text', inputMethod: 'keyboard' };
}

export function inferSuggestedQuestionForFirstTurn(input: {
  priorUserMessageCount: number;
  suggestionId?: string;
  messageForMatch: string;
  exampleQuestions: ExampleQuestionDoc[];
}): boolean {
  if (input.priorUserMessageCount !== 0) return false;
  const sid = String(input.suggestionId ?? '').trim();
  if (sid && Types.ObjectId.isValid(sid)) return true;
  return findMatchingSuggestionContext(input.exampleQuestions, input.messageForMatch, 1) != null;
}
