import type { ChatSpeechInputMeta } from "../components/chat-ui/types";

/** Safe, additive `messageAnalytics` for embed/preview POST bodies (no billing fields). */
export type WidgetMessageAnalyticsPayload = {
  inputType: string;
  inputMethod: string;
  voiceMeta?: Record<string, unknown>;
};

export function buildWidgetMessageAnalytics(opts: {
  speechInput?: ChatSpeechInputMeta | null;
  files?: File[] | null;
  suggestionId?: string | null;
  /** Trimmed outbound message body (composer value), for text + attachment routing. */
  messageText?: string | null;
  /** Whisper rollup: dictation sessions merged into composer before send. */
  dictationSessionCount?: number | null;
}): WidgetMessageAnalyticsPayload {
  const fileCount = opts.files?.length ?? 0;
  const messageTrimmed = String(opts.messageText ?? "").trim();
  const si = opts.speechInput;

  function dictationSessionsMeta(): Record<string, unknown> | undefined {
    const n = opts.dictationSessionCount;
    if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
    const c = Math.max(1, Math.min(500, Math.round(n)));
    return { dictationSessionCount: c };
  }

  const hasVoice =
    si?.mode === "voice" &&
    Boolean((si.transcript && si.transcript.trim()) || (si.audioUrl && si.audioUrl.trim()));
  const transcript = (si?.mode === "dictate" ? si.transcript : undefined)?.trim() ?? "";
  const dsm = dictationSessionsMeta();

  if (hasVoice && si?.mode === "voice") {
    const tr = (si.transcript ?? "").trim();
    const words = tr ? tr.split(/\s+/).filter(Boolean).length : 0;
    const durationSec =
      typeof si.durationMs === "number" && Number.isFinite(si.durationMs) && si.durationMs >= 0
        ? Math.min(3600, si.durationMs / 1000)
        : undefined;
    const size =
      typeof si.audioSizeBytes === "number" && Number.isFinite(si.audioSizeBytes) && si.audioSizeBytes >= 0
        ? Math.min(Math.round(si.audioSizeBytes), 2_000_000_000)
        : undefined;
    return {
      inputType: "voice",
      inputMethod: "microphone",
      voiceMeta: {
        isVoiceMessage: true,
        transcriptionProvider: "whisper",
        transcriptionStatus: tr ? "success" : "pending",
        ...(durationSec != null ? { audioDurationSeconds: durationSec } : {}),
        ...(size != null ? { audioSizeBytes: size } : {}),
        ...(si.mimeType?.trim() ? { audioMimeType: si.mimeType.trim().slice(0, 100) } : {}),
        ...(tr ? { speechToTextCharacters: tr.length, speechToTextWords: words } : {}),
      },
    };
  }

  if (si?.mode === "dictate" && transcript) {
    const words = transcript.split(/\s+/).filter(Boolean).length;
    const whisper = si.dictationProvider === "whisper";
    const dictationDurationSeconds =
      typeof si.dictationDurationMs === "number" &&
      Number.isFinite(si.dictationDurationMs) &&
      si.dictationDurationMs >= 0
        ? Math.min(3600, si.dictationDurationMs / 1000)
        : undefined;
    const audioDurSec =
      typeof si.durationMs === "number" && Number.isFinite(si.durationMs) && si.durationMs >= 0
        ? Math.min(3600, si.durationMs / 1000)
        : dictationDurationSeconds;
    const audioSize =
      typeof si.audioSizeBytes === "number" && Number.isFinite(si.audioSizeBytes) && si.audioSizeBytes >= 0
        ? Math.min(Math.round(si.audioSizeBytes), 2_000_000_000)
        : undefined;
    if (whisper) {
      return {
        inputType: "dictation",
        inputMethod: "microphone_transcription",
        voiceMeta: {
          isDictationMessage: true,
          transcriptionProvider: "whisper",
          transcriptionStatus: "success",
          speechToTextCharacters: transcript.length,
          speechToTextWords: words,
          ...(dictationDurationSeconds != null ? { dictationDurationSeconds } : {}),
          ...(audioDurSec != null ? { audioDurationSeconds: audioDurSec } : {}),
          ...(audioSize != null ? { audioSizeBytes: audioSize } : {}),
          ...(si.mimeType?.trim() ? { audioMimeType: si.mimeType.trim().slice(0, 100) } : {}),
          ...(dsm ? dsm : {}),
        },
      };
    }
    return {
      inputType: "dictation",
      inputMethod: "browser_speech_recognition",
      voiceMeta: {
        isDictationMessage: true,
        transcriptionProvider: "browser_speech_recognition",
        transcriptionStatus: "success",
        speechToTextCharacters: transcript.length,
        speechToTextWords: words,
        ...(dictationDurationSeconds != null ? { dictationDurationSeconds } : {}),
        ...(dsm ? dsm : {}),
      },
    };
  }

  if (opts.suggestionId?.trim()) {
    return { inputType: "suggested_question", inputMethod: "suggested_question" };
  }

  if (fileCount > 0 && messageTrimmed.length > 0) {
    return { inputType: "text", inputMethod: "file_upload" };
  }

  if (fileCount > 0) {
    return { inputType: "attachment", inputMethod: "file_upload" };
  }

  return { inputType: "text", inputMethod: "keyboard" };
}
