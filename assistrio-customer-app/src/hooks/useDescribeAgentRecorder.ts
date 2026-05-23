import { useCallback, useEffect, useRef, useState } from 'react';

export type DescribeAgentRecorderState = 'idle' | 'requesting' | 'recording' | 'error';

export function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function extensionForMime(mime: string): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (base.includes('mp4')) return 'm4a';
  if (base.includes('mpeg')) return 'mp3';
  if (base.includes('wav')) return 'wav';
  if (base.includes('ogg')) return 'ogg';
  return 'webm';
}

export function useDescribeAgentRecorder() {
  const [state, setState] = useState<DescribeAgentRecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef('');
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      const rec = recRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null;
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
      recRef.current = null;
      stopStreamTracks();
    };
  }, [clearTimer, stopStreamTracks]);

  const cancel = useCallback(() => {
    clearTimer();
    setElapsedSec(0);
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.ondataavailable = null;
      rec.onstop = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    recRef.current = null;
    chunksRef.current = [];
    mimeRef.current = '';
    stopStreamTracks();
    setState('idle');
    setError(null);
  }, [clearTimer, stopStreamTracks]);

  const start = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    setError(null);
    chunksRef.current = [];
    mimeRef.current = '';

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'Recording is not supported in this browser.';
      setError(msg);
      setState('error');
      return { ok: false, error: msg };
    }
    if (typeof MediaRecorder === 'undefined') {
      const msg = 'Recording is not supported in this browser.';
      setError(msg);
      setState('error');
      return { ok: false, error: msg };
    }

    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = getSupportedRecordingMimeType();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mimeRef.current = String(rec.mimeType || mime || 'audio/webm').trim() || 'audio/webm';
      recRef.current = rec;
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      rec.start();
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      clearTimer();
      timerRef.current = window.setInterval(() => {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
      }, 250);
      setState('recording');
      return { ok: true };
    } catch {
      stopStreamTracks();
      const msg = 'Microphone permission was denied or is unavailable.';
      setError(msg);
      setState('error');
      return { ok: false, error: msg };
    }
  }, [clearTimer, stopStreamTracks]);

  const stop = useCallback(async (): Promise<File | null> => {
    clearTimer();
    const rec = recRef.current;
    if (!rec || rec.state === 'inactive') {
      stopStreamTracks();
      recRef.current = null;
      setState('idle');
      setElapsedSec(0);
      return null;
    }

    return new Promise((resolve) => {
      const finish = () => {
        rec.onstop = null;
        recRef.current = null;
        stopStreamTracks();
        const mime = mimeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        mimeRef.current = '';
        setState('idle');
        setElapsedSec(0);
        if (!blob.size) {
          resolve(null);
          return;
        }
        const ext = extensionForMime(mime);
        resolve(new File([blob], `describe-agent.${ext}`, { type: mime.split(';')[0]!.trim() || 'audio/webm' }));
      };

      rec.onstop = finish;
      try {
        if (rec.state === 'recording') {
          try {
            rec.requestData();
          } catch {
            /* optional */
          }
        }
        rec.stop();
      } catch {
        rec.onstop = null;
        recRef.current = null;
        stopStreamTracks();
        chunksRef.current = [];
        mimeRef.current = '';
        setState('idle');
        setElapsedSec(0);
        resolve(null);
      }
    });
  }, [clearTimer, stopStreamTracks]);

  return { state, error, setError, elapsedSec, start, stop, cancel };
};
