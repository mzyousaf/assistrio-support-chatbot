/**
 * Browser MediaRecorder MIME choices + Whisper-safe upload {@link File} for multipart `file` fields.
 * OpenAI infers format from the filename extension; the Blob type must match.
 */

/** Reject Whisper uploads shorter than this (browser + backend both guard). */
export const MIN_VOICE_RECORDING_UPLOAD_BYTES = 1024;

const MIME_BASE_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/oga": "oga",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

const EXT_TO_PRIMARY_MIME: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  m4a: "audio/m4a",
  wav: "audio/wav",
  flac: "audio/flac",
};

/**
 * Prefer WebM/Opus (typical Chromium), then WebM, OGG/Opus, MP4; WAV last (rare for MediaRecorder).
 */
const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
] as const;

/** Pick a {@link MediaRecorder} MIME type supported in this browser, or `""` for default recorder behavior. */
export function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

/** Map `audio/...` or `video/webm` base MIME to a Whisper-supported file extension. */
export function getAudioExtensionFromMimeType(mimeType: string): string {
  const base = String(mimeType ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  return MIME_BASE_TO_EXT[base] ?? "webm";
}

/**
 * Build a {@link File} with a supported extension and matching `type` for transcription upload.
 * Prefer the recorder-reported MIME; fall back to the Blob's type.
 */
export function createTranscriptionUploadFile(blob: Blob, recorderMimeType?: string): File {
  const raw = String(recorderMimeType ?? blob.type ?? "").trim();
  const base = raw.split(";")[0]!.trim().toLowerCase();
  const ext = getAudioExtensionFromMimeType(base || "audio/webm");
  const type = EXT_TO_PRIMARY_MIME[ext] ?? "audio/webm";
  return new File([blob], `recording.${ext}`, { type });
}
