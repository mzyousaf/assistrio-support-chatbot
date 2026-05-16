import { normalizeWhisperUploadForOpenai } from './widget-speech-whisper-normalize.util';

describe('normalizeWhisperUploadForOpenai', () => {
  it('accepts audio/webm with recording.webm', () => {
    expect(normalizeWhisperUploadForOpenai({ filename: 'recording.webm', mime: 'audio/webm' })).toEqual({
      ok: true,
      filename: 'recording.webm',
      mime: 'audio/webm',
    });
  });

  it('maps video/webm + wrong name to recording.webm', () => {
    const r = normalizeWhisperUploadForOpenai({ filename: 'blob', mime: 'video/webm' });
    expect(r).toEqual({ ok: true, filename: 'recording.webm', mime: 'audio/webm' });
  });

  it('normalizes mime-only audio/webm when filename has no extension', () => {
    const r = normalizeWhisperUploadForOpenai({ filename: 'blob', mime: 'audio/webm' });
    expect(r).toEqual({ ok: true, filename: 'recording.webm', mime: 'audio/webm' });
  });

  it('rejects unsupported mime with user-safe message', () => {
    const r = normalizeWhisperUploadForOpenai({ filename: 'x.bin', mime: 'application/x-msdownload' });
    expect(r).toEqual({
      ok: false,
      errorMessage: 'Unsupported audio format. Please record again.',
    });
  });
});
