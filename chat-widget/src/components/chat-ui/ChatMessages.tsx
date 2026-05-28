import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ScrollChromeStyle, ScrollToBottomAlign, UserBubbleStyle } from "../../models/botChatUI";
import type { SuggestedQuestionChip } from "../../types";
import type { ChatUIMessage, ChatUISource } from "./types";
import { ChatBubble } from "./ChatBubble";
import { cx } from "./utils";

const SCROLL_THRESHOLD = 80;
const DEFAULT_SCROLL_TO_BOTTOM_TEXT = "Scroll to latest";

function scrollToBottomButtonPositionClass(align: ScrollToBottomAlign | undefined): string {
  switch (align) {
    case "left":
      return "left-3 translate-x-0";
    case "right":
      return "right-3 left-auto translate-x-0";
    default:
      return "left-1/2 -translate-x-1/2";
  }
}

/** Pin the message row to the top of the conversation scroller (`listRef` when it overflows; else nearest overflow ancestor). */
function scrollAnchorRowToTopOfScroller(anchorEl: HTMLElement, list: HTMLElement | null, marginTop = 8): void {
  const apply = (scroller: HTMLElement) => {
    const c = scroller.getBoundingClientRect();
    const r = anchorEl.getBoundingClientRect();
    scroller.scrollTop = Math.max(0, scroller.scrollTop + (r.top - c.top) - marginTop);
  };
  if (list && list.contains(anchorEl) && list.scrollHeight > list.clientHeight) {
    apply(list);
    return;
  }
  let parent = anchorEl.parentElement;
  while (parent) {
    if (parent === document.body || parent === document.documentElement) break;
    const st = getComputedStyle(parent);
    const oy = st.overflowY;
    const scrollsY = oy === "auto" || oy === "scroll" || oy === "overlay";
    if (scrollsY && parent.scrollHeight > parent.clientHeight) {
      apply(parent);
      return;
    }
    parent = parent.parentElement;
  }
  if (list && list.contains(anchorEl)) apply(list);
}

function resolveScrollChromeColor(
  dark: boolean | undefined,
  style: ScrollChromeStyle | undefined,
  accentColor: string | undefined,
): string {
  const s = style ?? "default";
  if (s === "primary") return (accentColor?.trim() || "#6366f1");
  if (s === "defaultDark") return dark ? "#1f2937" : "#374151";
  return dark ? "#4b5563" : "#6b7280";
}

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
  /** Message list scrollbar thumb style (default `default`). */
  scrollChromeStyle?: ScrollChromeStyle;
  /** Floating scroll-to-latest button; when omitted, matches `scrollChromeStyle`. */
  scrollToBottomChromeStyle?: ScrollChromeStyle;
  /** Floating scroll-to-latest button alignment (default `center`). */
  scrollToBottomAlign?: ScrollToBottomAlign;
  /** Typed user messages only. */
  userTextBubbleStyle?: UserBubbleStyle;
  /** Voice user messages only. */
  userVoiceBubbleStyle?: UserBubbleStyle;
  emptyState?: React.ReactNode;
  onSourceClick?: (source: ChatUISource) => void;
  /** Suggested questions shown as first message when there are no messages */
  suggestedQuestions?: string[];
  /**
   * When set (from widget init), chip clicks can include `suggestionId` for KB-scoped first reply.
   * Otherwise `suggestedQuestions` string labels are used.
   */
  suggestedQuestionChips?: SuggestedQuestionChip[];
  /** Called when user selects a suggested question (sends that message) */
  onSuggestedQuestionClick?: (text: string, meta?: { suggestionId?: string }) => void;
  /**
   * When true, suggested chips are not shown in the message list (same effect as per-chip
   * `hideChipTextInChat` on every chip). Separate from knowledge-base “Use in replies”.
   */
  hideSuggestionChipText?: boolean;
  /** Tighter padding */
  compact?: boolean;
  /** Loading conversation messages (centered spinner) */
  conversationLoading?: boolean;
  /** Screen reader text for typing indicator (live region) */
  typingStatusLabel?: string;
  messageSendFailedLabel?: string;
  retrySendLabel?: string;
  onRetryMessage?: (messageId: string) => void;
  showMessageFeedback?: boolean;
  onMessageFeedback?: (messageId: string, rating: "up" | "down") => void;
  feedbackHelpfulLabel?: string;
  feedbackNotHelpfulLabel?: string;
  voiceShowTranscriptLabel?: string;
  voiceHideTranscriptLabel?: string;
  /** Full-screen voice + transcript (long transcript “see more”). */
  onOpenVoiceMessageDetail?: (messageId: string) => void;
  /** User taps attachment count to open full-screen list (embed). */
  onOpenMessageAttachments?: (messageId: string) => void;
  className?: string;
  /**
   * `"auto"` (default): message area scrolls when content overflows.
   * `"hidden"`: no vertical scroll in the list (e.g. admin embed preview — clip overflow; height comes from the host).
   */
  messageListOverflow?: "auto" | "hidden";
}

