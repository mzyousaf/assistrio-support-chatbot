import { useWavesurfer } from "@wavesurfer/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpeechRecordingWaveStyle } from "../../models/botChatUI";
import { cx } from "./utils";

/** Same size as send / voice controls in `ChatComposer` (`INNER_CTRL_CLASS`). */
const COMPOSER_CTRL_CLASS = "h-8 w-8 min-h-8 min-w-8";
/** Match `ChatComposer` `composerIconHoverTarget` for glyph hover on the play chip. */
const COMPOSER_ICON_HOVER = "inline-flex origin-center transition-transform duration-150 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100 group-disabled:group-hover:scale-100";

/** Treat as “at start” so we show total length until playback or seek moves the head. */
const START_EPS = 0.05;

/**
 * Neutral / default-bubble waveforms: higher contrast unplayed vs played.
 * Light theme uses dark played bars so they read on white or pale inner wells.
 */
const WF_COLORS = {
  dark: {
    waveColor: "#8b9cae",
    progressColor: "#f1f5f9",
    /** High-contrast knob on lighter gray bubbles + pale played wave. */
    playheadDot: "#ffffff",
  },
  light: {
    waveColor: "#a1aebf",
    progressColor: "#1e293b",
    playheadDot: "#334155",
  },
} as const;

/** Neutral bubble on solid black (defaultDark). */
const WF_ON_BLACK_NEUTRAL = {
  waveColor: "#64748b",
  progressColor: "#f1f5f9",
  playheadDot: "#ffffff",
} as const;

/** Dark accent bubble: light waveform (opaque blends — see wfPalette). */
const WF_ON_ACCENT_DARK_BG = {
  progressColor: "#ffffff",
  playheadDot: "#ffffff",
} as const;

/** Light accent bubble: dark waveform for contrast. */
const WF_ON_ACCENT_LIGHT_BG = {
  progressColor: "#0f172a",
  playheadDot: "#0c4a6e",
} as const;

/**
 * Unplayed bar tint: multiplicative blend toward white/black so pixels stay opaque
 * (WaveSurfer progress uses source-in; transparent wave colors break played fill).
 */
const ACCENT_WAVE_TINT = 0.22;

