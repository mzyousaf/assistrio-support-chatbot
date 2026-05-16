import {
  probeAudioForWhisperExtension,
  WHISPER_AUDIO_MIN_BYTES,
  looksLikeWebmEbml,
} from './widget-speech-audio-validate.util';

function filled(n: number, byte: number): Buffer {
  return Buffer.alloc(n, byte);
}

describe('probeAudioForWhisperExtension', () => {
  it('rejects empty and too_small', () => {
    expect(probeAudioForWhisperExtension(Buffer.alloc(0), 'webm')).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(probeAudioForWhisperExtension(filled(WHISPER_AUDIO_MIN_BYTES - 1, 0), 'webm')).toEqual({
      ok: false,
      reason: 'too_small',
    });
  });

  it('accepts padded webm with EBML magic', () => {
    const b = Buffer.alloc(WHISPER_AUDIO_MIN_BYTES, 1);
    b[0] = 0x1a;
    b[1] = 0x45;
    b[2] = 0xdf;
    b[3] = 0xa3;
    expect(probeAudioForWhisperExtension(b, 'webm')).toEqual({ ok: true });
  });

  it('rejects webm extension without EBML', () => {
    const b = filled(WHISPER_AUDIO_MIN_BYTES, 9);
    expect(probeAudioForWhisperExtension(b, 'webm')).toEqual({ ok: false, reason: 'webm_magic_missing' });
  });

  it('detects ebml helper', () => {
    expect(looksLikeWebmEbml(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true);
    expect(looksLikeWebmEbml(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });

  it('accepts ogg magic', () => {
    const b = Buffer.alloc(WHISPER_AUDIO_MIN_BYTES, 7);
    b[0] = 0x4f;
    b[1] = 0x67;
    b[2] = 0x67;
    b[3] = 0x53;
    expect(probeAudioForWhisperExtension(b, 'ogg')).toEqual({ ok: true });
  });
});
