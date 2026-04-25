import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import type { Ref } from "react";
import { Trash2 } from "lucide-react";
import { isLightAccentColor } from "../../lib/accentLuminance";
import { AttachmentCountBadge } from "./AttachmentCountBadge";
import type { ComposerControlStyle, SpeechRecordingWaveStyle } from "../../models/botChatUI";
import { SPEECH_WAVEFORM_SCROLL_BARS } from "../../lib/useMediaRecorderCapture";
import type { ChatSpeechInputMeta } from "./types";
import { ChatUserVoiceMessage } from "./ChatUserVoiceMessage";
import { cx } from "./utils";

function formatRecordingClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const LINE_HEIGHT = 20;
const ROW_MIN_PX = 40;
const MIN_ROWS = ROW_MIN_PX / LINE_HEIGHT;
const DEFAULT_MAX_ROWS = 8;
/** Trailing controls inside the composer pill (fits 40px row without crowding). */
const INNER_CTRL_CLASS = "h-8 w-8 min-h-8 min-w-8";
const INNER_ICON_CLASS = "h-[18px] w-[18px]";
const INNER_ICON_CLASS_SMALL = "h-[14px] w-[14px]";
/** Scroll chevrons: compact hit target; larger glyph via INNER_ICON_CLASS + overflow-visible. */
const SCROLL_HINT_CTRL_CLASS = "h-2 min-h-2 w-8 min-w-8 shrink-0 overflow-visible p-0";

/** Plus icon (same drawable size as in-field mic: INNER_ICON_CLASS). */
function PlusIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CloseIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** Waveform / voice hint (first control when input is empty). Use `stretch` to fill a wide slot (non-uniform scale). */
function VoiceWavesIcon({ className, stretch }: { className?: string; stretch?: boolean }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      preserveAspectRatio={stretch ? "none" : "xMidYMid meet"}
      aria-hidden
    >
      <rect x="3" y="10" width="2.5" height="4" rx="0.6" />
      <rect x="7.5" y="7" width="2.5" height="10" rx="0.6" />
      <rect x="12" y="9" width="2.5" height="6" rx="0.6" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.6" />
    </svg>
  );
}

/**
 * Live scrolling strip: mirror bars (grow from center), pill caps, pastel blue — classic “audio lane” look.
 */
function SpeechLevelWaveform({
  levels,
  className,
  dark,
  waveStyle = "default",
  accentColor = "#6366f1",
}: {
  levels: number[];
  className?: string;
  dark?: boolean;
  waveStyle?: SpeechRecordingWaveStyle;
  accentColor?: string;
}) {
  const n = levels.length;
  if (n < 1) return null;
  const vbW = 100;
  /** Keep in sync with `h-[36px]` on the waveform so px ↔ viewBox Y matches. */
  const waveformPxH = 36;
  const vbH = 36;
  const maxRectPx = 24;
  const minRectPx = 2;
  const padX = 0.75;
  const padY = 3;
  const innerW = vbW - 2 * padX;
  const minGap = n > 48 ? 0.065 : n > 36 ? 0.075 : n > 24 ? 0.09 : 0.11;
  const gap = n > 1 ? minGap : 0;
  const barW = n > 0 ? (innerW - gap * (n - 1)) / n : 0;
  /** Thinner pills than the layout column (centered in each slot). */
  const barRenderW = barW * 0.62;
  const barXInset = (barW - barRenderW) / 2;
  const maxBarH = vbH - 2 * padY;
  /** `<rect height>` limits in viewBox units (= px when `vbH === waveformPxH`). */
  const maxRectHeight = (maxRectPx / waveformPxH) * vbH;
  const minRectHeight = (minRectPx / waveformPxH) * vbH;
  const cy = vbH / 2;
  /** Full-scale level (amp=1) maps to `maxRectPx` before clamp. */
  const barPeakScale = maxRectHeight / maxBarH;
  /** Silence → nearly flat; loud speech → `maxRectPx`; clamp applied when drawing. */
  const barHalfHeight = (level: number) => {
    const v = Math.min(1, Math.max(0, level));
    const quietEnd = 0.16;
    const quietAmp = 0.008;
    const amp =
      v <= quietEnd
        ? (v / quietEnd) * quietAmp
        : quietAmp + Math.pow((v - quietEnd) / (1 - quietEnd), 0.72) * (1 - quietAmp);
    return (amp * maxBarH * barPeakScale) / 2;
  };
  const toneClass =
    waveStyle === "brand"
      ? undefined
      : waveStyle === "defaultDark"
        ? dark
          ? "text-white/80"
          : "text-gray-800"
        : dark
          ? "text-slate-500"
          : "text-slate-400";

  return (
    <svg
      className={cx("fill-current", toneClass, className)}
      style={waveStyle === "brand" ? { color: accentColor.trim() || "#6366f1" } : undefined}
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => {
        const level = levels[i] ?? 0;
        const halfH = barHalfHeight(level);
        const h = Math.min(
          maxRectHeight,
          Math.max(minRectHeight, halfH * 2),
        );
        const halfClamped = h / 2;
        const x = padX + i * (barW + gap) + barXInset;
        const y = cy - halfClamped;
        const rx =
          barRenderW >= 0.9 ? barRenderW / 2 : Math.max(0.28, barRenderW * 0.48);
        return <rect key={i} x={x} y={y} width={barRenderW} height={h} rx={rx} />;
      })}
    </svg>
  );
}

