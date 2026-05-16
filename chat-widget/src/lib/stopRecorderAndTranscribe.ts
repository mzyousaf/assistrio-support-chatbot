/** Matches {@link ChatProps} `postSpeechAudio` signature (avoid importing Chat — circular). */
export type PostSpeechAudioFn = (args: {
  blob: Blob;
  recorderMimeType?: string;
  mode: "dictate" | "voice";
  durationMs: number;
}) => Promise<{ transcript: string; audioUrl?: string; mimeType?: string; durationMs?: number }>;

export type StopMediaRecorderCaptureFn = () => Promise<{
  blob: Blob;
  durationMs: number;
  recorderMimeType: string;
} | null>;

/** Blob smaller than backend/client minimum — do not POST. */
export class SpeechRecordingTooShortError extends Error {
  override name = "SpeechRecordingTooShortError";
}

/** Recorder was already inactive — nothing to transcribe. */
export class SpeechRecordingEmptyError extends Error {
  override name = "SpeechRecordingEmptyError";
}

/**
 * Shared path for voice notes + Whisper dictation: finalize {@link MediaRecorder},
 * enforce minimum size, call the runtime `/speech` multipart endpoint.
 */
export async function stopRecorderAndTranscribe(opts: {
  stopCapture: StopMediaRecorderCaptureFn;
  postSpeechAudio: PostSpeechAudioFn;
  mode: "dictate" | "voice";
  minBytes: number;
}): Promise<{
  transcript: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs: number;
  audioSizeBytes: number;
}> {
  const pack = await opts.stopCapture();
  if (!pack) throw new SpeechRecordingEmptyError();
  const size = typeof pack.blob.size === "number" && Number.isFinite(pack.blob.size) ? pack.blob.size : 0;
  if (size < opts.minBytes) throw new SpeechRecordingTooShortError();
  const r = await opts.postSpeechAudio({
    blob: pack.blob,
    recorderMimeType: pack.recorderMimeType,
    mode: opts.mode,
    durationMs: pack.durationMs,
  });
  return {
    transcript: String(r.transcript ?? ""),
    audioUrl: r.audioUrl,
    mimeType: r.mimeType,
    durationMs: typeof r.durationMs === "number" && Number.isFinite(r.durationMs) ? r.durationMs : pack.durationMs,
    audioSizeBytes: size,
  };
}
