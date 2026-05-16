/**
 * OpenAI Whisper `audio/transcriptions` accepts these container extensions (filename matters).
 * @see https://platform.openai.com/docs/guides/speech-to-text
 */
export const OPENAI_WHISPER_FILE_EXTENSIONS = new Set([
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
]);

const MIME_BASE_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/oga': 'oga',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'mp4',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

const EXT_TO_MIME: Record<string, string> = {
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/m4a',
  wav: 'audio/wav',
  flac: 'audio/flac',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
};

function extensionFromFilename(filename: string): string {
  const t = String(filename ?? '').trim();
  if (!t.includes('.')) return '';
  const ext = t.slice(t.lastIndexOf('.') + 1).toLowerCase();
  return /^[a-z0-9]+$/.test(ext) ? ext : '';
}

/**
 * Ensure Whisper receives a supported filename extension + matching MIME.
 * Returns a user-safe error message when the upload cannot be transcribed.
 */
export function normalizeWhisperUploadForOpenai(input: {
  filename: string;
  mime: string;
}):
  | { ok: true; filename: string; mime: string }
  | { ok: false; errorMessage: string } {
  const mimeBase = String(input.mime ?? '')
    .split(';')[0]!
    .trim()
    .toLowerCase();
  const extFromName = extensionFromFilename(input.filename);

  let ext = extFromName && OPENAI_WHISPER_FILE_EXTENSIONS.has(extFromName) ? extFromName : '';

  const fromMime = MIME_BASE_TO_EXT[mimeBase];
  if (!ext && fromMime) ext = fromMime;

  if (!ext && mimeBase === 'application/octet-stream') {
    ext = extFromName && OPENAI_WHISPER_FILE_EXTENSIONS.has(extFromName) ? extFromName : 'webm';
  }

  if (!ext || !OPENAI_WHISPER_FILE_EXTENSIONS.has(ext)) {
    return { ok: false, errorMessage: 'Unsupported audio format. Please record again.' };
  }

  const mime = EXT_TO_MIME[ext] ?? `audio/${ext}`;
  return { ok: true, filename: `recording.${ext}`, mime };
}
