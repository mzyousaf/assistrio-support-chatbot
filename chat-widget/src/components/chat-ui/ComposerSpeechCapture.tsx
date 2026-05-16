import React from "react";
import {
  SPEECH_WAVEFORM_VB_H,
  SPEECH_WAVEFORM_VB_W,
  computeSpeechWaveformBarRects,
} from "../../lib/speech-waveform-layout";
import { SPEECH_WAVEFORM_SCROLL_BARS } from "../../lib/useMediaRecorderCapture";
import { cx } from "./utils";

/** Waveform / voice hint (first control when input is empty). Use `stretch` to fill a wide slot (non-uniform scale). */
export function VoiceWavesIcon({ className, stretch }: { className?: string; stretch?: boolean }) {
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
export function SpeechLevelWaveform({
  levels,
  className,
  dark,
}: {
  levels: number[];
  className?: string;
  dark?: boolean;
}) {
  const rects = computeSpeechWaveformBarRects(levels);
  if (rects.length < 1) return null;
  return (
    <svg
      className={cx(
        "fill-current",
        dark ? "text-[#8ec9f8]" : "text-[#6eb6ea]",
        className,
      )}
      viewBox={`0 0 ${SPEECH_WAVEFORM_VB_W} ${SPEECH_WAVEFORM_VB_H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx} />
      ))}
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

/** Stop recording — filled square (readable at 18px icon size). */
function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  );
}

/** Upward send arrow (ChatGPT-style). */
function SendUpIcon({ className, strokeWidth = 2.25 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
    </svg>
  );
}

const INNER_ICON_CLASS = "h-[18px] w-[18px]";

export interface ComposerSpeechCaptureFieldProps {
  dark?: boolean;
  speechCaptureProcessing: boolean;
  speechWaveformLevels?: number[];
}

/**
 * In-composer recording lane: transcribing state, live waveform, or idle pulse.
 */
export function ComposerSpeechCaptureField({
  dark = true,
  speechCaptureProcessing,
  speechWaveformLevels,
}: ComposerSpeechCaptureFieldProps) {
  const showLiveSpeechWaveform =
    !speechCaptureProcessing &&
    Array.isArray(speechWaveformLevels) &&
    speechWaveformLevels.length >= SPEECH_WAVEFORM_SCROLL_BARS;

  return (
    <div
      className={cx(
        "flex min-h-10 min-w-0 flex-1 items-center self-stretch py-0.5 pl-4 pr-1",
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
          <span className="text-[15px] leading-5">Transcribing...</span>
        </>
      ) : showLiveSpeechWaveform && speechWaveformLevels ? (
        <SpeechLevelWaveform
          dark={dark}
          levels={speechWaveformLevels}
          className="h-[36px] min-h-[36px] max-h-[36px] w-full min-w-0 flex-1"
        />
      ) : (
        <VoiceWavesIcon
          stretch
          className="h-5 min-h-[20px] w-full min-w-0 flex-1 animate-pulse text-emerald-400"
        />
      )}
    </div>
  );
}

export interface ComposerSpeechCaptureActionsProps {
  /** Dictation keeps Stop (finish without sending). Voice uses Send only to post the voice message. */
  showStop: boolean;
  speechCaptureProcessing: boolean;
  inputDisabled?: boolean;
  onStop?: () => void;
  onSend: () => void;
  stopLabel?: string;
  sendLabel?: string;
  /** e.g. ChatComposer `innerSpeechStopBtn` */
  stopButtonClassName: string;
  /** e.g. ChatComposer `composerActionBtn` */
  sendButtonClassName: string;
  composerIconHoverTarget: string;
  innerCtrlClassName: string;
}

/**
 * Trailing Stop + Send while capturing. Voice mode omits Stop when `showStop` is false.
 */
export function ComposerSpeechCaptureActions({
  showStop,
  speechCaptureProcessing,
  inputDisabled = false,
  onStop,
  onSend,
  stopLabel = "Stop",
  sendLabel = "Send",
  stopButtonClassName,
  sendButtonClassName,
  composerIconHoverTarget,
  innerCtrlClassName,
}: ComposerSpeechCaptureActionsProps) {
  const disabled = speechCaptureProcessing || inputDisabled;
  return (
    <>
      {showStop ? (
        <button
          type="button"
          onClick={onStop}
          disabled={disabled}
          title={stopLabel}
          aria-label={stopLabel}
          className={cx(
            "flex shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-45",
            innerCtrlClassName,
            stopButtonClassName,
          )}
        >
          <StopIcon
            className={cx(
              INNER_ICON_CLASS,
              !disabled ? "assistrio-composer-stop-icon--animate" : null,
            )}
          />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        title={sendLabel}
        aria-label={sendLabel}
        className={cx(sendButtonClassName, "group")}
      >
        <span className={composerIconHoverTarget}>
          <SendUpIcon className={INNER_ICON_CLASS} strokeWidth={2} />
        </span>
      </button>
    </>
  );
}
