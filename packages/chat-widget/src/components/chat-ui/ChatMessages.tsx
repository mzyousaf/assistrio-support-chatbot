import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ChatUIMessage, ChatUISource } from "./types";
import { ChatBubble } from "./ChatBubble";
import { cx } from "./utils";

const SCROLL_THRESHOLD = 80;

export interface ChatMessagesProps {
  /** Dark theme (default true) */
  dark?: boolean;
  messages: ChatUIMessage[];
  /** Show typing indicator when true */
  isSending?: boolean;
  accentColor?: string;
  showMetadata?: boolean;
  /** Display name for assistant messages (e.g. "Bot Name - AI") */
  senderName?: string;
  /** Show sender/assistant name above messages (default true) */
  showSenderName?: boolean;
  /** Show message time (default true) */
  showTime?: boolean;
  /** Where to show time: top (above) or bottom (assistant=right, user=left) */
  timePosition?: "top" | "bottom";
  /** Message bubble border radius in px (0–32). Affects message bubbles and suggested chips. */
  bubbleBorderRadius?: number;
  showCopyButton?: boolean;
  showSources?: boolean;
  /** Render assistant messages with simple markdown (**bold**, `code`) */
  allowMarkdown?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  sourcesLabel?: string;
  /** Label for scroll-to-bottom button */
  scrollToBottomLabel?: string;
  /** Show scroll-to-bottom button when user scrolls up (default true) */
  showScrollToBottom?: boolean;
  /** Show scrollbar in message list (default true). When false, scrollbar is hidden but content still scrolls. */
  showScrollbar?: boolean;
  emptyState?: React.ReactNode;
  onSourceClick?: (source: ChatUISource) => void;
  /** Suggested questions shown as first message when there are no messages */
  suggestedQuestions?: string[];
  /** Called when user selects a suggested question (sends that message) */
  onSuggestedQuestionClick?: (text: string) => void;
  /** Tighter padding */
  compact?: boolean;
  className?: string;
}

export function ChatMessages({
  dark = true,
  messages,
  isSending = false,
  accentColor = "#6366f1",
  showMetadata = true,
  senderName,
  showSenderName = true,
  showTime = true,
  timePosition = "top",
  bubbleBorderRadius = 20,
  showCopyButton = true,
  showSources = true,
  allowMarkdown = false,
  copyLabel,
  copiedLabel,
  sourcesLabel,
  scrollToBottomLabel = "Scroll to latest",
  showScrollToBottom = true,
  showScrollbar = true,
  emptyState,
  onSourceClick,
  suggestedQuestions,
  onSuggestedQuestionClick,
  compact = false,
  className,
}: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const [scrollButtonVisible, setScrollButtonVisible] = useState(false);

  const visibleMessages = messages.filter(
    (m) => m.role !== "system" && !(m.role === "assistant" && m.status === "sending")
  );
  const hasUserMessage = visibleMessages.some((m) => m.role === "user");
  const showSuggestedBlock =
    !hasUserMessage &&
    !isSending &&
    suggestedQuestions &&
    suggestedQuestions.length > 0 &&
    onSuggestedQuestionClick;

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    userHasScrolledRef.current = false;
    setScrollButtonVisible(false);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const prevHeight = prevScrollHeightRef.current;
    const nowHeight = list.scrollHeight;
    const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
    const newContentAdded = nowHeight > prevHeight;
    prevScrollHeightRef.current = nowHeight;
    if (newContentAdded && (isNearBottom || !userHasScrolledRef.current)) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending]);

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const isAtBottom = distanceFromBottom < SCROLL_THRESHOLD;
    userHasScrolledRef.current = !isAtBottom;
    setScrollButtonVisible(!isAtBottom);
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      <div
        ref={listRef}
        onScroll={handleScroll}
        className={cx(
          "flex-1 overflow-y-auto overscroll-contain min-h-0 flex flex-col",
          showScrollbar ? "chat-ui-messages-scroll" : "scrollbar-hide",
          compact ? "p-2 space-y-3" : "p-4 space-y-4",
          className
        )}
        style={{
          ["--chat-accent" as string]: accentColor,
          scrollbarColor: dark ? `${accentColor} transparent` : `${accentColor} transparent`,
        } as React.CSSProperties}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {visibleMessages.length === 0 && !showSuggestedBlock ? (
          !isSending ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              {emptyState ?? (
                <p className={cx("text-sm", dark ? "text-gray-400" : "text-gray-500")}>Ask me anything…</p>
              )}
            </div>
          ) : null
        ) : null}
        {visibleMessages.length > 0
          ? visibleMessages.map((msg) => {
            const isWelcomeMessage = typeof msg.id === "string" && msg.id.startsWith("welcome_");
            const showCopyForMessage = showCopyButton && !isWelcomeMessage;
            const hasSourcesOrCopy =
              (showSources && msg.sources && msg.sources.length > 0) ||
              (msg.role === "assistant" && showCopyForMessage && !!msg.content);
            return (
              <div
                key={msg.id}
                className={cx(
                  "flex flex-col w-full",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div className={cx("space-y-0.5 w-full")}>
                  <ChatBubble
                    dark={dark}
                    message={msg}
                    accentColor={accentColor}
                    showMetadata={showMetadata}
                    senderName={senderName}
                    showSenderName={showSenderName}
                    showTime={showTime}
                    timePosition={timePosition}
                    bubbleBorderRadius={bubbleBorderRadius}
                    showCopyButton={showCopyForMessage}
                    renderCopyInBubble={!hasSourcesOrCopy}
                    allowMarkdown={allowMarkdown}
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    showSources={showSources}
                    sourcesLabel={sourcesLabel}
                    onSourceClick={onSourceClick}
                  />
                </div>
              </div>
            );
          })
          : null}
        {showSuggestedBlock ? (
          <div
            className={cx(
              "flex flex-col items-end justify-end pl-4 pr-0 pt-6 pb-0 mt-auto flex-shrink-0"
            )}
          >
            <div className="flex flex-wrap justify-end gap-2">
              {suggestedQuestions!.map((q, qIndex) => (
                <button
                  key={qIndex}
                  type="button"
                  onClick={() => onSuggestedQuestionClick!(q)}
                  disabled={isSending}
                  className="border px-4 py-2.5 text-sm font-medium transition-colors text-left text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                    borderRadius: `${Math.max(0, Math.min(32, bubbleBorderRadius ?? 20))}px`,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {visibleMessages.length > 0 && isSending ? (
          <div
            className="flex justify-start items-center"
            role="status"
            aria-live="polite"
            aria-label="Someone is typing"
          >
            <div
              className={cx(
                "rounded-2xl px-4 py-3 flex items-center gap-1 border",
                dark ? "bg-gray-700/80 border-gray-600" : "bg-gray-200 border-gray-300"
              )}
            >
              <span className={cx("w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]", dark ? "bg-gray-400" : "bg-gray-500")} />
              <span className={cx("w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]", dark ? "bg-gray-400" : "bg-gray-500")} />
              <span className={cx("w-2 h-2 rounded-full animate-bounce", dark ? "bg-gray-400" : "bg-gray-500")} />
            </div>
          </div>
        ) : null}
        {visibleMessages.length > 0 ? <div ref={endRef} aria-hidden /> : null}
      </div>
      {showScrollToBottom && scrollButtonVisible ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cx(
            "absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2",
            dark ? "focus:ring-offset-gray-900" : "focus:ring-offset-white"
          )}
          style={{ backgroundColor: accentColor }}
          aria-label={scrollToBottomLabel}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {scrollToBottomLabel}
        </button>
      ) : null}
    </div>
  );
}
