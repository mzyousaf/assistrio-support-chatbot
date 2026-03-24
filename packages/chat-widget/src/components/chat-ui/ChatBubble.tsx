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
  className,
}: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
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

  const bubbleBaseClass = cx(
    "px-3 py-2.5 text-sm leading-relaxed text-left box-border",
    "min-w-0 max-w-full w-full overflow-hidden",
    "break-words",
    isUser && "text-white",
    isAssistant &&
    (dark
      ? "bg-gray-700/80 text-gray-100 border border-gray-600"
      : "bg-gray-100 text-gray-900 border border-gray-200")
  );

  const bubbleInlineStyle: React.CSSProperties =
    isUser && accentColor
      ? { backgroundColor: accentColor, color: "#fff", borderRadius: `${radiusPx}px` }
      : { borderRadius: `${radiusPx}px` };

  const contentWrapperClass = cx(
    "text-left min-w-0 max-w-full w-full overflow-hidden chat-bubble-content",
    "[&>*]:min-w-0 [&>*]:max-w-full",
    dark ? "[&>code]:bg-gray-600 [&>code]:text-gray-200" : "[&>code]:bg-gray-300 [&>code]:text-gray-800",
    "[&>code]:rounded [&>code]:px-1 [&>code]:py-0.5 [&>code]:break-all"
  );

  // Same text width classes for both user and assistant (emoji-friendly font for display)
  const plainTextClass = "whitespace-pre-wrap min-w-0 max-w-full w-full overflow-hidden break-words chat-bubble-content";

  // Row/column: constrain width so bubble stays inside; min-w-0 allows flex children to shrink.
  const rowClass = cx(
    "flex items-start gap-2 w-full min-w-0 max-w-[85%]",
    isUser ? "flex-row-reverse self-end" : ""
  );
  const columnClass = cx(
    "flex flex-col gap-0.5 min-w-0 max-w-full w-full",
    isUser ? "items-end" : "items-start"
  );

  return (
    <article
      className={cx(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
        className
      )}
      data-message-id={message.id}
      aria-label={`${roleLabel} message`}
    >
      {/* Metadata above bubble */}
      {showMetadata && (showSenderName || showTimeAbove) && (
        <div className={metaClass} aria-hidden>
          {showSenderName && <span>{roleLabel}</span>}
          {showTimeAbove && <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>}
        </div>
      )}

      <div className={rowClass}>
        <div className={columnClass}>
          <div
            className={bubbleBaseClass}
            style={bubbleInlineStyle}
            role="article"
          >
            {showMarkdown ? (
              <div
                className={cx(
                  contentWrapperClass,
                  "prose prose-sm max-w-full dark:prose-invert",
                  "[&_a]:text-blue-400 [&_a]:underline [&_a]:break-all",
                  "[&_pre]:text-sm [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded",
                  "[&_table]:max-w-full [&_table]:block [&_table]:overflow-x-auto"
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className={plainTextClass}>
                {message.content}
              </div>
            )}
          </div>
        </div>
        {isAssistant && showCopyButton && message.content && renderCopyInBubble && (
          <button
            type="button"
            onClick={handleCopy}
            className={cx(
              "p-1.5 rounded transition-colors flex-shrink-0 mt-1",
              dark
                ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
            )}
            aria-label={copied ? copiedLabel : copyLabel}
            title={copied ? copiedLabel : copyLabel}
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Single sources row: always present for both actor types; alignment and content by role */}
      <div
        className={cx(
          "flex flex-wrap items-center gap-2 w-full min-w-0 max-w-[85%] mt-1.5",
          isUser ? "justify-end" : "justify-start"
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
              "p-1.5 rounded transition-colors flex-shrink-0",
              dark
                ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
            )}
            aria-label={copied ? copiedLabel : copyLabel}
            title={copied ? copiedLabel : copyLabel}
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
        {showMetadata && showTimeBelow && (
          <span
            className={cx(
              "text-xs flex-shrink-0",
              dark ? "text-gray-400" : "text-gray-500"
            )}
            aria-hidden
          >
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          </span>
        )}
      </div>
    </article>
  );
}