/** Classic mic: capsule, base arc, stem (reads clearly at 18px). */
function MicIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </svg>
  );
}

/** Filled stop square — standard “stop recording” affordance inside the circular control. */
function StopRecordingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="1.75" />
    </svg>
  );
}

/** Upward send arrow (ChatGPT-style) */
function SendUpIcon({ className, strokeWidth = 2.25 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
    </svg>
  );
}

/** Plain circular loader (single stroke arc). */
function ComposerTranscribeSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx("h-[18px] w-[18px] shrink-0 animate-spin motion-reduce:animate-none", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="26 58"
      />
    </svg>
  );
}

/** More text above — scroll up / go to top. */
function ComposerScrollUpIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" />
    </svg>
  );
}

/** More text below — scroll down / go to bottom. */
function ComposerScrollDownIcon({ className, strokeWidth = 2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** After “Use voice” recording: same wave player as sent messages (ChatUserVoiceMessage), then discard + send. */
function VoiceMessageComposerPreview({
  className,
  dark,
  accentColor,
  speechRecordingWaveStyle,
  meta,
  onDiscard,
  onSend,
  sendLabel,
  sendDisabled,
  inputDisabled,
  composerActionBtn,
  composerIconHoverTarget,
  INNER_ICON_CLASS,
}: {
  className?: string;
  dark: boolean;
  accentColor: string;
  speechRecordingWaveStyle: SpeechRecordingWaveStyle;
  meta: ChatSpeechInputMeta;
  onDiscard: () => void;
  onSend: () => void;
  sendLabel: string;
  sendDisabled: boolean;
  inputDisabled: boolean;
  composerActionBtn: { className: string; style?: React.CSSProperties };
  composerIconHoverTarget: string;
  INNER_ICON_CLASS: string;
}) {
  const url = (meta.audioUrl ?? "").trim();

  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-2 rounded-[22px] border px-1 pt-0 pb-1",
        dark ? "border-gray-500/60 bg-gray-800/50" : "border-gray-200 bg-white",
        className,
      )}
    >
      {url ? (
        <ChatUserVoiceMessage
          messageId="composer-voice-preview"
          audioUrl={url}
          durationMs={meta.durationMs}
          dark={dark}
          onAccent={false}
          disabled={inputDisabled}
          accentColor={accentColor}
          composerPlayButton={composerActionBtn}
          speechRecordingWaveStyle={speechRecordingWaveStyle}
          className="w-full min-w-0 !max-w-none"
        />
      ) : (
        <div
          className={cx(
            "flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs",
            dark ? "border-gray-600/80 text-gray-500" : "border-gray-300 text-gray-500",
          )}
        >
          <span className="min-w-0 flex-1 truncate">No audio for preview</span>
        </div>
      )}
      <div className="flex w-full min-w-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={inputDisabled}
          className={cx(
            "group flex shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/45 focus-visible:ring-offset-1",
            INNER_CTRL_CLASS,
            dark
              ? "text-red-400 hover:border-red-500/35 hover:bg-red-500/20 hover:text-red-300 focus-visible:ring-offset-gray-800/50"
              : "text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:ring-offset-white",
            "disabled:pointer-events-none disabled:opacity-45",
          )}
          aria-label="Discard voice message"
          title="Discard"
        >
          <Trash2 className={INNER_ICON_CLASS} strokeWidth={1.85} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={sendDisabled || inputDisabled}
          className={cx(composerActionBtn.className, "group")}
          style={composerActionBtn.style}
          aria-label={sendLabel}
          title={sendLabel}
        >
          <span className={composerIconHoverTarget}>
            <SendUpIcon className={INNER_ICON_CLASS} strokeWidth={2} />
          </span>
        </button>
      </div>
    </div>
  );
}

const circleBtnBase =
  "flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:pointer-events-none";

/** Parent control adds `group`. Hover grows only this wrapper (glyph), not the button size. */
const composerIconHoverTarget =
  "inline-flex origin-center transition-transform duration-150 ease-out group-hover:scale-110 motion-reduce:group-hover:scale-100 group-disabled:group-hover:scale-100";

