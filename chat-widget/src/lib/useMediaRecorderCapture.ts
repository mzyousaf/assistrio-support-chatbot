import { useCallback, useEffect, useRef, useState } from "react";
import { getSupportedRecordingMimeType } from "./transcriptionUploadFile";

export type CaptureState = "idle" | "recording" | "stopped";

export type MediaRecorderStartResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Bars in the recording strip: a scrolling history — oldest on the left, newest on the right.
 * Each frame shifts left and appends the current voice level.
 */
export const SPEECH_WAVEFORM_SCROLL_BARS = 56;

/** Advance the scrolling strip every N rAF ticks (~60 Hz); higher = slower drift. */
const SCROLL_STRIDE_FRAMES = 8;

function pickMime(): string {
  return getSupportedRecordingMimeType();
}

/** Low, narrow idle pattern so silence stays flat; speech reads clearly above it. */
function baselineScrollBuffer(): number[] {
  const n = SPEECH_WAVEFORM_SCROLL_BARS;
  return Array.from({ length: n }, (_, i) => {
    const phase = (i / Math.max(1, n - 1)) * Math.PI * 2 * 1.25;
    return 0.018 + (Math.sin(phase) * 0.5 + 0.5) * 0.009;
  });
}

export function useMediaRecorderCapture() {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(() => baselineScrollBuffer());
  const [waveformLive, setWaveformLive] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  /** Mime selected when constructing {@link MediaRecorder} (aligned with recorder-reported mime). */
  const recorderMimeChosenRef = useRef<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const scrollHistoryRef = useRef<number[]>(baselineScrollBuffer());
  /** Single-sample EMA so the strip doesn’t jitter. */
  const levelSmoothRef = useRef(0);
  const scrollStrideRef = useRef(0);

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopAnalyser = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    analyserRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
    const cleared = baselineScrollBuffer();
    scrollHistoryRef.current = cleared;
    levelSmoothRef.current = 0;
    scrollStrideRef.current = 0;
    setWaveformLevels([...cleared]);
    setWaveformLive(false);
  }, []);

  const runAnalyserLoop = useCallback(() => {
    const tick = () => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const bufLen = analyser.fftSize;
      const td = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(td);
      let sumSq = 0;
      let peak = 0;
      for (let j = 0; j < bufLen; j++) {
        const c = (td[j]! - 128) / 128;
        sumSq += c * c;
        peak = Math.max(peak, Math.abs(c));
      }
      const rms = Math.sqrt(sumSq / bufLen);
      const mix = peak * 0.5 + rms * 0.5;
      /**
       * Treat quiet room tone as silence. `sqrt(mix * 9)` used to map noise (~0.06–0.1)
       * to ~0.7–1.0 so the strip looked “maxed” even when not speaking.
       */
      const SILENCE_MIX = 0.014;
      const gated = mix < SILENCE_MIX ? 0 : mix;
      /** Speech boost without pinning background noise to full scale. */
      const instant = Math.min(1, Math.sqrt(Math.min(1, gated * 4)));
      const ls = levelSmoothRef.current;
      const smoothLevel =
        instant > ls ? ls * 0.28 + instant * 0.72 : ls * 0.48 + instant * 0.52;
      levelSmoothRef.current = smoothLevel;
      scrollStrideRef.current += 1;
      if (scrollStrideRef.current >= SCROLL_STRIDE_FRAMES) {
        scrollStrideRef.current = 0;
        const sample = Math.min(1, Math.max(0, smoothLevel));
        const hist = scrollHistoryRef.current;
        const next = hist.slice(1);
        next.push(sample);
        scrollHistoryRef.current = next;
        setWaveformLevels([...next]);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      analyserRef.current = null;
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      void ctx?.close?.();
    };
  }, []);

  const start = useCallback(async (): Promise<MediaRecorderStartResult> => {
    stopAnalyser();
    setError(null);
    chunksRef.current = [];
    recorderMimeChosenRef.current = "";
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      const msg = "Microphone is not available in this environment.";
      setError(msg);
      return { ok: false, message: msg };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      try {
        const Ctor =
          typeof window !== "undefined"
            ? window.AudioContext ||
              (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            : undefined;
        if (Ctor) {
          const audioCtx = new Ctor();
          await audioCtx.resume();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 1024;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          audioCtxRef.current = audioCtx;
          analyserRef.current = analyser;
          const cleared = baselineScrollBuffer();
          scrollHistoryRef.current = cleared;
          levelSmoothRef.current = 0;
          scrollStrideRef.current = 0;
          setWaveformLevels([...cleared]);
          setWaveformLive(true);
          runAnalyserLoop();
        }
      } catch {
        /* Waveform is optional; recording still works. */
      }

      const mime = pickMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderMimeChosenRef.current = String(rec.mimeType || mime || "").trim();
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      /**
       * No timeslice: one `dataavailable` blob on stop avoids fragmented Matroska/WebM that OpenAI Whisper
       * sometimes rejects (“Invalid file format” despite `.webm` being listed as supported).
       */
      rec.start();
      startedAtRef.current = Date.now();
      setState("recording");
      return { ok: true };
    } catch {
      const msg = "Microphone permission is required.";
      setError(msg);
      stopAnalyser();
      stopStreamTracks();
      return { ok: false, message: msg };
    }
  }, [stopAnalyser, stopStreamTracks, runAnalyserLoop]);

  const stop = useCallback(async (): Promise<{ blob: Blob; durationMs: number; recorderMimeType: string } | null> => {
    stopAnalyser();
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") {
      stopStreamTracks();
      recRef.current = null;
      recorderMimeChosenRef.current = "";
      setState("idle");
      return null;
    }
    const durationMs = Math.max(0, Date.now() - startedAtRef.current);
    const recorderMimeType =
      String(recorderMimeChosenRef.current || rec.mimeType || pickMime() || "audio/webm").trim() || "audio/webm";

    return new Promise((resolve) => {
      const finish = () => {
        rec.onstop = null;
        recRef.current = null;
        recorderMimeChosenRef.current = "";
        stopStreamTracks();
        setState("stopped");
        const blob = new Blob(chunksRef.current, { type: recorderMimeType });
        chunksRef.current = [];
        resolve({ blob, durationMs, recorderMimeType });
      };

      rec.onstop = finish;
      try {
        if (rec.state === "recording") {
          try {
            rec.requestData();
          } catch {
            /* requestData is optional; stop() still flushes */
          }
        }
        rec.stop();
      } catch {
        rec.onstop = null;
        recRef.current = null;
        recorderMimeChosenRef.current = "";
        stopStreamTracks();
        setState("idle");
        chunksRef.current = [];
        resolve(null);
      }
    });
  }, [stopAnalyser, stopStreamTracks]);

  const cancel = useCallback(() => {
    stopAnalyser();
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.stop();
    }
    recRef.current = null;
    recorderMimeChosenRef.current = "";
    chunksRef.current = [];
    stopStreamTracks();
    setState("idle");
    setError(null);
  }, [stopAnalyser, stopStreamTracks]);

  const resetStopped = useCallback(() => {
    setState("idle");
  }, []);

  return { state, error, setError, start, stop, cancel, resetStopped, waveformLevels, waveformLive };
}
