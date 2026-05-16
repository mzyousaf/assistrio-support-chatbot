import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScrollChromeStyle, UserBubbleStyle } from "../../models/botChatUI";
import type { SuggestedQuestionChip } from "../../types";
import type { ChatUIMessage, ChatUISource } from "./types";
import { ChatBubble } from "./ChatBubble";
import { cx } from "./utils";

const SCROLL_THRESHOLD = 80;
const DEFAULT_SCROLL_TO_BOTTOM_TEXT = "Scroll to latest";

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

/** Centered indeterminate loader while conversation messages are fetched. */
function ConversationLoadingIndicator({
  dark = true,
  accentColor = "#6366f1",
}: {
  dark?: boolean;
  accentColor?: string;
}) {
  const tone = (accentColor ?? "").trim() || "#6366f1";
  return (
    <div
      className="flex h-full min-h-[10rem] w-full flex-1 flex-col items-center justify-center px-4"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <svg
        className="h-10 w-10 shrink-0 animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ color: tone }}
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="26 58"
          className={dark ? "opacity-90" : "opacity-85"}
        />
      </svg>
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

  useEffect(() => {
    if (messageListOverflow === "hidden") return;
    const list = listRef.current;

    const users = visibleMessages.filter((m) => m.role === "user");
    const lastUser = users[users.length - 1];
    if (lastUser?.status === "sending" && anchoredUserSendIdRef.current !== lastUser.id) {
      anchoredUserSendIdRef.current = lastUser.id;
      const el = list?.querySelector(`[data-message-id="${lastUser.id}"]`);
      requestAnimationFrame(() => {
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (assistantStreaming) {
      if (!userHasScrolledRef.current) {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      if (list) prevScrollHeightRef.current = list.scrollHeight;
      return;
    }

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
          !conversationLoading && (compact ? "p-2 gap-[calc(0.25rem*5)]" : "p-4 gap-[calc(0.25rem*5)]"),
          className
        )}
        style={{
          ["--chat-accent" as string]: scrollBarChromeColor,
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
              "absolute inset-0 z-[1] flex min-h-0 flex-col",
              compact ? "p-2" : "p-4",
            )}
          >
            <ConversationLoadingIndicator dark={dark} accentColor={accentColor} />
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
          <div
            className={cx(
              "mt-auto flex w-full min-w-0 max-w-full flex-shrink-0 flex-col items-stretch justify-end",
              compact ? "px-2 pt-4 pb-0" : "px-4 pt-6 pb-0",
            )}
          >
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
                    "max-w-[min(100%,20rem)] min-w-0 border px-4 py-2.5 text-left text-sm font-medium break-words whitespace-normal text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
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
