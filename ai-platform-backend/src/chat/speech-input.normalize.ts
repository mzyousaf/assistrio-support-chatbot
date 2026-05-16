import type { MessageSpeechInput } from '../models/message.schema';

const TRANSCRIPT_MAX = 32_000;
const URL_MAX = 2048;

/** Accept client JSON `speechInput` on chat POST and persist on the user Message. */
export function normalizeSpeechInputFromBody(raw: unknown): MessageSpeechInput | undefined {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const mode = o.mode === 'dictate' || o.mode === 'voice' ? o.mode : undefined;
  if (!mode) return undefined;

  const out: MessageSpeechInput = { mode };

  if (typeof o.transcript === 'string') {
    const t = o.transcript.trim().slice(0, TRANSCRIPT_MAX);
    if (t) out.transcript = t;
  }
  if (typeof o.audioUrl === 'string') {
    const u = o.audioUrl.trim().slice(0, URL_MAX);
    if (u.startsWith('http://') || u.startsWith('https://')) out.audioUrl = u;
  }
  if (typeof o.mimeType === 'string') {
    const m = o.mimeType.trim().slice(0, 120);
    if (m) out.mimeType = m;
  }
  if (typeof o.durationMs === 'number' && Number.isFinite(o.durationMs) && o.durationMs >= 0) {
    out.durationMs = Math.min(Math.round(o.durationMs), 3_600_000);
  }
  if (typeof o.audioSizeBytes === 'number' && Number.isFinite(o.audioSizeBytes) && o.audioSizeBytes >= 0) {
    out.audioSizeBytes = Math.min(Math.round(o.audioSizeBytes), 50 * 1024 * 1024);
  }
  if (typeof o.dictationDurationMs === 'number' && Number.isFinite(o.dictationDurationMs) && o.dictationDurationMs >= 0) {
    out.dictationDurationMs = Math.min(Math.round(o.dictationDurationMs), 3_600_000);
  }
  if (o.dictationProvider === 'browser_speech_recognition' || o.dictationProvider === 'whisper') {
    out.dictationProvider = o.dictationProvider;
  }

  /** Voice must include a transcript and/or uploaded audio URL (Whisper may still return empty text). */
  if (mode === 'voice' && !out.transcript?.trim() && !out.audioUrl) {
    return undefined;
  }

  return out;
}
