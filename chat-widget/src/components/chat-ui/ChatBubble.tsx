import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  prepareChatMessageMarkdown,
  prepareChatMessagePlainText,
} from "../../lib/chatMessageDisplay.util";
import { chatRemarkPlugins } from "../../lib/chatMarkdownPlugins";
import { chatMarkdownComponents } from "./chatMarkdownComponents";
import type { UserBubbleStyle } from "../../models/botChatUI";
import type { ChatUIMessage, ChatUISource } from "./types";
import { cx } from "./utils";
import { ChatSources } from "./ChatSources";
import { AttachmentCountBadge } from "./AttachmentCountBadge";
import { ChatUserVoiceMessage } from "./ChatUserVoiceMessage";
import { formatRelativeSendTime } from "./relativeTime";
import { VoiceTranscriptPreview } from "./VoiceTranscriptPreview";

function AssistantThumbUpIcon({ selected, className }: { selected: boolean; className?: string }) {
  const path = selected
    ? "M23,10C23,8.89 22.1,8 21,8H14.68L15.64,3.43C15.66,3.33 15.67,3.22 15.67,3.11C15.67,2.7 15.5,2.32 15.23,2.05L14.17,1L7.59,7.58C7.22,7.95 7,8.45 7,9V19A2,2 0 0,0 9,21H18C18.83,21 19.54,20.5 19.84,19.78L22.86,12.73C22.95,12.5 23,12.26 23,12V10M1,21H5V9H1V21Z"
    : "M5,9V21H1V9H5M9,21A2,2 0 0,1 7,19V9C7,8.45 7.22,7.95 7.59,7.59L14.17,1L15.23,2.06C15.5,2.33 15.67,2.7 15.67,3.11L15.64,3.43L14.69,8H21C22.11,8 23,8.9 23,10V12C23,12.26 22.95,12.5 22.86,12.73L19.84,19.78C19.54,20.5 18.83,21 18,21H9M9,19H18.03L21,12V10H12.21L13.34,4.68L9,9.03V19Z";
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

function AssistantThumbDownIcon({ selected, className }: { selected: boolean; className?: string }) {
  const path = selected
    ? "M19,15H23V3H19M15,3H6C5.17,3 4.46,3.5 4.16,4.22L1.14,11.27C1.05,11.5 1,11.74 1,12V14A2,2 0 0,0 3,16H9.31L8.36,20.57C8.34,20.67 8.33,20.77 8.33,20.88C8.33,21.3 8.5,21.67 8.77,21.94L9.83,23L16.41,16.41C16.78,16.05 17,15.55 17,15V5C17,3.89 16.1,3 15,3Z"
    : "M19,15V3H23V15H19M15,3A2,2 0 0,1 17,5V15C17,15.55 16.78,16.05 16.41,16.41L9.83,23L8.77,21.94C8.5,21.67 8.33,21.3 8.33,20.88L8.36,20.57L9.31,16H3C1.89,16 1,15.1 1,14V12C1,11.74 1.05,11.5 1.14,11.27L4.16,4.22C4.46,3.5 5.17,3 6,3H15M15,5H5.97L3,12V14H11.78L10.65,19.32L15,14.97V5Z";
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export interface ChatBubbleProps {
  /** Dark theme (default true) */
  dark?: boolean;
  message: ChatUIMessage;
  /** Accent color for user bubble (CSS value, e.g. #6366f1) */
  accentColor?: string;
  /** User **text-only** messages. Ignored for voice notes. */
  userTextBubbleStyle?: UserBubbleStyle;
  /** User **voice** messages only. Ignored for text. */
  userVoiceBubbleStyle?: UserBubbleStyle;
  /** Show role + timestamp above/below bubble */
  showMetadata?: boolean;
  /** Display name for assistant (e.g. "Bot Name - AI"). User messages always show "User". */
  senderName?: string;
  /** Show sender/assistant name above messages (default true) */
  showSenderName?: boolean;
  /** Show message time (default true) */
  showTime?: boolean;
  /** Where to show time: "top" (above message) or "bottom" (below; assistant=right, user=left) */
  timePosition?: "top" | "bottom";
  /** Message bubble border radius in px (0–32). Only the bubble div uses this. */
  bubbleBorderRadius?: number;
  /** Show copy button for assistant messages (if false, parent may render it elsewhere) */
  showCopyButton?: boolean;
  /** Render copy button inside bubble; if false, parent renders copy in sources row */
  renderCopyInBubble?: boolean;
  /**
   * @deprecated Assistant replies always render as Markdown. User messages stay plain text.
   */
  allowMarkdown?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  onCopy?: (messageId: string, text: string) => void;
  /** Show sources section (same sources div used for both actor types) */
  showSources?: boolean;
  sourcesLabel?: string;
  onSourceClick?: (source: ChatUISource) => void;
  /** When user message failed to send */
  messageSendFailedLabel?: string;
  retrySendLabel?: string;
  onRetrySend?: (messageId: string) => void;
  /** Thumbs up/down for assistant replies (after message is fully received). */
  showMessageFeedback?: boolean;
  onMessageFeedback?: (rating: "up" | "down") => void;
  feedbackHelpfulLabel?: string;
  feedbackNotHelpfulLabel?: string;
  voiceShowTranscriptLabel?: string;
  voiceHideTranscriptLabel?: string;
  onOpenVoiceMessageDetail?: (messageId: string) => void;
  /** Opens full-screen attachments list for this user message (read-only). */
  onOpenAttachments?: (messageId: string) => void;
  className?: string;
}

function formatTime(createdAt: string): string {
  try {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return createdAt;
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return createdAt;
  }
}

function CopyGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

export function ChatBubble({
  dark = true,
  message,
  accentColor = "#6366f1",
  userTextBubbleStyle = "primary",
  userVoiceBubbleStyle = "primary",
  showMetadata = true,
  senderName,
  showSenderName = true,
  showTime = true,
  timePosition = "top",
  bubbleBorderRadius = 20,
  showCopyButton = true,
  renderCopyInBubble = true,
  allowMarkdown = false,
  copyLabel = "Copy",
  copiedLabel = "Copied!",
  onCopy,
  showSources = true,
  sourcesLabel = "Sources",
  onSourceClick,
  messageSendFailedLabel = "Couldn’t send",
  retrySendLabel = "Retry",
  onRetrySend,
  showMessageFeedback = false,
  onMessageFeedback,
  feedbackHelpfulLabel = "Helpful",
  feedbackNotHelpfulLabel = "Not helpful",
  voiceShowTranscriptLabel = "Show transcript",
  voiceHideTranscriptLabel = "Hide transcript",
  onOpenVoiceMessageDetail,
  onOpenAttachments,
  className,
}: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [relativeTick, setRelativeTick] = useState(0);
  const [voiceTranscriptOpen, setVoiceTranscriptOpen] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isUserVoice =
    isUser &&
    message.speechInput?.mode === "voice" &&
    Boolean(message.speechInput.audioUrl?.trim());
  const voiceTranscript = message.speechInput?.transcript?.trim() ?? "";
  const attachmentCount = message.attachments?.length ?? 0;
  useEffect(() => {
    if (!isAssistant) return;
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [isAssistant]);
  const userFailed = isUser && message.status === "error";
  const userSending = isUser && message.status === "sending";
  const radiusPx = Math.max(0, Math.min(32, bubbleBorderRadius ?? 20));

  const roleLabel = isAssistant && senderName ? senderName : isUser ? "User" : "Assistant";
  const resolvedUserBubbleStyle: UserBubbleStyle = isUserVoice ? userVoiceBubbleStyle : userTextBubbleStyle;
  /** Text vs voice each has its own setting; this drives the outer bubble fill only. */
  const userUsesPrimaryBubble = isUser && resolvedUserBubbleStyle === "primary";
  const userIsDefaultDark = isUser && resolvedUserBubbleStyle === "defaultDark";
  const showTimeAbove = showTime && timePosition !== "bottom";
  const showTimeBelow = showTime && timePosition === "bottom";

  const copyText =
    isUserVoice && message.speechInput?.transcript?.trim()
      ? message.speechInput.transcript.trim()
      : message.content?.trim()
        ? message.content
        : (message.attachments?.map((a) => a.name).join(", ") ?? "");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      onCopy?.(message.id, copyText);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }, [message.id, copyText, onCopy]);

  const isStreaming = message.status === "streaming";
  const plainTextContent = useMemo(
    () => (message.content ? prepareChatMessagePlainText(message.content) : ""),
    [message.content],
  );
  const markdownContent = useMemo(
    () => (message.content ? prepareChatMessageMarkdown(message.content) : ""),
    [message.content],
  );
  /** Assistant content is always Markdown; render it after reveal (avoids broken partial MD during client-side streaming). */
  const showMarkdown = isAssistant && Boolean(markdownContent.trim()) && !isStreaming;
  const isWelcomeAssistant =
    isAssistant && typeof message.id === "string" && message.id.startsWith("welcome_");

  const relativeSentLabel =
    isAssistant && message.createdAt && !isWelcomeAssistant
      ? formatRelativeSendTime(message.createdAt)
      : "";
  void relativeTick; // bump re-renders on interval so “N minutes ago” updates

  const showAssistantFooter =
    isAssistant &&
    (message.status === "sent" || message.status === "error" || isWelcomeAssistant);
  const showAssistantThumbs =
    showMessageFeedback &&
    onMessageFeedback &&
    message.status === "sent" &&
    !isWelcomeAssistant &&
    !isStreaming;
  const showAssistantCopy =
    showCopyButton && Boolean(message.content?.trim()) && message.status !== "streaming";

  const showSourcesRow =
    (isAssistant && showSources && Boolean(message.sources?.length)) ||
    (showMetadata && showTimeBelow && !isWelcomeAssistant);

  const metaClass = cx(
    "text-xs flex items-center gap-2",
    dark ? "text-gray-400" : "text-gray-500",
    isUser && "flex-row-reverse"
  );

  const bubbleSurfaceClass = cx(
    "chat-bubble-surface inline-block max-w-full min-w-0 align-top box-border px-3 py-2.5 text-left text-sm font-normal leading-relaxed",
    "break-words [overflow-wrap:anywhere]",
    isUser && userUsesPrimaryBubble && "text-white",
    isUser && !userUsesPrimaryBubble && userIsDefaultDark && "text-white bg-black border border-gray-600/80",
    isUser &&
      !userUsesPrimaryBubble &&
      !userIsDefaultDark &&
      (dark
        ? "text-gray-100 bg-gray-600/78 border border-gray-500/40"
        : "text-gray-800 bg-gray-100 border border-gray-200/85"),
    isAssistant &&
    (dark
      ? "bg-gray-600/70 text-gray-300 border border-gray-500/55"
      : "bg-gray-50/95 text-gray-700 border border-gray-200/90")
  );

  const bubbleInlineStyle: React.CSSProperties =
    isUser && userUsesPrimaryBubble && accentColor
      ? {
          backgroundColor: accentColor,
          color: "#fff",
          borderRadius: `${radiusPx}px`,
          ...(userSending ? { opacity: 0.88 } : {}),
        }
      : {
          borderRadius: `${radiusPx}px`,
          ...(isUser && userSending ? { opacity: 0.88 } : {}),
        };

  const contentWrapperClass = cx(
    "text-left min-w-0 max-w-full chat-bubble-content",
    "[&>*]:min-w-0 [&>*]:max-w-full",
  );

  const plainTextClass =
    "whitespace-pre-wrap min-w-0 max-w-full break-words [overflow-wrap:anywhere] chat-bubble-content";

  const messageRowClass = cx(
    "flex w-full min-w-0 max-w-full items-start gap-2",
    isUser ? "justify-end" : "justify-start"
  );

  const bubbleColumnClass = cx(
    "flex min-w-0 max-w-[85%] flex-col gap-0.5",
    isUser ? "w-full items-end" : "w-fit items-start"
  );

  return (
    <article
      className={cx(
        "flex w-full min-w-0 max-w-full flex-col",
        isAssistant ? "gap-0.5" : "gap-1",
        isUser ? "items-end" : "items-start",
        className
      )}
      data-message-id={message.id}
      aria-label={`${roleLabel} message`}
    >
      {showMetadata && (showSenderName || (showTimeAbove && !isWelcomeAssistant)) && (
        <div className={metaClass} aria-hidden>
          {showSenderName && <span>{roleLabel}</span>}
          {showTimeAbove && !isWelcomeAssistant ? (
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          ) : null}
        </div>
      )}

      <div className={messageRowClass}>
        <div className={bubbleColumnClass}>
          {isUserVoice && message.speechInput?.audioUrl ? (
            <div className="flex w-[80%] min-w-0 max-w-[320px] flex-col items-stretch self-end">
              <div className={cx(bubbleSurfaceClass, "block w-full min-w-0")} style={bubbleInlineStyle} role="article">
                <ChatUserVoiceMessage
                  messageId={message.id}
                  audioUrl={message.speechInput.audioUrl}
                  durationMs={message.speechInput.durationMs}
                  /** Play stays available during send/streaming UX; Wavesurfer still gates until waveform is ready (`!isReady`). */
                  disabled={false}
                  dark={dark}
                  onAccent={userVoiceBubbleStyle === "primary" && Boolean(accentColor)}
                  neutralBubbleBlack={userVoiceBubbleStyle === "defaultDark"}
                  accentColor={accentColor}
                  className="w-full min-w-0 !max-w-none"
                />
              </div>
              {isUser && attachmentCount > 0 && !voiceTranscript ? (
                <div className="mt-1 flex w-full min-w-0 max-w-full justify-end">
                  <AttachmentCountBadge
                    count={attachmentCount}
                    dark={dark}
                    onClick={onOpenAttachments ? () => onOpenAttachments(message.id) : undefined}
                  />
                </div>
              ) : null}
              {voiceTranscript ? (
                <div className="mt-0.5 w-full min-w-0 max-w-full flex flex-col items-stretch gap-1">
                  <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setVoiceTranscriptOpen((v) => !v)}
                      aria-expanded={voiceTranscriptOpen}
                      className={cx(
                        "shrink-0 text-right text-[12px] font-medium focus:outline-none focus-visible:ring-2 rounded px-0.5 transition-colors duration-200",
                        "hover:underline hover:decoration-current hover:underline-offset-2",
                        dark
                          ? "text-gray-400 hover:text-gray-300 focus-visible:ring-gray-500/50"
                          : "text-gray-500 hover:text-gray-700 focus-visible:ring-gray-400/60",
                      )}
                    >
                      {voiceTranscriptOpen ? voiceHideTranscriptLabel : voiceShowTranscriptLabel}
                    </button>
                    {attachmentCount > 0 ? (
                      <AttachmentCountBadge
                        count={attachmentCount}
                        dark={dark}
                        onClick={onOpenAttachments ? () => onOpenAttachments(message.id) : undefined}
                      />
                    ) : null}
                  </div>
                  <div
                    className={cx(
                      "grid w-full min-w-0 max-w-full transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                      voiceTranscriptOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      {voiceTranscriptOpen ? (
                        <VoiceTranscriptPreview
                          text={voiceTranscript}
                          dark={dark}
                          onSeeMore={onOpenVoiceMessageDetail ? () => onOpenVoiceMessageDetail(message.id) : undefined}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={bubbleSurfaceClass} style={bubbleInlineStyle} role="article">
              {showMarkdown ? (
                <div
                  className={cx(contentWrapperClass, "chat-md-root", dark ? "chat-md-dark" : "chat-md-light")}
                >
                  <ReactMarkdown
                    remarkPlugins={chatRemarkPlugins}
                    components={chatMarkdownComponents}
                  >
                    {markdownContent}
                  </ReactMarkdown>
                </div>
              ) : (isUser || isAssistant) && plainTextContent.trim() ? (
                <div className={plainTextClass}>{plainTextContent}</div>
              ) : null}
            </div>
          )}
          {isUser && attachmentCount > 0 && !(isUserVoice && voiceTranscript) && !isUserVoice ? (
            <div className="mt-1 flex w-full max-w-[min(90%,21rem)] justify-end">
              <AttachmentCountBadge
                count={attachmentCount}
                dark={dark}
                onClick={onOpenAttachments ? () => onOpenAttachments(message.id) : undefined}
              />
            </div>
          ) : null}
          {userFailed ? (
            <div
              className={cx(
                "mt-1 flex max-w-full flex-col items-end gap-1 text-xs",
                dark ? "text-red-300" : "text-red-700",
              )}
            >
              <span>{messageSendFailedLabel}</span>
              {onRetrySend ? (
                <button
                  type="button"
                  className={cx(
                    "rounded-lg px-2 py-1 font-semibold underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2",
                    dark
                      ? "text-red-200 focus-visible:ring-red-400"
                      : "text-red-800 focus-visible:ring-red-500",
                  )}
                  onClick={() => onRetrySend(message.id)}
                >
                  {retrySendLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          {showAssistantFooter ? (
            <div
              className={cx(
                "mt-1 flex w-full min-w-0 items-center gap-x-2 gap-y-1 text-[12px] leading-none",
                dark ? "text-gray-400" : "text-gray-500",
              )}
              data-assistrio-assistant-footer
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                {relativeSentLabel ? (
                  <time
                    className={cx(
                      "inline-flex h-5 items-center whitespace-nowrap tabular-nums font-medium leading-none",
                      dark ? "text-gray-400" : "text-gray-500",
                    )}
                    dateTime={message.createdAt}
                    title={formatTime(message.createdAt)}
                  >
                    {relativeSentLabel}
                  </time>
                ) : null}
                {relativeSentLabel && showAssistantThumbs ? (
                  <span
                    className={cx(
                      "inline-flex h-5 items-center justify-center select-none font-light tabular-nums leading-none",
                      dark ? "text-gray-500" : "text-gray-400",
                    )}
                    aria-hidden
                  >
                    |
                  </span>
                ) : null}
                {showAssistantThumbs ? (
                  <div className="inline-flex h-5 items-center gap-0.5" role="group" aria-label="Rate this reply">
                    <button
                      type="button"
                      onClick={() => onMessageFeedback!("up")}
                      className={cx(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                        dark
                          ? "text-gray-400 hover:bg-white/10 focus-visible:ring-gray-500/70 focus-visible:ring-offset-gray-900"
                          : "text-gray-500 hover:bg-gray-100 focus-visible:ring-gray-400/70 focus-visible:ring-offset-white",
                      )}
                      aria-label={feedbackHelpfulLabel}
                      title={feedbackHelpfulLabel}
                      aria-pressed={message.feedbackRating === "up"}
                    >
                      <AssistantThumbUpIcon selected={message.feedbackRating === "up"} className="block h-[12.5px] w-[12.5px] shrink-0" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMessageFeedback!("down")}
                      className={cx(
                        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                        dark
                          ? "text-gray-400 hover:bg-white/10 focus-visible:ring-gray-500/70 focus-visible:ring-offset-gray-900"
                          : "text-gray-500 hover:bg-gray-100 focus-visible:ring-gray-400/70 focus-visible:ring-offset-white",
                      )}
                      aria-label={feedbackNotHelpfulLabel}
                      title={feedbackNotHelpfulLabel}
                      aria-pressed={message.feedbackRating === "down"}
                    >
                      <AssistantThumbDownIcon selected={message.feedbackRating === "down"} className="block h-[12.5px] w-[12.5px] shrink-0" />
                    </button>
                  </div>
                ) : null}
              </div>
              {showAssistantCopy ? (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cx(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-0 leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                    dark
                      ? "text-gray-400 hover:bg-white/10 focus-visible:ring-gray-500/70 focus-visible:ring-offset-gray-900"
                      : "text-gray-500 hover:bg-gray-100 focus-visible:ring-gray-400/70 focus-visible:ring-offset-white",
                  )}
                  aria-label={copied ? copiedLabel : copyLabel}
                  title={copied ? copiedLabel : copyLabel}
                >
                  {copied ? (
                    <svg className="block h-[14px] w-[14px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <CopyGlyph className="block h-[14px] w-[14px] shrink-0" />
                  )}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {showSourcesRow ? (
        <div
          className={cx(
            "flex min-w-0 max-w-[85%] flex-wrap items-center gap-2",
            isUser ? "justify-end self-end" : "justify-start self-start",
          )}
          data-sources-row
        >
          {isAssistant && showSources && message.sources && message.sources.length > 0 ? (
            <ChatSources
              dark={dark}
              sources={message.sources}
              messageId={message.id}
              label={sourcesLabel}
              onSourceClick={onSourceClick}
              className="flex-shrink-0"
            />
          ) : null}
          {showMetadata && showTimeBelow ? (
            <span
              className={cx("flex-shrink-0 text-xs", dark ? "text-gray-400" : "text-gray-500")}
              aria-hidden
            >
              <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
