import React, { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatUIMessage, ChatUISource } from "./types";
import { cx } from "./utils";
import { ChatSources } from "./ChatSources";

export interface ChatBubbleProps {
  /** Dark theme (default true) */
  dark?: boolean;
  message: ChatUIMessage;
  /** Accent color for user bubble (CSS value, e.g. #6366f1) */
  accentColor?: string;
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
  /** Render assistant content as simple markdown (**bold**, `code`) */
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

export function ChatBubble({
  dark = true,
  message,
  accentColor = "#6366f1",
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
  className,
}: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const userFailed = isUser && message.status === "error";
  const userSending = isUser && message.status === "sending";
  const radiusPx = Math.max(0, Math.min(32, bubbleBorderRadius ?? 20));

  const roleLabel = isAssistant && senderName ? senderName : isUser ? "User" : "Assistant";
  const showTimeAbove = showTime && timePosition !== "bottom";
  const showTimeBelow = showTime && timePosition === "bottom";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(message.id, message.content);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  }, [message.id, message.content, onCopy]);

  const showMarkdown = isAssistant && allowMarkdown && message.content;

  const metaClass = cx(
    "text-xs flex items-center gap-2",
    dark ? "text-gray-400" : "text-gray-500",
    isUser && "flex-row-reverse"
  );

  const bubbleSurfaceClass = cx(
    "chat-bubble-surface inline-block max-w-full min-w-0 align-top box-border px-3 py-2.5 text-left text-sm leading-relaxed",
    "break-words [overflow-wrap:anywhere]",
    isUser && "text-white",
    isAssistant &&
    (dark
      ? "bg-gray-700/80 text-gray-100 border border-gray-600"
      : "bg-gray-100 text-gray-900 border border-gray-200")
  );

  const bubbleInlineStyle: React.CSSProperties =
    isUser && accentColor
      ? {
          backgroundColor: userFailed ? undefined : accentColor,
          color: "#fff",
          borderRadius: `${radiusPx}px`,
          ...(userFailed
            ? {
                backgroundColor: dark ? "rgb(31 41 55 / 0.95)" : "rgb(243 244 246)",
                color: dark ? "rgb(243 244 246)" : "rgb(17 24 39)",
                boxShadow: "inset 0 0 0 2px rgb(239 68 68 / 0.55)",
              }
            : {}),
          ...(userSending ? { opacity: 0.88 } : {}),
        }
      : { borderRadius: `${radiusPx}px` };

  const contentWrapperClass = cx(
    "text-left min-w-0 max-w-full chat-bubble-content",
    "[&>*]:min-w-0 [&>*]:max-w-full",
    dark ? "[&>code]:bg-gray-600 [&>code]:text-gray-200" : "[&>code]:bg-gray-300 [&>code]:text-gray-800",
    "[&>code]:rounded [&>code]:px-1 [&>code]:py-0.5 [&>code]:break-all"
  );

  const plainTextClass =
    "whitespace-pre-wrap min-w-0 max-w-full break-words [overflow-wrap:anywhere] chat-bubble-content";

  const messageRowClass = cx(
    "flex w-full min-w-0 max-w-full items-start gap-2",
    isUser ? "justify-end" : "justify-start"
  );

  const bubbleColumnClass = cx(
    "flex min-w-0 max-w-[85%] flex-col gap-0.5",
    isAssistant && "flex-1",
    isUser ? "w-full items-end" : "items-start"
  );

  return (
    <article
      className={cx(
        "flex w-full min-w-0 max-w-full flex-col gap-1",
        isUser ? "items-end" : "items-start",
        className
      )}
      data-message-id={message.id}
      aria-label={`${roleLabel} message`}
    >
      {showMetadata && (showSenderName || showTimeAbove) && (
        <div className={metaClass} aria-hidden>
          {showSenderName && <span>{roleLabel}</span>}
          {showTimeAbove && <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>}
        </div>
      )}

      <div className={messageRowClass}>
        <div className={bubbleColumnClass}>
          <div className={bubbleSurfaceClass} style={bubbleInlineStyle} role="article">
            {showMarkdown ? (
              <div
                className={cx(
                  contentWrapperClass,
                  "prose prose-sm max-w-full dark:prose-invert",
                  dark
                    ? "text-gray-100 [&_p]:text-gray-100 [&_li]:text-gray-100 [&_strong]:text-white [&_em]:text-gray-200 [&_blockquote]:text-gray-300 [&_h1]:text-gray-50 [&_h2]:text-gray-50 [&_h3]:text-gray-100 [&_pre]:text-gray-100"
                    : "text-gray-900 [&_p]:text-gray-900 [&_pre]:text-gray-800",
                  "[&_a]:text-blue-400 [&_a]:underline [&_a]:break-all",
                  "[&_pre]:text-sm [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded",
                  "[&_table]:max-w-full [&_table]:block [&_table]:overflow-x-auto"
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <div className={plainTextClass}>{message.content}</div>
            )}
          </div>
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
        </div>
        {isAssistant && showCopyButton && message.content && renderCopyInBubble && (
          <button
            type="button"
            onClick={handleCopy}
            className={cx(
              "mt-1 flex-shrink-0 rounded p-1.5 transition-colors",
              dark
                ? "text-gray-400 hover:bg-gray-700/50 hover:text-gray-300"
                : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            )}
            aria-label={copied ? copiedLabel : copyLabel}
            title={copied ? copiedLabel : copyLabel}
          >
            {copied ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        )}
      </div>

      <div
        className={cx(
          "flex min-w-0 max-w-[85%] flex-wrap items-center gap-2",
          isUser ? "justify-end self-end" : "justify-start self-start"
        )}
        data-sources-row
      >
        {isAssistant && showSources && message.sources && message.sources.length > 0 && (
          <ChatSources
            dark={dark}
            sources={message.sources}
            messageId={message.id}
            label={sourcesLabel}
            onSourceClick={onSourceClick}
            className="flex-shrink-0"
          />
        )}
        {isAssistant && showCopyButton && message.content && !renderCopyInBubble && (
          <button
            type="button"
            onClick={handleCopy}
            className={cx(
              "flex-shrink-0 rounded p-1.5 transition-colors",
              dark
                ? "text-gray-400 hover:bg-gray-700/50 hover:text-gray-300"
                : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            )}
            aria-label={copied ? copiedLabel : copyLabel}
            title={copied ? copiedLabel : copyLabel}
          >
            {copied ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        )}
        {showMetadata && showTimeBelow && (
          <span
            className={cx("flex-shrink-0 text-xs", dark ? "text-gray-400" : "text-gray-500")}
            aria-hidden
          >
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          </span>
        )}
      </div>
    </article>
  );
}