export interface ChatComposerProps {
  /** Dark theme (default true) */
  dark?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** Disables only the textarea (e.g. read-only conversation view). */
  inputDisabled?: boolean;
  /** Blocks send button and Enter-to-send (e.g. while a message is in flight). */
  sendDisabled?: boolean;
  /** @deprecated Use `inputDisabled` and `sendDisabled`. */
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  /** Accent color for send button */
  accentColor?: string;
  /** Max character count for input (optional) */
  inputMaxLength?: number;
  /** Max rows for auto-grow textarea (default 8) */
  maxComposerRows?: number;
  /** Show attach button */
  showAttach?: boolean;
  /** Show microphone (dictate) button */
  showMic?: boolean;
  /** Show voice (waveform) button */
  showVoice?: boolean;
  /** When true, composer is a separate box (border-top + bg). When false, no border and no bg. */
  asSeparateBox?: boolean;
  /** Message input border width in px. 0 = default 1px; 0.5–6 = custom. Focus = width × 1.5. Default 1. */
  composerBorderWidth?: number;
  /** When width >= 0.5: "default" = gray, "primary" = brand accent border. Default "primary". */
  composerBorderColor?: "default" | "primary";
  /** Send + voice (waveform) controls: brand fill, neutral, or dark chip. */
  composerControlStyle?: ComposerControlStyle;
  /** Live recording level meter bar tint. */
  speechRecordingWaveStyle?: SpeechRecordingWaveStyle;
  onAttach?: () => void;
  /** When pending files exist, opens full-screen attachments (picker stays on {@link onAttach}). */
  onOpenPendingAttachments?: () => void;
  /** @deprecated Prefer `onBeginSpeech` for dictate vs voice. */
  onMic?: () => void;
  /** Mic = dictate, waveform = voice. When set, overrides `onMic` for those controls. */
  onBeginSpeech?: (mode: "dictate" | "voice") => void;
  /** Browser capture session: attach shows close; input shows waveform; trailing shows Stop / Send. */
  speechCaptureActive?: boolean;
  /** Which capture UI is active when `speechCaptureActive` (dictate vs voice note). */
  speechCaptureMode?: "dictate" | "voice" | null;
  speechCaptureProcessing?: boolean;
  /** Live level per bar (0–1) from Web Audio time-domain waveform; when set while listening, replaces static icon. */
  speechWaveformLevels?: number[];
  onSpeechCaptureCancel?: () => void;
  onSpeechCaptureStop?: () => void;
  onSpeechCaptureSend?: () => void;
  /** @deprecated Stop control removed; end recording with Send or Cancel. */
  stopSpeechLabel?: string;
  sendVoiceLabel?: string;
  /** Elapsed ms while recording dictate or voice (clock to the left of the waveform). */
  speechRecordingElapsedMs?: number;
  /** Optional ref to the message textarea (e.g. focus when panel opens). */
  textAreaRef?: Ref<HTMLTextAreaElement>;
  /** Files staged in the composer before send (name chips). */
  pendingAttachments?: Array<{ id: string; label: string }>;
  onRemovePendingAttachment?: (id: string) => void;
  /** When false, hide chip row (e.g. attachments managed on full-screen sheet). Default true. */
  showPendingAttachmentChips?: boolean;
  /**
   * “Use voice” only: after recording + transcribe, a two-row preview (play / waves / time, then
   * attach / discard / send) instead of sending immediately. Dictate is unchanged.
   */
  voiceMessagePreview?: ChatSpeechInputMeta | null;
  /** Clears the staged voice message and the composer. */
  onVoiceMessagePreviewDiscard?: () => void;
  className?: string;
}