function parseCssRgbTriplet(input: string): [number, number, number] | null {
  const s = input.trim();
  if (s.startsWith("#")) {
    const n = s.slice(1);
    if (n.length === 3) {
      return [
        parseInt(n[0] + n[0], 16),
        parseInt(n[1] + n[1], 16),
        parseInt(n[2] + n[2], 16),
      ];
    }
    if (n.length === 6) {
      return [
        parseInt(n.slice(0, 2), 16),
        parseInt(n.slice(2, 4), 16),
        parseInt(n.slice(4, 6), 16),
      ];
    }
    return null;
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** WCAG relative luminance (sRGB). */
function relativeLuminance255(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** True when accent fill reads as “light” — use dark foreground for wave + controls. */
function isLightAccentColor(css: string, threshold = 0.55): boolean {
  const rgb = parseCssRgbTriplet(css);
  if (!rgb) return false;
  return relativeLuminance255(rgb[0], rgb[1], rgb[2]) > threshold;
}

function blendWhiteOnCssColor(css: string, t: number): string {
  const rgb = parseCssRgbTriplet(css);
  if (!rgb) return "#aeb4f5";
  const r = Math.round(rgb[0] * (1 - t) + 255 * t);
  const g = Math.round(rgb[1] * (1 - t) + 255 * t);
  const b = Math.round(rgb[2] * (1 - t) + 255 * t);
  return `rgb(${r} ${g} ${b})`;
}

/** Darken toward black (opaque unplayed bars on a light accent). */
function darkenTowardBlack(css: string, t: number): string {
  const rgb = parseCssRgbTriplet(css);
  if (!rgb) return "#64748b";
  const k = 1 - t;
  const r = Math.round(rgb[0] * k);
  const g = Math.round(rgb[1] * k);
  const b = Math.round(rgb[2] * k);
  return `rgb(${r} ${g} ${b})`;
}

/** WaveSurfer colors aligned with `SpeechLevelWaveform` / voice recording strip. */
function surferColorsFromRecordingStyle(
  waveStyle: SpeechRecordingWaveStyle,
  dark: boolean,
  accentColor: string,
): { waveColor: string; progressColor: string } {
  const acc = (accentColor || "#6366f1").trim();
  if (waveStyle === "brand") {
    return {
      waveColor: dark ? "rgba(100, 116, 139, 0.5)" : "rgba(148, 163, 184, 0.65)",
      progressColor: acc,
    };
  }
  if (waveStyle === "defaultDark") {
    if (dark) {
      return {
        waveColor: "rgba(148, 163, 184, 0.4)",
        progressColor: "rgb(241, 245, 249)",
      };
    }
    return {
      waveColor: "rgb(71, 85, 105)",
      progressColor: "rgb(15, 23, 42)",
    };
  }
  if (dark) {
    return {
      waveColor: "rgb(100, 116, 139)",
      progressColor: "rgb(226, 232, 240)",
    };
  }
  return {
    waveColor: "rgb(203, 213, 225)",
    progressColor: "rgb(71, 85, 105)",
  };
}

function wfPalette(dark: boolean, onAccent: boolean, accentColor: string | undefined, neutralBubbleBlack: boolean) {
  if (onAccent) {
    const base = accentColor ?? "#6366f1";
    if (isLightAccentColor(base)) {
      const waveColor = darkenTowardBlack(base, ACCENT_WAVE_TINT);
      return { ...WF_ON_ACCENT_LIGHT_BG, waveColor };
    }
    const waveColor = blendWhiteOnCssColor(base, ACCENT_WAVE_TINT);
    return { ...WF_ON_ACCENT_DARK_BG, waveColor };
  }
  if (neutralBubbleBlack) return WF_ON_BLACK_NEUTRAL;
  return dark ? WF_COLORS.dark : WF_COLORS.light;
}

/** Snap to end when this close to duration (media vs decoded length mismatch). */
const PLAYHEAD_END_EPS = 0.15;

const PLAYHEAD_NOB_HALF_PX = 5;

/** Progress is 0–1 along the waveform track; dot centered on that point (matches WaveSurfer progress). */
function nobCenterFromProgress(p: number): { left: string; transform: string } {
  return {
    left: `clamp(${PLAYHEAD_NOB_HALF_PX}px, ${p * 100}%, calc(100% - ${PLAYHEAD_NOB_HALF_PX}px))`,
    transform: "translate(-50%, -50%)",
  };
}

/** `mm:ss` fixed width (e.g. `05:00`); fits voice notes up to 59:59. */
function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

export interface ChatUserVoiceMessageProps {
  messageId: string;
  audioUrl: string;
  durationMs?: number;
  /** Sending: show subtle disabled state on play */
  disabled?: boolean;
  /** Match chat thread theme (default true). */
  dark?: boolean;
  /** User bubble uses primary/accent fill — contrast for wave + chrome. */
  onAccent?: boolean;
  /** Neutral visitor bubble on black (`defaultDark`). */
  neutralBubbleBlack?: boolean;
  /** Accent fill (e.g. `#6366f1`) — used to build an opaque unplayed wave so played white stays solid. */
  accentColor?: string;
  /** e.g. composer preview: `min-w-0 w-full !max-w-none` so the bar fills the row. */
  className?: string;
  /** When set, play uses the same chip as send / voice in `ChatComposer`. */
  composerPlayButton?: { className: string; style?: React.CSSProperties };
  /** Unplayed / played bar colors to match the live recording waveform (composer preview). */
  speechRecordingWaveStyle?: SpeechRecordingWaveStyle;
}

/**
 * Voice note player: one row — play, waveform, time (total at start, elapsed while playing or paused).
 */
export function ChatUserVoiceMessage({
  audioUrl,
  durationMs,
  disabled = false,
  dark = true,
  onAccent = false,
  neutralBubbleBlack = false,
  accentColor,
  className,
  composerPlayButton,
  speechRecordingWaveStyle,
}: ChatUserVoiceMessageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState(
    durationMs != null && durationMs > 0 ? durationMs / 1000 : 0,
  );

  const wavesurferOptions = useMemo(() => {
    const base = wfPalette(dark, onAccent, accentColor, neutralBubbleBlack);
    const c =
      speechRecordingWaveStyle != null
        ? { ...base, ...surferColorsFromRecordingStyle(speechRecordingWaveStyle, dark, accentColor ?? "#6366f1") }
        : base;
    return {
      url: audioUrl,
      height: 36,
      waveColor: c.waveColor,
      progressColor: c.progressColor,
      /* Native cursor hidden; we render a moving dot in React. */
      cursorColor: "transparent",
      cursorWidth: 0,
      barWidth: 2,
      /* Tighter grid → fewer “empty” strips vs parent width (WS floors canvas to bar steps). */
      barGap: 0,
      barRadius: 3,
      /** Quieter stretches stay visible instead of collapsing to dots/gaps. */
      barMinHeight: 2,
      normalize: true,
      interact: !disabled,
      fillParent: true,
      hideScrollbar: true,
      dragToSeek: true,
      autoCenter: false,
      autoScroll: false,
      /** Higher than default 8000 → smoother peaks, less choppy bars on short clips. */
      sampleRate: 22050,
    };
  }, [accentColor, audioUrl, dark, disabled, neutralBubbleBlack, onAccent, speechRecordingWaveStyle]);

  const { wavesurfer, isReady, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    ...wavesurferOptions,
  });

  useEffect(() => {
    if (durationMs != null && durationMs > 0) {
      setDurationSec(durationMs / 1000);
    } else {
      setDurationSec(0);
    }
  }, [audioUrl, durationMs]);

  useEffect(() => {
    if (!wavesurfer) return;
    const base = wfPalette(dark, onAccent, accentColor, neutralBubbleBlack);
    const c =
      speechRecordingWaveStyle != null
        ? { ...base, ...surferColorsFromRecordingStyle(speechRecordingWaveStyle, dark, accentColor ?? "#6366f1") }
        : base;
    const unsubs: Array<() => void> = [];
    const syncDurationFromWs = () => {
      const d = wavesurfer.getDuration();
      if (Number.isFinite(d) && d > 0) {
        setDurationSec((prev) => {
          const next = Math.max(prev || 0, d);
          return next !== prev ? next : prev;
        });
      }
    };
    unsubs.push(
      wavesurfer.on("ready", (dur) => {
        if (Number.isFinite(dur) && dur > 0) setDurationSec(dur);
        /* Re-apply after decode so progress vs wave colors reliably paint. */
        wavesurfer.setOptions({
          waveColor: c.waveColor,
          progressColor: c.progressColor,
          cursorColor: "transparent",
          cursorWidth: 0,
        });
        syncDurationFromWs();
      }),
    );
    unsubs.push(wavesurfer.on("timeupdate", syncDurationFromWs));
    unsubs.push(wavesurfer.on("redrawcomplete", syncDurationFromWs));
    syncDurationFromWs();
    return () => unsubs.forEach((u) => u());
  }, [accentColor, wavesurfer, dark, neutralBubbleBlack, onAccent, speechRecordingWaveStyle]);

  const togglePlay = useCallback(() => {
    if (disabled || !wavesurfer || !isReady) return;
    if (isPlaying) wavesurfer.pause();
    else void wavesurfer.play();
  }, [disabled, wavesurfer, isReady, isPlaying]);

  const displayDuration =
    durationSec > 0 ? durationSec : durationMs != null ? durationMs / 1000 : 0;

  const atStart = !isPlaying && currentTime < START_EPS;
  const clockLabel = atStart ? displayDuration : currentTime;
  const clockAriaLabel = atStart
    ? `Duration ${formatClock(displayDuration)}`
    : `Played ${formatClock(currentTime)}`;

  const accentIsLight = Boolean(onAccent && accentColor && isLightAccentColor(accentColor));

  const useDarkNeutralChrome = !onAccent && (dark || neutralBubbleBlack);

  const playBtnClass = onAccent
    ? accentIsLight
      ? "text-gray-900 focus-visible:ring-gray-900/35 bg-black/12 hover:bg-black/18 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
      : "text-white focus-visible:ring-white/50 bg-white/18 hover:bg-white/28 shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
    : neutralBubbleBlack
      ? "text-gray-900 focus-visible:ring-gray-900/30 bg-white hover:bg-gray-50 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
      : useDarkNeutralChrome
        ? "text-white focus-visible:ring-white/45 bg-white/16 hover:bg-white/26 shadow-[0_1px_2px_rgba(0,0,0,0.14)]"
        : "text-gray-900 focus-visible:ring-gray-400/55 bg-white hover:bg-gray-50 shadow-[0_1px_2px_rgba(15,23,42,0.06)]";

  const timeClass = onAccent
    ? accentIsLight
      ? "text-gray-900/85"
      : "text-white/85"
    : neutralBubbleBlack
      ? "text-white/90"
      : useDarkNeutralChrome
        ? "text-gray-300"
        : "text-gray-500";

  // Playhead must use WaveSurfer's decoded duration (not metadata) or it drifts from the wave.
  const wsDuration = wavesurfer?.getDuration?.() ?? 0;
  const durationForPlayhead =
    wsDuration > 0 ? wsDuration : displayDuration;
  let playheadProgress =
    durationForPlayhead > 0
      ? Math.min(1, Math.max(0, currentTime / durationForPlayhead))
      : 0;
  if (
    durationForPlayhead > 0 &&
    (playheadProgress >= 1 - 1e-6 || currentTime >= durationForPlayhead - PLAYHEAD_END_EPS)
  ) {
    playheadProgress = 1;
  }
  const baseWf = wfPalette(dark, onAccent, accentColor, neutralBubbleBlack);
  const wf =
    speechRecordingWaveStyle === "brand" && (accentColor ?? "").trim()
      ? { ...baseWf, playheadDot: (accentColor ?? "#6366f1").trim() }
      : baseWf;
  const playheadPt = nobCenterFromProgress(playheadProgress);

  const playIcons = isPlaying ? (
    <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
    </svg>
  ) : (
    <svg className="ml-0.5 h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13L18.5 12 8 5.5Z" />
    </svg>
  );

  return (
    <div
      className={cx(
        "flex w-full min-w-0 items-center gap-2",
        !className && "min-w-[230px] max-w-[320px]",
        className,
      )}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled || !isReady}
        className={cx(
          composerPlayButton
            ? cx(
                composerPlayButton.className,
                "group flex shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 disabled:opacity-45 disabled:cursor-default",
                COMPOSER_CTRL_CLASS,
              )
            : cx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 disabled:opacity-45 disabled:cursor-default",
                playBtnClass,
              ),
        )}
        style={composerPlayButton?.style}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        title={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {composerPlayButton ? <span className={COMPOSER_ICON_HOVER}>{playIcons}</span> : playIcons}
      </button>

      <div
        className="assistrio-voice-wavesurfer min-h-[36px] min-w-0 flex-1 overflow-hidden rounded-sm py-1"
        aria-hidden={!isReady}
        data-wavesurfer-theme={
          onAccent ? (accentIsLight ? "accent-light" : "accent") : neutralBubbleBlack || dark ? "dark" : "light"
        }
      >
        <div className="relative h-9 w-full min-w-0">
          <div ref={containerRef} className="assistrio-ws-mount h-9 w-full min-w-0" />
          {isReady && displayDuration > 0 ? (
            <div
              className={cx(
                "pointer-events-none absolute top-1/2 z-10 h-2.5 w-2.5 rounded-full",
                onAccent && accentIsLight
                  ? "shadow-[0_0_0_1px_rgb(12_74_110_/_0.45)]"
                  : onAccent && !accentIsLight
                    ? "shadow-[0_0_0_1px_rgb(255_255_255_/_0.4)]"
                    : !onAccent && !dark
                      ? "shadow-[0_0_0_1px_rgb(148_163_184_/_0.65)]"
                      : "shadow-[0_0_0_1px_rgb(51_65_85_/_0.55)]",
              )}
              style={{
                left: playheadPt.left,
                top: "50%",
                transform: playheadPt.transform,
                backgroundColor: wf.playheadDot,
              }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      <span
        className={cx(
          "inline-flex h-9 w-[4ch] shrink-0 items-center justify-end text-[11px] font-medium tabular-nums tracking-tight",
          timeClass,
        )}
        aria-label={clockAriaLabel}
      >
        {formatClock(clockLabel)}
      </span>
    </div>
  );
}