function ConversationMessagesSkeleton({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  const row = (align: "end" | "start", wClass: string, hClass: string) => (
    <div className={cx("flex w-full", align === "end" ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[min(100%,22rem)] rounded-2xl",
          hClass,
          wClass,
          "animate-pulse",
          dark ? "bg-gray-700/55" : "bg-gray-200/90",
        )}
        aria-hidden
      />
    </div>
  );
  return (
    <div
      className={cx("flex min-h-0 w-full flex-1 flex-col gap-3", compact ? "gap-2.5" : "gap-3.5")}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading messages"
    >
      {row("end", "w-[82%]", "h-10")}
      {row("start", "w-[92%]", "h-14")}
      {row("end", "w-[58%]", "h-10")}
      {row("start", "w-[76%]", "h-12")}
      {row("end", "w-[72%]", "h-9")}
    </div>
  );
}

/** Customer-dashboard style: message-area skeleton while history is fetched. */
function ConversationLoadingIndicator({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex h-full min-h-[10rem] w-full flex-1 flex-col justify-stretch py-0">
      <ConversationMessagesSkeleton dark={dark} compact={compact} />
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
  scrollChromeStyle = "default",
  scrollToBottomChromeStyle: scrollToBottomChromeStyleProp,
  scrollToBottomAlign = "center",
  userTextBubbleStyle = "primary",
  userVoiceBubbleStyle = "primary",
  emptyState,
  onSourceClick,
  suggestedQuestions,
  suggestedQuestionChips,
  onSuggestedQuestionClick,
  hideSuggestionChipText = false,
  compact = false,
  conversationLoading = false,
  typingStatusLabel = "Assistant is typing",
  messageSendFailedLabel,
  retrySendLabel,
  onRetryMessage,
  showMessageFeedback = false,
  onMessageFeedback,
  feedbackHelpfulLabel,
  feedbackNotHelpfulLabel,
  voiceShowTranscriptLabel,
  voiceHideTranscriptLabel,
  onOpenVoiceMessageDetail,
  onOpenMessageAttachments,
  className,
  messageListOverflow = "auto",
}: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const anchoredUserSendIdRef = useRef<string | null>(null);
  /** User message id we already aligned to top for the current assistant streaming turn. */
  const pinnedStreamingUserIdRef = useRef<string | null>(null);
  const [scrollButtonVisible, setScrollButtonVisible] = useState(false);

  const scrollBarChromeColor = useMemo(
    () => resolveScrollChromeColor(dark, scrollChromeStyle, accentColor),
    [accentColor, dark, scrollChromeStyle],
  );
  const scrollToBottomChromeColor = useMemo(
    () =>
      resolveScrollChromeColor(dark, scrollToBottomChromeStyleProp ?? scrollChromeStyle, accentColor),
    [accentColor, dark, scrollChromeStyle, scrollToBottomChromeStyleProp],
  );

  const visibleMessages = messages.filter(
    (m) => m.role !== "system" && !(m.role === "assistant" && m.status === "sending")
  );
  const hasUserMessage = visibleMessages.some((m) => m.role === "user");
  const effectiveSuggestionChips = useMemo((): SuggestedQuestionChip[] => {
    if (suggestedQuestionChips && suggestedQuestionChips.length > 0) return suggestedQuestionChips;
    if (suggestedQuestions && suggestedQuestions.length > 0) {
      return suggestedQuestions.map((label) => ({ label }));
    }
    return [];
  }, [suggestedQuestionChips, suggestedQuestions]);
  /** Chips with “hide label” (or global hide) are omitted entirely — no dot placeholder. */
  const visibleSuggestionChips = useMemo(
    () =>
      effectiveSuggestionChips.filter(
        (chip) =>
          !(hideSuggestionChipText === true || chip.hideChipTextInChat === true),
      ),
    [effectiveSuggestionChips, hideSuggestionChipText],
  );
  const showSuggestedBlock =
    !conversationLoading &&
    !hasUserMessage &&
    !isSending &&
    visibleSuggestionChips.length > 0 &&
    onSuggestedQuestionClick;

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    userHasScrolledRef.current = false;
    setScrollButtonVisible(false);
  }, []);

  const showTypingIndicator =
    visibleMessages.length > 0 &&
    isSending &&
    !messages.some((m) => m.role === "assistant" && m.status === "streaming");

  const handleScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    const isAtBottom = distanceFromBottom < SCROLL_THRESHOLD;
    userHasScrolledRef.current = !isAtBottom;
    setScrollButtonVisible(!isAtBottom);
  }, []);

  const assistantStreaming = messages.some((m) => m.role === "assistant" && m.status === "streaming");

  useLayoutEffect(() => {
    if (messageListOverflow === "hidden") return;
    const list = listRef.current;

    const users = visibleMessages.filter((m) => m.role === "user");
    const lastUser = users[users.length - 1];
    if (lastUser?.status === "sending" && anchoredUserSendIdRef.current !== lastUser.id) {
      anchoredUserSendIdRef.current = lastUser.id;
      const id = CSS.escape(String(lastUser.id));
      const el = list?.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null;
      if (el) scrollAnchorRowToTopOfScroller(el, list, 8);
      return;
    }

    if (assistantStreaming) {
      const vm = visibleMessages;
      const lastMsg = vm[vm.length - 1];
      const prevMsg = vm.length >= 2 ? vm[vm.length - 2] : undefined;
      if (
        lastMsg?.role === "assistant" &&
        lastMsg.status === "streaming" &&
        prevMsg?.role === "user" &&
        pinnedStreamingUserIdRef.current !== prevMsg.id
      ) {
        pinnedStreamingUserIdRef.current = prevMsg.id;
        const id = CSS.escape(String(prevMsg.id));
        const el = list?.querySelector(`[data-message-id="${id}"]`) as HTMLElement | null;
        if (el) scrollAnchorRowToTopOfScroller(el, list, 8);
      }
      if (list) prevScrollHeightRef.current = list.scrollHeight;
      return;
    }

    pinnedStreamingUserIdRef.current = null;
  }, [assistantStreaming, visibleMessages, messages, messageListOverflow]);

  useEffect(() => {
    if (messageListOverflow === "hidden") return;
    if (assistantStreaming) return;

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
  }, [assistantStreaming, visibleMessages, messages, isSending, messageListOverflow]);

  return (
    <div className="flex-1 min-h-0 flex flex-col relative">
      <div
        ref={listRef}
        onScroll={messageListOverflow === "hidden" ? undefined : handleScroll}
        data-assistrio-msg-scroll={showScrollbar ? "visible" : "hidden"}
        className={cx(
          "relative flex-1 max-h-full min-h-0 flex flex-col items-stretch",
          messageListOverflow === "hidden" ? "overflow-y-hidden" : "overflow-y-auto overscroll-contain",
          conversationLoading && "overflow-hidden",
          showScrollbar ? "chat-ui-messages-scroll" : "chat-ui-messages-scroll-hidden",
          !conversationLoading &&
            (compact
              ? cx("p-2 gap-[calc(0.25rem*5)]", showSuggestedBlock && "pb-0")
              : cx(
                  "gap-[calc(0.25rem*5)]",
                  showScrollbar ? "pl-3 pr-2" : "px-3",
                  showSuggestedBlock ? "pt-3 pb-0" : "py-3",
                )),
          className
        )}
        style={{
          ["--chat-accent" as string]: scrollBarChromeColor,
          overflowAnchor: "none",
          ...(showScrollbar
            ? { scrollbarColor: `${scrollBarChromeColor} transparent` as const }
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
              "absolute inset-0 z-[1] flex min-h-0 flex-col bg-inherit",
              compact ? "p-2" : "p-4",
            )}
          >
            <ConversationLoadingIndicator dark={dark} compact={compact} />
          </div>
        ) : null}
        {!conversationLoading && visibleMessages.length === 0 && !showSuggestedBlock ? (
          !isSending ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              {emptyState ?? (
                <p className={cx("text-sm font-normal tracking-tight", dark ? "text-gray-400" : "text-gray-500")}>
                  Ask me anything…
                </p>
              )}
            </div>
          ) : null
        ) : null}
        {!conversationLoading && visibleMessages.length > 0
          ? visibleMessages.map((msg) => {
            const isWelcomeMessage = typeof msg.id === "string" && msg.id.startsWith("welcome_");
            const showCopyForMessage =
              showCopyButton &&
              !isWelcomeMessage &&
              !(msg.role === "assistant" && msg.status === "streaming");
            const hasSourcesOrCopy = Boolean(showSources && msg.sources && msg.sources.length > 0);
            return (
              <div
                key={msg.id}
                data-message-id={msg.id}
                className={cx(
                  "flex w-full min-w-0 max-w-full flex-col",
                  msg.role === "user" ? "items-end scroll-mt-3" : "items-start",
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
                    userTextBubbleStyle={userTextBubbleStyle}
                    userVoiceBubbleStyle={userVoiceBubbleStyle}
                    showMetadata={showMetadata}
                    senderName={senderName}
                    showSenderName={showSenderName}
                    showTime={showTime}
                    timePosition={timePosition}
                    bubbleBorderRadius={bubbleBorderRadius}
                    showCopyButton={showCopyForMessage}
                    renderCopyInBubble={msg.role !== "assistant" && !hasSourcesOrCopy}
                    allowMarkdown={allowMarkdown}
                    copyLabel={copyLabel}
                    copiedLabel={copiedLabel}
                    showSources={showSources}
                    sourcesLabel={sourcesLabel}
                    onSourceClick={onSourceClick}
                    messageSendFailedLabel={messageSendFailedLabel}
                    retrySendLabel={retrySendLabel}
                    onRetrySend={msg.role === "user" ? onRetryMessage : undefined}
                    showMessageFeedback={showMessageFeedback && msg.role === "assistant"}
                    onMessageFeedback={
                      msg.role === "assistant" && onMessageFeedback
                        ? (rating) => onMessageFeedback(msg.id, rating)
                        : undefined
                    }
                    feedbackHelpfulLabel={feedbackHelpfulLabel}
                    feedbackNotHelpfulLabel={feedbackNotHelpfulLabel}
                    voiceShowTranscriptLabel={voiceShowTranscriptLabel}
                    voiceHideTranscriptLabel={voiceHideTranscriptLabel}
                    onOpenVoiceMessageDetail={onOpenVoiceMessageDetail}
                    onOpenAttachments={
                      msg.role === "user" && (msg.attachments?.length ?? 0) > 0 && onOpenMessageAttachments
                        ? onOpenMessageAttachments
                        : undefined
                    }
                  />
                </div>
              </div>
            );
          })
          : null}
        {showSuggestedBlock ? (
          <div className="mt-auto mb-2 flex w-full min-w-0 max-w-full flex-shrink-0 flex-col items-stretch justify-end">
            <div className="flex w-full min-w-0 max-w-full flex-wrap justify-end gap-2">
              {visibleSuggestionChips.map((chip, qIndex) => (
                <button
                  key={chip.suggestionId ? `sid:${chip.suggestionId}` : `sq:${chip.label}:${qIndex}`}
                  type="button"
                  onClick={() =>
                    onSuggestedQuestionClick!(
                      chip.label,
                      chip.suggestionId ? { suggestionId: chip.suggestionId } : undefined,
                    )
                  }
                  disabled={isSending}
                  className={cx(
                    "max-w-[min(100%,20rem)] min-w-0 border px-4 py-2.5 text-left text-sm font-normal break-words whitespace-normal text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  style={{
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                    borderRadius: `${Math.max(0, Math.min(32, bubbleBorderRadius ?? 20))}px`,
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div ref={endRef} aria-hidden className="h-0 w-0 shrink-0 overflow-hidden" />
          </div>
        ) : null}
        {showTypingIndicator ? (
          <div className="flex justify-start items-center" role="status" aria-live="polite" aria-atomic="true">
            <span className="sr-only">{typingStatusLabel}</span>
            <div
              className={cx(
                "chat-bubble-surface rounded-2xl px-3 py-2.5 flex items-center gap-1 border",
                dark ? "bg-gray-600/70 border-gray-500/55" : "bg-gray-50/95 border-gray-200/90",
              )}
              aria-hidden
            >
              <span
                className={cx(
                  "w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]",
                  dark ? "bg-gray-400/95" : "bg-gray-500/90",
                )}
              />
              <span
                className={cx(
                  "w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]",
                  dark ? "bg-gray-400/95" : "bg-gray-500/90",
                )}
              />
              <span
                className={cx("w-2 h-2 rounded-full animate-bounce", dark ? "bg-gray-400/95" : "bg-gray-500/90")}
              />
            </div>
          </div>
        ) : null}
        {!showSuggestedBlock && visibleMessages.length > 0 ? <div ref={endRef} aria-hidden /> : null}
      </div>
      {showScrollToBottom && scrollButtonVisible ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cx(
            "absolute bottom-3 z-10 inline-flex items-center rounded-full text-xs font-medium text-white shadow-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2",
            scrollToBottomButtonPositionClass(scrollToBottomAlign),
            showScrollToBottomLabel ? "gap-1.5 px-3 py-2" : "p-2.5",
            dark ? "focus:ring-offset-gray-900" : "focus:ring-offset-white"
          )}
          style={{ backgroundColor: scrollToBottomChromeColor }}
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
