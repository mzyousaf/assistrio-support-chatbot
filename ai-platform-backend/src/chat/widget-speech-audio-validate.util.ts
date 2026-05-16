/**
 * Reject obviously invalid uploads before Whisper/OpenAI to avoid pointless API calls.
 */

/** OpenAI Whisper minimum practical payload; shorter clips are almost always unusable/noise. */
export const WHISPER_AUDIO_MIN_BYTES = 1024;

const EBML_WEBM_MAGIC = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]);

function sliceEq(hay: Uint8Array, needle: Uint8Array, offset = 0): boolean {
  if (hay.length + offset < needle.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if ((hay[offset + i] ?? 0) !== (needle[i] ?? 0)) return false;
  }
  return true;
}

/** Matroska / WebM EBML header. */
export function looksLikeWebmEbml(head: Uint8Array): boolean {
  return sliceEq(head, EBML_WEBM_MAGIC, 0);
}

/** Ogg container (opus/vorbis/etc.). */
export function looksLikeOgg(head: Uint8Array): boolean {
  if (head.length < 4) return false;
  return head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53;
}

/**
 * Typical ISO-BMFF (mp4 / m4a) start near offset 4; tolerate small wrappers.
 */
export function looksLikeMp4ish(head: Uint8Array): boolean {
  const n = Math.min(head.length - 8, 64);
  for (let off = 0; off <= Math.max(0, n); off++) {
    const a = head[off + 4];
    const b = head[off + 5];
    const c = head[off + 6];
    const d = head[off + 7];
    if (a === 0x66 && b === 0x74 && c === 0x79 && d === 0x70) return true;
  }
  return false;
}

/** RIFF WAVE (`RIFF....WAVE`). */
export function looksLikeWav(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  return (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x41 &&
    head[10] === 0x56 &&
    head[11] === 0x45
  );
}

export type WhisperAudioProbe = {
  ok: true;
} | {
  ok: false;
  reason:
    | 'empty'
    | 'too_small'
    | 'webm_magic_missing'
    | 'ogg_magic_missing'
    | 'unknown_container';
};

/**
 * Sanity-check decoded bytes vs declared Whisper extension (`normalizeWhisperUploadForOpenai` output).
 */
export function probeAudioForWhisperExtension(buffer: Buffer, extLower: string): WhisperAudioProbe {
  if (!buffer?.length) return { ok: false, reason: 'empty' };
  if (buffer.length < WHISPER_AUDIO_MIN_BYTES) return { ok: false, reason: 'too_small' };

  const head = new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.length, 4096));

  switch (extLower) {
    case 'webm':
      return looksLikeWebmEbml(head) ? { ok: true } : { ok: false, reason: 'webm_magic_missing' };
    case 'ogg':
    case 'oga':
    case 'ogx':
      return looksLikeOgg(head) ? { ok: true } : { ok: false, reason: 'ogg_magic_missing' };
    case 'mp4':
    case 'm4a':
    case 'mpeg':
    case 'mpga':
      return looksLikeMp4ish(head) ? { ok: true } : { ok: false, reason: 'unknown_container' };
    case 'wav':
      return looksLikeWav(head) ? { ok: true } : { ok: false, reason: 'unknown_container' };
    case 'flac':
    case 'mp3':
    default:
      return { ok: true };
  }
}
