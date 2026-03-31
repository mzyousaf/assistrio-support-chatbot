import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ChatUIMessage, ChatUISource } from "./types";
import { ChatBubble } from "./ChatBubble";
import { cx } from "./utils";

const SCROLL_THRESHOLD = 80;
const DEFAULT_SCROLL_TO_BOTTOM_TEXT = "Scroll to latest";

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
  /** Label for scroll-to-bottom button (default “Scroll to latest” when empty) */
  scrollToBottomLabel?: string;
  /** Show label text beside the arrow (default true); arrow always shown when button is visible */
  showScrollToBottomLabel?: boolean;
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
  /** Loading conversation messages (skeleton) */
  conversationLoading?: boolean;
  /** Screen reader text for typing indicator (live region) */
  typingStatusLabel?: string;
  messageSendFailedLabel?: string;
  retrySendLabel?: string;
  onRetryMessage?: (messageId: string) => void;
  className?: string;
}

function ConversationSkeleton({
  dark = true,
  compact = false,
  bubbleBorderRadius = 20,
}: {
  dark?: boolean;
  compact?: boolean;
  bubbleBorderRadius?: number;
}) {
  const radiusPx = Math.max(0, Math.min(32, bubbleBorderRadius));
  const pad = compact ? "gap-2 p-3" : "gap-2.5 p-3.5";
  const metaGap = compact ? "gap-2" : "gap-2.5";
  const blockGap = compact ? "gap-1.5" : "gap-2";
  const stackGap = compact ? "gap-5" : "gap-6";

  const MetaRow = ({ align }: { align: "start" | "end" }) => (
    <div
      className={cx(
        "flex w-full items-center",
        metaGap,
        align === "end" ? "flex-row-reverse justify-end" : "flex-row justify-start",
      )}
    >
      <div
        className={cx(
          "h-2 rounded-md",
          dark ? "bg-gray-600/45" : "bg-gray-300/90",
          compact ? "w-[6.75rem]" : "w-[7.5rem]",
        )}
        aria-hidden
      />
      <div
        className={cx("h-1.5 w-10 shrink-0 rounded-sm", dark ? "bg-gray-600/30" : "bg-gray-300/70")}
        aria-hidden
      />
    </div>
  );

  const SkeletonBubble = ({
    align,
    variant,
    lines,
  }: {
    align: "start" | "end";
    variant: "assistant" | "user";
    lines: number[];
  }) => {
    const shell =
      variant === "assistant"
        ? dark
          ? "border border-gray-700/50 bg-gray-800/55 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
          : "border border-gray-200/95 bg-gray-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]"
        : dark
          ? "border border-gray-600/35 bg-gray-700/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
          : "border border-gray-300/80 bg-gray-100 shadow-sm";

    const lineTone =
      variant === "assistant"
        ? dark
          ? "bg-white/[0.07]"
          : "bg-gray-400/30"
        : dark
          ? "bg-white/[0.1]"
          : "bg-gray-400/38";

    return (
      <div
        className={cx(
          "relative w-full max-w-[min(90%,21rem)] overflow-hidden",
          shell,
          align === "end" ? "self-end" : "self-start",
        )}
        style={{ borderRadius: `${radiusPx}px` }}
      >
        <div
          className={cx(
            "assistrio-chat-skeleton-shimmer",
            !dark && "assistrio-chat-skeleton-shimmer--light",
          )}
        />
        <div className={cx("relative z-[1] flex flex-col", pad)}>
          {lines.map((w, i) => (
            <div
              key={`${i}-${w}`}
              className={cx("h-2 rounded-[0.35rem]", lineTone)}
              style={{ width: `${w}%`, maxWidth: "100%" }}
              aria-hidden
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cx(
        "flex h-full min-h-0 w-full flex-1 flex-col justify-start",
        compact ? "py-0.5" : "py-1",
        stackGap,
      )}
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className={cx("assistrio-chat-skeleton-block flex min-h-0 w-full flex-col", blockGap)}>
        <MetaRow align="start" />
        <SkeletonBubble align="start" variant="assistant" lines={[94, 86, 68, 52]} />
      </div>
      <div className={cx("assistrio-chat-skeleton-block flex min-h-0 w-full flex-col", blockGap)}>
        <MetaRow align="end" />
        <SkeletonBubble align="end" variant="user" lines={[86, 48]} />
      </div>
      <div className={cx("assistrio-chat-skeleton-block flex min-h-0 w-full flex-col", blockGap)}>
        <MetaRow align="start" />
        <SkeletonBubble align="start" variant="assistant" lines={[91, 78, 58]} />
      </div>
      <div className={cx("assistrio-chat-skeleton-block flex min-h-0 w-full flex-col", blockGap)}>
        <MetaRow align="end" />
        <SkeletonBubble align="end" variant="user" lines={[84, 56]} />
      </div>
      <div className={cx("assistrio-chat-skeleton-block flex min-h-0 w-full flex-col", blockGap)}>
        <MetaRow align="start" />
        <SkeletonBubble align="start" variant="assistant" lines={[89, 74, 61, 44]} />
      </div>
      <div className={cx("assistrio-chat-skeleton-block flex min-h-0 w-full flex-col", blockGap)}>
        <MetaRow align="end" />
        <SkeletonBubble align="end" variant="user" lines={[92, 50]} />
      </div>
    </div>
  );
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
  scrollToBottomLabel,
  showScrollToBottomLabel = true,
  showScrollToBottom = true,
  showScrollbar = true,
  emptyState,
  onSourceClick,
  suggestedQuestions,
  onSuggestedQuestionClick,
  compact = false,
  conversationLoading = false,
  typingStatusLabel = "Assistant is typing",
  messageSendFailedLabel,
  retrySendLabel,
  onRetryMessage,
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
    !conversationLoading &&
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
        data-assistrio-msg-scroll={showScrollbar ? "visible" : "hidden"}
        className={cx(
          "relative flex-1 overflow-y-auto overscroll-contain min-h-0 flex flex-col items-stretch",
          conversationLoading && "overflow-hidden",
          showScrollbar ? "chat-ui-messages-scroll" : "chat-ui-messages-scroll-hidden",
          !conversationLoading && (compact ? "p-2 space-y-3" : "p-4 space-y-4"),
          className
        )}
        style={{
          ["--chat-accent" as string]: accentColor,
          ...(showScrollbar
            ? { scrollbarColor: `${accentColor} transparent` as const }
            : { scrollbarColor: "transparent transparent" as const }),
        } as React.CSSProperties}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat messages"
      >
        {conversationLoading ? (
          <div
            className={cx(
              "absolute inset-0 z-[1] flex min-h-0 flex-col",
              compact ? "p-2" : "p-4",
            )}
          >
            <ConversationSkeleton dark={dark} compact={compact} bubbleBorderRadius={bubbleBorderRadius} />
          </div>
        ) : null}
        {!conversationLoading && visibleMessages.length === 0 && !showSuggestedBlock ? (
          !isSending ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              {emptyState ?? (
                <p className={cx("text-sm", dark ? "text-gray-400" : "text-gray-500")}>Ask me anything…</p>
              )}
            </div>
          ) : null
        ) : null}
        {!conversationLoading && visibleMessages.length > 0
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
                  "flex w-full min-w-0 max-w-full flex-col",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cx(
                    "w-full min-w-0 max-w-full space-y-0.5",
                    msg.role === "user" ? "flex flex-col items-end" : ""
                  )}
                >
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
                    messageSendFailedLabel={messageSendFailedLabel}
                    retrySendLabel={retrySendLabel}
                    onRetrySend={msg.role === "user" ? onRetryMessage : undefined}
                  />
                </div>
              </div>
            );
          })
          : null}
        {showSuggestedBlock ? (
          <div
            className={cx(
              "mt-auto flex w-full min-w-0 max-w-full flex-shrink-0 flex-col items-stretch justify-end",
              compact ? "px-2 pt-4 pb-0" : "px-4 pt-6 pb-0",
            )}
          >
            <div className="flex w-full min-w-0 max-w-full flex-wrap justify-end gap-2">
              {suggestedQuestions!.map((q, qIndex) => (
                <button
                  key={qIndex}
                  type="button"
                  onClick={() => onSuggestedQuestionClick!(q)}
                  disabled={isSending}
                  className="max-w-[min(100%,20rem)] min-w-0 border px-4 py-2.5 text-left text-sm font-medium break-words whitespace-normal text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="flex justify-start items-center" role="status" aria-live="polite" aria-atomic="true">
            <span className="sr-only">{typingStatusLabel}</span>
            <div
              className={cx(
                "rounded-2xl px-4 py-3 flex items-center gap-1 border",
                dark ? "bg-gray-700/80 border-gray-600" : "bg-gray-200 border-gray-300",
              )}
              aria-hidden
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
            "absolute bottom-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center rounded-full text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2",
            showScrollToBottomLabel ? "gap-1.5 px-3 py-2" : "p-2.5",
            dark ? "focus:ring-offset-gray-900" : "focus:ring-offset-white"
          )}
          style={{ backgroundColor: accentColor }}
          aria-label={(scrollToBottomLabel?.trim() || DEFAULT_SCROLL_TO_BOTTOM_TEXT)}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {showScrollToBottomLabel ? (
            <span className="whitespace-nowrap max-w-[min(12rem,40vw)] truncate">
              {scrollToBottomLabel?.trim() || DEFAULT_SCROLL_TO_BOTTOM_TEXT}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