export function ChatComposer({
  dark = true,
  value,
  onChange,
  onSend,
  inputDisabled: inputDisabledProp,
  sendDisabled: sendDisabledProp,
  disabled: disabledLegacy = false,
  placeholder = "Type a message…",
  sendLabel = "Send",
  accentColor = "#6366f1",
  inputMaxLength,
  maxComposerRows = DEFAULT_MAX_ROWS,
  showAttach = true,
  showMic = true,
  showVoice = true,
  asSeparateBox = true,
  composerBorderWidth = 1,
  composerBorderColor = "primary",
  composerControlStyle = "defaultDark",
  speechRecordingWaveStyle = "default",
  onAttach,
  onOpenPendingAttachments,
  onMic,
  onBeginSpeech,
  speechCaptureActive = false,
  speechCaptureMode = null,
  speechCaptureProcessing = false,
  speechWaveformLevels,
  onSpeechCaptureCancel,
  onSpeechCaptureStop: _onSpeechCaptureStop,
  onSpeechCaptureSend,
  stopSpeechLabel: _stopSpeechLabel = "Stop",
  sendVoiceLabel: _sendVoiceLabel = "Send",
  speechRecordingElapsedMs = 0,
  textAreaRef: externalTextAreaRef,
  pendingAttachments,
  onRemovePendingAttachment,
  showPendingAttachmentChips = true,
  voiceMessagePreview = null,
  onVoiceMessagePreviewDiscard,
  className,
}: ChatComposerProps) {
  const inputDisabled = inputDisabledProp ?? disabledLegacy;
  const sendDisabled = sendDisabledProp ?? disabledLegacy;
  const hasText = value.trim().length > 0;
  const hasPendingAttachments = (pendingAttachments?.length ?? 0) > 0;
  const hasTextOrAttachments = hasText || hasPendingAttachments;
  /** Both on: no text = mic + voice (voice accented); with text = mic + send (voice slot becomes send). Attachments alone keep voice, not send. */
  const bothSpeechOn = showMic && showVoice;
  const showSendAlways = !bothSpeechOn;
  const inSpeech = speechCaptureActive;
  const showVoiceMessagePreview = Boolean(
    onVoiceMessagePreviewDiscard && voiceMessagePreview?.mode === "voice",
  );
  /** Dictate = mic; voice = voice note. When mode is briefly null while active, treat as dictate for button wiring. */
  const speechModeEffective = speechCaptureMode ?? "dictate";
  const isDictateCapture = speechModeEffective === "dictate";
  const showLiveSpeechWaveform =
    !speechCaptureProcessing &&
    Array.isArray(speechWaveformLevels) &&
    speechWaveformLevels.length >= SPEECH_WAVEFORM_SCROLL_BARS;
  const showRecordingClock =
    !speechCaptureProcessing &&
    (speechCaptureMode === "dictate" || speechCaptureMode === "voice");
  const showTrailingColumn =
    inSpeech || hasText || hasPendingAttachments || showMic || showVoice || showSendAlways;
  const startSpeech = onBeginSpeech ?? ((mode: "dictate" | "voice") => {
    void mode;
    onMic?.();
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      if (!externalTextAreaRef) return;
      if (typeof externalTextAreaRef === "function") {
        externalTextAreaRef(el);
      } else {
        (externalTextAreaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    },
    [externalTextAreaRef],
  );

  const [composerCanScroll, setComposerCanScroll] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const SCROLL_EDGE_PX = 4;

  const syncComposerScrollHints = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      setComposerCanScroll(false);
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const overflow = el.scrollHeight > el.clientHeight + 1;
    if (!overflow) {
      setComposerCanScroll(false);
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    setComposerCanScroll(true);
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const t = el.scrollTop;
    setCanScrollUp(t > SCROLL_EDGE_PX);
    setCanScrollDown(t < maxScroll - SCROLL_EDGE_PX);
  }, []);

  const scrollComposerToTop = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.scrollTop = 0;
    syncComposerScrollHints();
  }, [syncComposerScrollHints]);

  const scrollComposerToBottom = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    syncComposerScrollHints();
  }, [syncComposerScrollHints]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (inSpeech) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!sendDisabled && (value.trim() || hasPendingAttachments)) onSend();
      }
    },
    [inSpeech, sendDisabled, value, onSend, hasPendingAttachments],
  );

  // Auto-grow textarea from 40px row height
  useEffect(() => {
    if (inSpeech) return;
    const el = textareaRef.current;
    if (!el) return;
    if (!value.trim()) {
      el.style.height = `${ROW_MIN_PX}px`;
    } else {
      el.style.height = "auto";
      const rows = Math.min(
        maxComposerRows,
        Math.max(MIN_ROWS, Math.ceil(el.scrollHeight / LINE_HEIGHT)),
      );
      el.style.height = `${Math.max(ROW_MIN_PX, rows * LINE_HEIGHT)}px`;
    }
    requestAnimationFrame(() => syncComposerScrollHints());
  }, [inSpeech, value, maxComposerRows, syncComposerScrollHints]);

  const pillStyle = (() => {
    const usePrimary = composerBorderColor === "primary";
    const grayBorder = dark ? "#4b5563" : "#d1d5db";
    const grayFocus = dark ? "#6b7280" : "#9ca3af";
    const width = composerBorderWidth >= 0.5 ? composerBorderWidth : 1;
    const focusWidth = composerBorderWidth >= 0.5 ? Math.min(composerBorderWidth * 1.5, 5) : 1;
    return {
      borderWidth: width,
      borderStyle: "solid",
      borderColor:
        composerBorderWidth >= 0.5 && usePrimary && accentColor ? `${accentColor}99` : grayBorder,
      ["--chat-accent" as string]: accentColor || "#6366f1",
      ["--composer-border-width" as string]: `${width}px`,
      ["--composer-border-width-focus" as string]: `${focusWidth}px`,
      ["--composer-border-color-focus" as string]:
        composerBorderWidth >= 0.5 && usePrimary ? "var(--chat-accent)" : grayFocus,
    } as React.CSSProperties;
  })();

  const circleIdle = dark
    ? "border-gray-600 bg-gray-800/80 text-gray-300 hover:bg-gray-700/90 focus-visible:ring-gray-500/60 focus-visible:ring-offset-gray-900"
    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 focus-visible:ring-gray-400/70 focus-visible:ring-offset-white";

  /** Icon buttons embedded in the composer pill (no outer ring; matches in-field affordances). */
  const innerIconBtn = dark
    ? "border border-transparent text-gray-300 hover:bg-gray-700/55 focus-visible:ring-gray-500/50 focus-visible:ring-offset-0 focus-visible:ring-offset-gray-800/50 disabled:!opacity-100 disabled:cursor-default disabled:text-gray-400 disabled:border-gray-500 disabled:bg-gray-900/70 disabled:ring-1 disabled:ring-inset disabled:ring-gray-500/40"
    : "border border-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400/60 focus-visible:ring-offset-0 focus-visible:ring-offset-white disabled:!opacity-100 disabled:cursor-default disabled:text-gray-500 disabled:border-gray-300 disabled:bg-gray-100 disabled:ring-1 disabled:ring-inset disabled:ring-gray-300/90";

  /** Scroll chevrons: lighter than mic; disabled = muted (still visible). */
  const scrollHintBtn = dark
    ? "text-gray-500 hover:bg-gray-700/40 hover:text-gray-400 focus-visible:ring-gray-500/35 focus-visible:ring-offset-0 focus-visible:ring-offset-gray-800/50 disabled:pointer-events-none disabled:text-gray-600/55 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-600/55"
    : "text-gray-400 hover:bg-gray-100/80 hover:text-gray-500 focus-visible:ring-gray-400/45 focus-visible:ring-offset-0 focus-visible:ring-offset-white disabled:pointer-events-none disabled:text-gray-300 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gray-300";

  /** Soft (light) red stop — translucent chip, not solid. Disabled: clear “off” look without not-allowed cursor. */
  const lightStopBtn =
    "composer-stop-heartbeat--light " +
    (dark
      ? "border border-rose-500/40 bg-rose-500/12 text-rose-200/95 hover:border-rose-500/50 hover:bg-rose-500/18 focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-800/50 disabled:cursor-default disabled:opacity-85 disabled:brightness-95 disabled:saturate-75 disabled:border-rose-500/35 disabled:bg-rose-950/35 disabled:text-rose-200/80 disabled:ring-0"
      : "border border-rose-200/90 bg-rose-50/90 text-rose-600 hover:border-rose-300 hover:bg-rose-100/90 focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:cursor-default disabled:opacity-90 disabled:brightness-[0.99] disabled:saturate-75 disabled:border-rose-300/95 disabled:bg-rose-100/80 disabled:text-rose-600/90 disabled:ring-0");

  const composerActionBtn = useMemo((): { className: string; style?: React.CSSProperties } => {
    const disabledTone =
      "disabled:pointer-events-none disabled:!cursor-default disabled:!opacity-100";
    const neutral = cx(
      "flex shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,box-shadow] duration-150 ease-out shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
      disabledTone,
      INNER_CTRL_CLASS,
      dark
        ? "border-white/10 bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] focus-visible:ring-white/30 focus-visible:ring-offset-gray-800/50 disabled:text-gray-500 disabled:border-gray-600 disabled:bg-gray-900/80"
        : "border-gray-200/80 bg-gray-50 text-gray-700 hover:bg-gray-100/85 focus-visible:ring-gray-400/50 focus-visible:ring-offset-white disabled:text-gray-400 disabled:border-gray-300 disabled:bg-gray-200/90",
    );
    const darkChip = cx(
      "flex shrink-0 items-center justify-center rounded-full border text-white shadow-sm transition-[background-color,box-shadow,filter] duration-150 ease-out hover:shadow-md active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
      disabledTone,
      INNER_CTRL_CLASS,
      dark
        ? "border-white/12 bg-gray-950 hover:bg-black focus-visible:ring-white/35 focus-visible:ring-offset-gray-800/50 disabled:text-gray-400 disabled:border-gray-500 disabled:bg-gray-900/80 disabled:brightness-90"
        : "border-gray-800/25 bg-gray-900 hover:bg-gray-800 focus-visible:ring-gray-400/50 focus-visible:ring-offset-white disabled:text-gray-400 disabled:border-gray-500 disabled:bg-gray-800 disabled:brightness-95",
    );
    const acc = (accentColor ?? "").trim() || "#6366f1";
    switch (composerControlStyle) {
      case "default":
        return { className: neutral };
      case "defaultDark":
        return { className: darkChip };
      case "brand": {
        const light = isLightAccentColor(acc);
        return {
          className: cx(
            "flex shrink-0 items-center justify-center rounded-full border text-center shadow-sm transition-[background-color,box-shadow,filter] duration-150 ease-out hover:shadow-md active:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
            disabledTone,
            INNER_CTRL_CLASS,
            light
              ? "border-gray-900/18 focus-visible:ring-gray-900/28 focus-visible:ring-offset-white disabled:brightness-90"
              : "border-white/22 focus-visible:ring-white/38 focus-visible:ring-offset-gray-800/50 disabled:brightness-75",
          ),
          style: { backgroundColor: acc, color: light ? "#111827" : "#ffffff" },
        };
      }
      default:
        return { className: darkChip };
    }
  }, [accentColor, composerControlStyle, dark]);

  return (
    <div
      className={cx(
        "flex-shrink-0 px-3 py-2.5",
        asSeparateBox && "border-t",
        asSeparateBox && (dark ? "border-gray-700 bg-gray-900/30" : "border-gray-200 bg-gray-50"),
        className,
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inSpeech) return;
          if (!sendDisabled && (value.trim() || hasPendingAttachments)) onSend();
        }}
        className="flex flex-col"
      >
        {hasPendingAttachments && showPendingAttachmentChips ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pendingAttachments!.map((a) => (
              <span
                key={a.id}
                className={cx(
                  "inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-xs",
                  dark ? "border-gray-600 bg-gray-800/80 text-gray-200" : "border-gray-200 bg-white text-gray-700",
                )}
              >
                <span className="min-w-0 truncate" title={a.label}>
                  {a.label}
                </span>
                <button
                  type="button"
                  onClick={() => onRemovePendingAttachment?.(a.id)}
                  className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  aria-label={`Remove ${a.label}`}
                  title={`Remove ${a.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          {(showAttach && !inSpeech && !hasPendingAttachments) ||
          (showAttach && inSpeech) ||
          (hasPendingAttachments && onOpenPendingAttachments && !inSpeech) ? (
            <div className="flex items-end gap-1">
              {!inSpeech && !hasPendingAttachments && showAttach ? (
                <button
                  type="button"
                  onClick={onAttach}
                  className={cx(circleBtnBase, circleIdle, "group", "w-10 px-0")}
                  aria-label="Attach file"
                  title="Attach file"
                >
                  <span
                    className={cx(
                      "relative flex h-[18px] w-[18px] shrink-0 items-center justify-center",
                      composerIconHoverTarget,
                    )}
                  >
                    <PlusIcon
                      className={cx(
                        INNER_ICON_CLASS,
                        "absolute transition-all duration-200 ease-out motion-reduce:transition-none",
                        "rotate-0 scale-100 opacity-100",
                      )}
                      strokeWidth={1.85}
                    />
                    <CloseIcon
                      className={cx(
                        INNER_ICON_CLASS,
                        "absolute transition-all duration-200 ease-out motion-reduce:transition-none",
                        "pointer-events-none -rotate-90 scale-50 opacity-0",
                      )}
                      strokeWidth={1.85}
                    />
                  </span>
                </button>
              ) : null}
              {inSpeech && showAttach && onSpeechCaptureCancel ? (
                <button
                  type="button"
                  onClick={onSpeechCaptureCancel}
                  className={cx(circleBtnBase, circleIdle, "group", "w-10 px-0")}
                  aria-label="Cancel recording"
                  title="Cancel recording"
                  disabled={speechCaptureProcessing || inputDisabled}
                >
                  <span className={cx("inline-flex shrink-0", composerIconHoverTarget)}>
                    <CloseIcon className={INNER_ICON_CLASS} strokeWidth={1.85} />
                  </span>
                </button>
              ) : null}
              {hasPendingAttachments && onOpenPendingAttachments && !inSpeech ? (
                <button
                  type="button"
                  onClick={onOpenPendingAttachments}
                  className={cx(circleBtnBase, circleIdle, "group w-10 px-0")}
                  aria-label={`${pendingAttachments!.length} attachment${pendingAttachments!.length === 1 ? "" : "s"} — view and manage`}
                  title={`${pendingAttachments!.length} attachment${pendingAttachments!.length === 1 ? "" : "s"} — view and manage`}
                >
                  <span
                    className={cx(
                      "inline-flex min-w-0 max-w-full items-center justify-center",
                      composerIconHoverTarget,
                    )}
                  >
                    <AttachmentCountBadge
                      count={pendingAttachments!.length}
                      dark={dark}
                      embedded
                      className="min-w-0 max-w-full justify-center gap-0.5 !text-[10px] font-bold leading-none tabular-nums [&_svg]:!h-3.5 [&_svg]:!w-3.5"
                    />
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
          {showVoiceMessagePreview && voiceMessagePreview ? (
            <VoiceMessageComposerPreview
              className="min-w-0 flex-1"
              dark={dark}
              accentColor={accentColor}
              speechRecordingWaveStyle={speechRecordingWaveStyle}
              meta={voiceMessagePreview}
              onDiscard={onVoiceMessagePreviewDiscard!}
              onSend={onSend}
              sendLabel={sendLabel}
              sendDisabled={sendDisabled}
              inputDisabled={inputDisabled}
              composerActionBtn={composerActionBtn}
              composerIconHoverTarget={composerIconHoverTarget}
              INNER_ICON_CLASS={INNER_ICON_CLASS}
            />
          ) : (
          <div
            className={cx(
              "flex min-h-10 min-w-0 flex-1 items-stretch gap-1 rounded-[22px] transition-[border-color,border-width] chat-composer-input-wrapper",
              composerBorderWidth >= 0.5 && "chat-composer-input-wrapper--custom",
              dark ? "bg-gray-800/50" : "bg-white",
            )}
            style={pillStyle}
          >
            {inSpeech ? (
              <div
                className={cx(
                  "flex min-h-10 min-w-0 flex-1 items-center self-stretch py-0.5 pl-3 pr-1",
                  speechCaptureProcessing && "gap-1.5",
                  speechCaptureProcessing
                    ? "opacity-70 text-gray-500 dark:text-gray-400"
                    : dark
                      ? "text-gray-200"
                      : "text-gray-800",
                )}
                role="status"
                aria-live="polite"
                aria-label={speechCaptureProcessing ? undefined : "Recording"}
              >
                {speechCaptureProcessing ? (
                  <>
                    <ComposerTranscribeSpinner className="shrink-0" />
                    <span className="text-[15px] leading-5">
                      {speechCaptureMode === "voice" ? "Processing…" : "Transcribing…"}
                    </span>
                  </>
                ) : showLiveSpeechWaveform && speechWaveformLevels ? (
                  <div className="flex min-h-[36px] min-w-0 w-full flex-1 items-center gap-2">
                    {showRecordingClock ? (
                      <span
                        className={cx(
                          "flex h-[36px] shrink-0 items-center tabular-nums text-[13px] font-medium leading-none",
                          dark ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        {formatRecordingClock(speechRecordingElapsedMs)}
                      </span>
                    ) : null}
                    <SpeechLevelWaveform
                      dark={dark}
                      levels={speechWaveformLevels}
                      waveStyle={speechRecordingWaveStyle}
                      accentColor={accentColor}
                      className="h-[36px] min-h-[36px] max-h-[36px] min-w-0 flex-1"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-8 min-w-0 w-full flex-1 items-center gap-2">
                    {showRecordingClock ? (
                      <span
                        className={cx(
                          "flex h-8 shrink-0 items-center tabular-nums text-[13px] font-medium leading-none",
                          dark ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        {formatRecordingClock(speechRecordingElapsedMs)}
                      </span>
                    ) : null}
                    <VoiceWavesIcon
                      stretch
                      className="h-5 min-h-[20px] min-w-0 flex-1 animate-pulse text-emerald-400"
                    />
                  </div>
                )}
              </div>
            ) : (
              <textarea
                ref={setTextareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={syncComposerScrollHints}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                maxLength={inputMaxLength}
                disabled={inputDisabled}
                className={cx(
                  "box-border min-h-10 min-w-0 flex-1 resize-none overflow-y-auto self-stretch bg-transparent py-2.5 pl-4 scrollbar-hide chat-composer-textarea",
                  showTrailingColumn ? "pr-1" : "pr-4",
                  "text-[15px] leading-5 focus:outline-none disabled:cursor-default disabled:opacity-50",
                  dark ? "text-gray-200 placeholder:text-gray-500" : "text-gray-800 placeholder:text-gray-400",
                )}
                aria-label={placeholder}
                style={{
                  height: `${ROW_MIN_PX}px`,
                  minHeight: `${ROW_MIN_PX}px`,
                  maxHeight: `${maxComposerRows * LINE_HEIGHT}px`,
                }}
              />
            )}
            {showTrailingColumn ? (
              <div className="flex min-h-10 min-w-0 flex-col items-end self-stretch pr-1 pb-1">
                {!inSpeech && composerCanScroll ? (
                  <div className="mb-1 flex shrink-0 flex-col items-end gap-0.5 pt-2">
                    <button
                      type="button"
                      disabled={!canScrollUp}
                      onClick={scrollComposerToTop}
                      title={canScrollUp ? "More text above" : "At top of message"}
                      className={cx(
                        "flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2",
                        SCROLL_HINT_CTRL_CLASS,
                        scrollHintBtn,
                      )}
                      aria-label={canScrollUp ? "Scroll to top of message" : "Already at top of message"}
                    >
                      <ComposerScrollUpIcon className={INNER_ICON_CLASS_SMALL} strokeWidth={1.85} />
                    </button>
                    <button
                      type="button"
                      disabled={!canScrollDown}
                      onClick={scrollComposerToBottom}
                      title={canScrollDown ? "More text below" : "At bottom of message"}
                      className={cx(
                        "flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2",
                        SCROLL_HINT_CTRL_CLASS,
                        scrollHintBtn,
                      )}
                      aria-label={canScrollDown ? "Scroll to bottom of message" : "Already at bottom of message"}
                    >
                      <ComposerScrollDownIcon className={INNER_ICON_CLASS_SMALL} strokeWidth={1.85} />
                    </button>
                  </div>
                ) : null}
                <div className="min-h-0 min-w-0 flex-1" aria-hidden />
                <div className="flex shrink-0 items-center gap-1">
                  {inSpeech ? (
                    isDictateCapture ? (
                      <>
                        <button
                          type="button"
                          onClick={onSpeechCaptureSend}
                          disabled={speechCaptureProcessing || inputDisabled || !onSpeechCaptureSend}
                          className={cx(
                            "group flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus:outline-none",
                            lightStopBtn,
                          )}
                          aria-label="Stop recording and transcribe"
                          title="Stop recording and transcribe"
                        >
                          <span className={cx("inline-flex shrink-0", composerIconHoverTarget)}>
                            <StopRecordingIcon className="h-[15px] w-[15px]" />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={onSpeechCaptureSend}
                          disabled={speechCaptureProcessing || inputDisabled || !onSpeechCaptureSend}
                          title="Stop recording and transcribe"
                          aria-label="Stop recording and transcribe"
                          className={cx(composerActionBtn.className, "group")}
                          style={composerActionBtn.style}
                        >
                          <span className={composerIconHoverTarget}>
                            <SendUpIcon className={INNER_ICON_CLASS} strokeWidth={2} />
                          </span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={onSpeechCaptureSend}
                        disabled={speechCaptureProcessing || inputDisabled || !onSpeechCaptureSend}
                        className={cx(
                          "group flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus:outline-none",
                          lightStopBtn,
                        )}
                        aria-label="Stop recording"
                        title="Stop recording"
                      >
                        <span className={cx("inline-flex shrink-0", composerIconHoverTarget)}>
                          <StopRecordingIcon className="h-[15px] w-[15px]" />
                        </span>
                      </button>
                    )
                  ) : bothSpeechOn ? (
                    <>
                      {showMic ? (
                        <button
                          type="button"
                          onClick={() => startSpeech("dictate")}
                          title="Dictate"
                          className={cx(
                            "flex shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:pointer-events-none",
                            INNER_CTRL_CLASS,
                            innerIconBtn,
                          )}
                          aria-label="Dictate"
                          disabled={inputDisabled}
                        >
                          <MicIcon className={INNER_ICON_CLASS} strokeWidth={1.85} />
                        </button>
                      ) : null}
                      {showVoice ? (
                        <button
                          type={hasText ? "submit" : "button"}
                          onClick={hasText ? undefined : () => startSpeech("voice")}
                          title={hasText ? sendLabel : "Use voice"}
                          className={cx(composerActionBtn.className, "group")}
                          style={composerActionBtn.style}
                          aria-label={hasText ? sendLabel : "Use voice"}
                          disabled={hasText ? sendDisabled : inputDisabled}
                        >
                          <span
                            className={cx(
                              "relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center",
                              composerIconHoverTarget,
                            )}
                          >
                            <VoiceWavesIcon
                              className={cx(
                                INNER_ICON_CLASS,
                                "absolute transition-all duration-200 ease-out motion-reduce:transition-none",
                                hasText
                                  ? "pointer-events-none scale-50 opacity-0"
                                  : "scale-100 opacity-100",
                              )}
                            />
                            <SendUpIcon
                              className={cx(
                                INNER_ICON_CLASS,
                                "absolute transition-all duration-200 ease-out motion-reduce:transition-none",
                                hasText
                                  ? "scale-100 opacity-100"
                                  : "pointer-events-none scale-50 opacity-0",
                              )}
                              strokeWidth={2}
                            />
                          </span>
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {showMic ? (
                        <button
                          type="button"
                          onClick={() => startSpeech("dictate")}
                          title="Dictate"
                          className={cx(
                            "flex shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:pointer-events-none",
                            INNER_CTRL_CLASS,
                            innerIconBtn,
                          )}
                          aria-label="Dictate"
                          disabled={inputDisabled}
                        >
                          <MicIcon className={INNER_ICON_CLASS} strokeWidth={1.85} />
                        </button>
                      ) : null}
                      {showVoice ? (
                        <button
                          type="button"
                          onClick={() => startSpeech("voice")}
                          title="Use voice"
                          className={cx(
                            "flex shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 disabled:pointer-events-none",
                            INNER_CTRL_CLASS,
                            innerIconBtn,
                          )}
                          aria-label="Use voice"
                          disabled={inputDisabled}
                        >
                          <VoiceWavesIcon className={INNER_ICON_CLASS} />
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        disabled={!hasTextOrAttachments || sendDisabled}
                        className={cx(composerActionBtn.className, "group")}
                        style={composerActionBtn.style}
                        aria-label={sendLabel}
                        title={sendLabel}
                      >
                        <span className={composerIconHoverTarget}>
                          <SendUpIcon className={INNER_ICON_CLASS} strokeWidth={2} />
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          )}
        </div>
      </form>
    </div>
  );
}
