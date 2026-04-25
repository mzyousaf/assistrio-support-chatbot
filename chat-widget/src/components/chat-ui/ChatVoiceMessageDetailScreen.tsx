import React from "react";
import type { UserBubbleStyle } from "../../models/botChatUI";
import type { ChatSpeechInputMeta } from "./types";
import { ChatUserVoiceMessage } from "./ChatUserVoiceMessage";
import { cx } from "./utils";

const BackIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

function VoiceHeaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <rect x="3" y="10" width="2.5" height="4" rx="0.6" />
      <rect x="7.5" y="7" width="2.5" height="10" rx="0.6" />
      <rect x="12" y="9" width="2.5" height="6" rx="0.6" />
      <rect x="16.5" y="5" width="2.5" height="14" rx="0.6" />
    </svg>
  );
}

export function ChatVoiceMessageDetailScreen({
  dark = true,
  accentColor = "#6366f1",
  userVoiceBubbleStyle = "primary",
  bubbleBorderRadius = 20,
  messageId = "voice-detail",
  title,
  backLabel,
  speech,
  onBack,
}: {
  dark?: boolean;
  accentColor?: string;
  userVoiceBubbleStyle?: UserBubbleStyle;
  bubbleBorderRadius?: number;
  messageId?: string;
  title: string;
  backLabel: string;
  speech: ChatSpeechInputMeta;
  onBack: () => void;
}) {
  const onAccent = userVoiceBubbleStyle === "primary" && Boolean(accentColor?.trim());
  const neutralBubbleBlack = userVoiceBubbleStyle === "defaultDark";
  const userUsesPrimaryBubble = userVoiceBubbleStyle === "primary";
  const userIsDefaultDark = userVoiceBubbleStyle === "defaultDark";
  const radiusPx = Math.max(0, Math.min(32, bubbleBorderRadius));

  const bubbleSurfaceClass = cx(
    "chat-bubble-surface inline-block max-w-full min-w-0 align-top box-border px-3 py-2.5 text-left text-sm font-normal leading-relaxed",
    "break-words [overflow-wrap:anywhere]",
    userUsesPrimaryBubble && "text-white",
    !userUsesPrimaryBubble && userIsDefaultDark && "text-white bg-black border border-gray-600/80",
    !userUsesPrimaryBubble &&
      !userIsDefaultDark &&
      (dark
        ? "text-gray-100 bg-gray-600/78 border border-gray-500/40"
        : "text-gray-800 bg-gray-100 border border-gray-200/85"),
  );

  const bubbleInlineStyle: React.CSSProperties = userUsesPrimaryBubble && accentColor
    ? { backgroundColor: accentColor, color: "#fff", borderRadius: `${radiusPx}px` }
    : { borderRadius: `${radiusPx}px` };

  const url = (speech.audioUrl ?? "").trim();
  const transcript = (speech.transcript ?? "").trim();

  return (
    <div
      className={cx("flex h-full min-h-0 min-w-0 flex-col", dark ? "bg-gray-900 text-gray-200" : "bg-white text-gray-800")}
    >
      <div
        className={cx(
          "relative flex min-h-[48px] flex-shrink-0 items-center border-b px-2 py-2",
          dark ? "border-gray-700 bg-gray-900/80" : "border-gray-200 bg-gray-50/95",
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className={cx(
            "relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors",
            dark ? "text-gray-300 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-100",
          )}
          aria-label={backLabel}
        >
          <BackIcon />
        </button>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full items-center justify-center px-12">
          <div className="flex min-w-0 max-w-full items-center justify-center gap-2">
            <div
              className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full shadow-sm"
              style={{ backgroundColor: accentColor }}
              aria-hidden
            >
              <VoiceHeaderIcon className="h-[16px] w-[16px] text-white" />
            </div>
            <h2
              className={cx("min-w-0 max-w-full truncate text-center text-sm font-semibold", dark ? "text-gray-100" : "text-gray-900")}
            >
              {title}
            </h2>
          </div>
        </div>
        <div className="z-0 ml-auto h-[30px] w-[30px] shrink-0" aria-hidden />
      </div>
      <div
        className={cx(
          "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4",
          dark ? "[scrollbar-width:thin]" : "",
        )}
      >
        {url ? (
          <div className="self-start w-[80%] min-w-0 max-w-[320px]">
            <div className={cx(bubbleSurfaceClass, "block w-full min-w-0")} style={bubbleInlineStyle}>
              <ChatUserVoiceMessage
                messageId={messageId}
                audioUrl={url}
                durationMs={speech.durationMs}
                dark={dark}
                onAccent={onAccent}
                neutralBubbleBlack={neutralBubbleBlack}
                accentColor={accentColor}
                className="w-full min-w-0 !max-w-none"
              />
            </div>
          </div>
        ) : null}
        {url && transcript ? (
          <div
            role="separator"
            aria-hidden
            className={cx("h-px w-full min-w-0 shrink-0 rounded-full", dark ? "bg-gray-600/80" : "bg-gray-200")}
          />
        ) : null}
        {transcript ? (
          <div className="w-full min-w-0 max-w-full self-stretch text-left">
            <p
              className={cx(
                "mb-2 text-left text-xs font-semibold uppercase tracking-wide",
                dark ? "text-gray-500" : "text-gray-500",
              )}
            >
              Transcript
            </p>
            <p
              className={cx(
                "w-full min-w-0 max-w-full text-left whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere] text-gray-500",
              )}
            >
              {transcript}
            </p>
          </div>
        ) : null}
        {!url && !transcript ? (
          <p className={cx("text-sm", dark ? "text-gray-500" : "text-gray-500")}>No voice data.</p>
        ) : null}
      </div>
    </div>
  );
}
