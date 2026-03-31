import React, { useCallback, useState } from "react";
import type { RefObject } from "react";
import { History } from "lucide-react";
import { cx } from "./utils";
import type { ChatShadowIntensity } from "../../models/botChatUI";
import type { ChatUIMessage, ChatUISource } from "./types";
import { chatShadowIntensityClass } from "./chatShadowStyles";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";

function formatRecentWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(0, 16);
  }
}

const HistoryBackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

export interface ChatProps {
  /** Container width (default 400) */
  width?: number | string;
  /** Container height (default 700) */
  height?: number | string;
  /** Dark theme (default true) */
  dark?: boolean;
  /** Accent color for user bubble and send button */
  accentColor?: string;
  /** Message bubble border radius in px (0–32). Affects message bubbles and suggested chips; container uses fixed radius. */
  bubbleBorderRadius?: number;
  /** When true, show a border around the chat panel using accent color (default true). */
  showChatBorder?: boolean;
  /** Border width in px when showChatBorder (0–5, default 1). 0 = no border. */
  chatPanelBorderWidth?: number;
  /** Drop shadow for the chat panel (default medium). Use "none" when an outer wrapper supplies shadow. */
  shadowIntensity?: ChatShadowIntensity;

  // Header
  showHeader?: boolean;
  /** Show bot avatar in header (default true) */
  showAvatarInHeader?: boolean;
  onBack?: () => void;
  /** Show back button in header (default false) */
  showBackButton?: boolean;
  avatar?: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Status indicator: "live" | "active" | "none". When "none", no indicator is shown. */
  statusIndicator?: "live" | "active" | "none";
  /** Legacy: when statusIndicator is unset, showLive true = "live", false = "none" */
  showLive?: boolean;
  /** "label" = dot + label text next to title; "dot-only" = dot overlapping avatar */
  liveIndicatorStyle?: "label" | "dot-only";
  /** Status dot: "blinking" (animate-pulse) or "static" (default "blinking") */
  statusDotStyle?: "blinking" | "static";
  /** Show scroll-to-bottom button when user scrolls up (default true) */
  showScrollToBottom?: boolean;
  /** Show label beside the arrow on that button (default true) */
  showScrollToBottomLabel?: boolean;
  /** Custom scroll-to-bottom label (defaults via strings / “Scroll to latest”) */
  scrollToBottomLabel?: string;
  /** Show scrollbar in message area (default true). When false, scrollbar is hidden. */
  showScrollbar?: boolean;
  /** When true, message input is a separate box (border-top + bg). When false, no border and no bg (default true). */
  composerAsSeparateBox?: boolean;
  /** Message input border width in px. 0 = default 1px; 0.5–6 = custom. Focus = width × 1.5. Default 1. */
  composerBorderWidth?: number;
  /** When width >= 0.5: "default" = gray, "primary" = accent. Default "primary". */
  composerBorderColor?: "default" | "primary";
  onMenu?: () => void;
  /** Show "Expand chat" in menu dropdown */
  showMenuExpand?: boolean;
  onMenuExpand?: () => void;
  /** When true, menu shows collapse icon/label for expand option */
  isExpanded?: boolean;
  /** Quick links in menu (max 10): { text, route } */
  menuQuickLinks?: Array<{ text: string; route: string; icon?: string }>;
  /** Header button icon for the quick links dropdown (default link-2). */
  quickLinksMenuIcon?: string;
  /** When false, hide quick links control (default true). */
  showMenuQuickLinks?: boolean;
  /** When true, session menu shows Start new / End / Recent */
  showSessionMenu?: boolean;
  /** Hide individual session actions (defaults true when omitted). */
  showSessionStartNew?: boolean;
  showSessionEndChat?: boolean;
  showSessionRecentChats?: boolean;
  onSessionStartNewChat?: () => void;
  onSessionEndChat?: () => void;
  sessionRecentChats?: Array<{ id: string; preview: string; lastActivityAt: string }>;
  onSessionSelectRecentChat?: (conversationId: string) => void;
  /** e.g. "3 / 5 saved conversations" when a cap is set; omitted when unlimited */
  sessionUsageLabel?: string;
  /** Disable Start new chat when at cap */
  sessionStartNewDisabled?: boolean;
  /** When true, user can open the recent-chats panel (may differ from showSessionMenu when only history is available). */
  sessionHistoryEnabled?: boolean;
  /** Block typing (e.g. viewing a past thread in single-thread mode). */
  composerReadOnly?: boolean;
  /** Show skeleton while loading conversation messages from the server. */
  conversationLoading?: boolean;
  /** Shown above the composer when composerReadOnly */
  readOnlyNotice?: string;
  /** Shown when composerReadOnly; e.g. return to latest writable thread */
  onBackToWritableChat?: () => void;
  onClose?: () => void;

  // Messages (controlled)
  messages: ChatUIMessage[];
  isSending?: boolean;
  /** Resend a failed user message (same id / content). */
  onRetryMessage?: (messageId: string) => void;
  showMetadata?: boolean;
  /** Display name for assistant (e.g. "Bot Name - AI") */
  senderName?: string;
  /** Show sender/assistant name above messages (default true) */
  showSenderName?: boolean;
  /** Show message time (default true) */
  showTime?: boolean;
  /** Where to show time: "top" (above) or "bottom" (assistant=right, user=left) */
  timePosition?: "top" | "bottom";
  showCopyButton?: boolean;
  showSources?: boolean;
  /** Render assistant messages with simple markdown (**bold**, `code`) */
  allowMarkdown?: boolean;
  emptyState?: React.ReactNode;
  onSourceClick?: (source: ChatUISource) => void;

  // Composer
  onSend: (message: string) => void;
  /** Focus target when the chat panel opens (floating embed). */
  composerTextAreaRef?: RefObject<HTMLTextAreaElement | null>;
  composerPlaceholder?: string;
  /** Max characters for input (optional) */
  inputMaxLength?: number;
  /** Max rows for composer textarea (default 8) */
  maxComposerRows?: number;
  showAttach?: boolean;
  showEmoji?: boolean;
  showMic?: boolean;
  onAttach?: () => void;
  onEmoji?: () => void;
  onMic?: () => void;

  // Optional suggested questions (shown when no messages)
  suggestedQuestions?: string[];
  /** When false, suggested chips are hidden even if suggestedQuestions is set (default true) */
  showSuggestedChips?: boolean;
  /** When true, show chat input together with suggested questions on first message. When false, only quick-question chips until user sends (default false). */
  showComposerWithSuggestedQuestions?: boolean;
  onSuggestedQuestion?: (text: string) => void;

  // Footer
  showFooter?: boolean;
  /** Primary footer line (e.g. "Powered by …"). */
  brandingMessage?: string;
  /** Optional second line (e.g. privacy notice). Shown below branding when both are set. */
  privacyText?: string;

  // Layout
  /** Tighter padding (default false) */
  compact?: boolean;

  // Strings
  strings?: Partial<{
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    copy: string;
    copied: string;
    sourcesLabel: string;
    scrollToBottomLabel: string;
    privacyText: string;
    back: string;
    close: string;
    menu: string;
    live: string;
    active: string;
    expandLabel: string;
    startNewChat?: string;
    endChat?: string;
    /** ⋮ menu label and list region label (default “View recent chats”). */
    recentChats?: string;
    quickLinks?: string;
    chatActions?: string;
    /** Title in the header when the recent-chats list is open (default “Recent Chats”). */
    chatHistory?: string;
    /** Empty state when there are no past conversations */
    chatHistoryEmpty?: string;
    backToLatestChat?: string;
    chatDialogLabel?: string;
    messageSendFailed?: string;
    retrySend?: string;
    typingStatusLabel?: string;
  }>;

  className?: string;
  style?: React.CSSProperties;
}

export function Chat({
  width = 400,
  height = 700,
  dark = true,
  accentColor = "#6366f1",
  bubbleBorderRadius = 20,
  showChatBorder = true,
  chatPanelBorderWidth = 1,
  shadowIntensity = "medium",
  showHeader = true,
  showAvatarInHeader = true,
  onBack,
  showBackButton = false,
  avatar,
  title,
  subtitle,
  statusIndicator,
  showLive = false,
  liveIndicatorStyle,
  statusDotStyle = "blinking",
  showScrollToBottom = true,
  showScrollToBottomLabel = true,
  scrollToBottomLabel,
  showScrollbar = true,
  composerAsSeparateBox = true,
  composerBorderWidth = 1,
  composerBorderColor = "primary",
  onMenu,
  showMenuExpand,
  onMenuExpand,
  isExpanded,
  menuQuickLinks,
  quickLinksMenuIcon,
  showMenuQuickLinks,
  showSessionMenu,
  showSessionStartNew = true,
  showSessionEndChat = true,
  showSessionRecentChats = true,
  onSessionStartNewChat,
  onSessionEndChat,
  sessionRecentChats,
  onSessionSelectRecentChat,
  sessionUsageLabel,
  sessionStartNewDisabled = false,
  sessionHistoryEnabled,
  composerReadOnly = false,
  conversationLoading = false,
  readOnlyNotice,
  onBackToWritableChat,
  onClose,
  messages,
  isSending = false,
  showMetadata = true,
  senderName,
  showSenderName = true,
  showTime = true,
  timePosition = "top",
  showCopyButton = true,
  showSources = true,
  allowMarkdown = false,
  emptyState,
  onSourceClick,
  onSend,
  onRetryMessage,
  composerTextAreaRef,
  composerPlaceholder,
  inputMaxLength,
  maxComposerRows,
  showAttach = true,
  showEmoji = true,
  showMic = true,
  onAttach,
  onEmoji,
  onMic,
  suggestedQuestions,
  showSuggestedChips = true,
  showComposerWithSuggestedQuestions = false,
  onSuggestedQuestion,
  showFooter = true,
  brandingMessage,
  privacyText,
  compact = false,
  strings = {},
  className,
  style,
}: ChatProps) {
  const [input, setInput] = useState("");
  const [historyViewOpen, setHistoryViewOpen] = useState(false);
  const effectiveStatus = statusIndicator ?? (showLive ? "live" : "none");

  const handleSend = useCallback(() => {
    if (composerReadOnly || conversationLoading) return;
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  }, [input, onSend, composerReadOnly, conversationLoading]);

  const handleSuggested = useCallback(
    (text: string) => {
      if (composerReadOnly || conversationLoading) return;
      onSuggestedQuestion?.(text);
      setInput(text);
      onSend(text);
      setInput("");
    },
    [onSuggestedQuestion, onSend, composerReadOnly, conversationLoading]
  );

  const s = {
    title: "Chat",
    subtitle: "",
    placeholder: "Type a message…",
    send: "Send",
    copy: "Copy",
    copied: "Copied!",
    sourcesLabel: "Sources",
    scrollToBottomLabel: "Scroll to latest",
    privacyText: "Your conversations are private and secure.",
    back: "Back",
    close: "Close",
    menu: "Menu",
    live: "Live",
    active: "Active",
    expandLabel: "Expand chat",
    startNewChat: "Start a new chat",
    endChat: "End chat",
    recentChats: "View recent chats",
    quickLinks: "Quick links",
    chatActions: "Chat actions",
    chatHistory: "Recent Chats",
    chatHistoryEmpty: "No conversations yet.",
    backToLatestChat: "Back to current chat",
    chatDialogLabel: "Chat",
    messageSendFailed: "Couldn’t send",
    retrySend: "Retry",
    typingStatusLabel: "Assistant is typing",
    ...strings,
  };

  const historyEnabled = sessionHistoryEnabled ?? showSessionMenu;
  const hasUserMessage = messages.some((m) => m.role === "user");
  const showOnlyQuickQuestions =
    !conversationLoading &&
    !historyViewOpen &&
    !hasUserMessage &&
    showSuggestedChips &&
    suggestedQuestions &&
    suggestedQuestions.length > 0 &&
    !showComposerWithSuggestedQuestions;

  const handleSelectHistoryChat = useCallback(
    (id: string) => {
      onSessionSelectRecentChat?.(id);
      setHistoryViewOpen(false);
    },
    [onSessionSelectRecentChat],
  );

  const handleHistoryStartNew = useCallback(() => {
    onSessionStartNewChat?.();
    setHistoryViewOpen(false);
  }, [onSessionStartNewChat]);

  const showHistoryChrome = Boolean(historyEnabled && historyViewOpen);

  return (
    <div
      className={cx(
        "assistrio-chat-widget flex flex-col overflow-hidden rounded-2xl",
        chatShadowIntensityClass(shadowIntensity),
        dark
          ? "dark bg-gray-900 text-gray-100"
          : "bg-white text-gray-900",
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...(showChatBorder && accentColor && chatPanelBorderWidth > 0
          ? { border: `${chatPanelBorderWidth}px solid ${accentColor}99` }
          : {}),
        ...style,
      }}
      role="region"
      aria-label={s.chatDialogLabel}
    >
      {showHeader && !showHistoryChrome ? (
        <ChatHeader
          dark={dark}
          showAvatar={showAvatarInHeader}
          onBack={onBack}
          showBackButton={showBackButton}
          avatar={avatar}
          title={title ?? s.title}
          subtitle={subtitle ?? s.subtitle}
          statusIndicator={effectiveStatus}
          liveIndicatorStyle={liveIndicatorStyle}
          statusDotStyle={statusDotStyle}
          onMenu={onMenu}
          showMenuExpand={showMenuExpand}
          onMenuExpand={onMenuExpand}
          expandLabel={s.expandLabel}
          isExpanded={isExpanded}
          menuQuickLinks={menuQuickLinks}
          quickLinksMenuIcon={quickLinksMenuIcon}
          showMenuQuickLinks={showMenuQuickLinks}
          showSessionMenu={showSessionMenu}
          showSessionStartNew={showSessionStartNew}
          showSessionEndChat={showSessionEndChat}
          showSessionRecentChats={showSessionRecentChats}
          onSessionStartNewChat={onSessionStartNewChat}
          onSessionEndChat={onSessionEndChat}
          sessionEndChatDisabled={!hasUserMessage}
          sessionStartNewDisabled={sessionStartNewDisabled}
          sessionUsageLabel={sessionUsageLabel}
          onSessionOpenHistory={() => setHistoryViewOpen(true)}
          onClose={onClose}
          backLabel={s.back}
          closeLabel={s.close}
          menuLabel={s.menu}
          quickLinksMenuLabel={s.quickLinks}
          sessionMenuLabel={s.chatActions}
          startNewChatLabel={s.startNewChat}
          endChatLabel={s.endChat}
          recentChatsLabel={s.recentChats}
          liveLabel={s.live}
          activeLabel={s.active ?? "Active"}
        />
      ) : null}
      {showHeader && showHistoryChrome ? (
        <header
          className={cx(
            "relative flex-shrink-0 border-b px-4 py-3",
            dark ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50",
          )}
          aria-label={s.chatHistory}
        >
          <button
            type="button"
            onClick={() => setHistoryViewOpen(false)}
            className={cx(
              "absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-2 transition-colors",
              dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
            )}
            aria-label={s.back}
          >
            <HistoryBackIcon />
          </button>
          <div className="mx-auto flex min-w-0 max-w-full flex-col items-center gap-0.5 px-11 text-center">
            <div className="flex min-w-0 max-w-full items-center justify-center gap-2.5">
              <div
                className="flex h-8 w-8 max-h-[32px] max-w-[32px] flex-shrink-0 items-center justify-center rounded-full shadow-sm"
                style={{ backgroundColor: accentColor }}
                aria-hidden
              >
                <History className="h-[20px] w-[20px] text-white" strokeWidth={2} />
              </div>
              <h2
                className={cx(
                  "min-w-0 max-w-full truncate text-sm font-semibold",
                  dark ? "text-gray-100" : "text-gray-900",
                )}
              >
                {s.chatHistory}
              </h2>
            </div>
            {sessionUsageLabel ? (
              <p
                className={cx("max-w-full text-[10px] leading-snug", dark ? "text-gray-500" : "text-gray-500")}
              >
                {sessionUsageLabel}
              </p>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className={cx(
                "absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-2 transition-colors",
                dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800",
              )}
              aria-label={s.close}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2" aria-hidden />
          )}
        </header>
      ) : null}
      {showHistoryChrome ? (
        <div
          className={cx(
            "flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-2",
            dark ? "bg-gray-900" : "bg-white",
            showScrollbar ? "" : "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
          role={!sessionRecentChats || sessionRecentChats.length === 0 ? undefined : "list"}
          aria-label={s.recentChats}
        >
          {!sessionRecentChats || sessionRecentChats.length === 0 ? (
            <div
              className={cx(
                "flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center",
              )}
            >
              <p
                className={cx(
                  "max-w-[18rem] text-sm leading-relaxed",
                  dark ? "text-gray-400" : "text-gray-500",
                )}
              >
                {s.chatHistoryEmpty}
              </p>
              <button
                type="button"
                disabled={sessionStartNewDisabled}
                onClick={() => {
                  if (sessionStartNewDisabled) return;
                  handleHistoryStartNew();
                }}
                className={cx(
                  "rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  dark ? "focus-visible:ring-offset-gray-900" : "focus-visible:ring-offset-white",
                  sessionStartNewDisabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:opacity-90",
                )}
                style={{
                  backgroundColor: accentColor,
                  boxShadow: `0 1px 2px ${accentColor}44`,
                }}
              >
                {s.startNewChat}
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {sessionRecentChats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectHistoryChat(c.id)}
                    className={cx(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      dark
                        ? "border-gray-600/80 bg-gray-800/40 hover:bg-gray-800"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                    )}
                  >
                    <span
                      className={cx(
                        "block text-sm font-medium line-clamp-2",
                        dark ? "text-gray-100" : "text-gray-900",
                      )}
                    >
                      {c.preview || "Chat"}
                    </span>
                    <span
                      className={cx(
                        "mt-1 block text-xs",
                        dark ? "text-gray-400" : "text-gray-500",
                      )}
                    >
                      {formatRecentWhen(c.lastActivityAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <ChatMessages
            dark={dark}
            messages={messages}
            isSending={isSending}
            conversationLoading={conversationLoading}
            accentColor={accentColor}
            showMetadata={showMetadata}
            senderName={senderName}
            showSenderName={showSenderName}
            showTime={showTime}
            timePosition={timePosition}
            showCopyButton={showCopyButton}
            showSources={showSources}
            bubbleBorderRadius={bubbleBorderRadius}
            allowMarkdown={allowMarkdown}
            copyLabel={s.copy}
            copiedLabel={s.copied}
            sourcesLabel={s.sourcesLabel}
            scrollToBottomLabel={scrollToBottomLabel ?? s.scrollToBottomLabel}
            showScrollToBottomLabel={showScrollToBottomLabel}
            showScrollToBottom={showScrollToBottom}
            showScrollbar={showScrollbar}
            emptyState={emptyState}
            onSourceClick={onSourceClick}
            suggestedQuestions={
              showSuggestedChips && suggestedQuestions && suggestedQuestions.length > 0 ? suggestedQuestions : undefined
            }
            onSuggestedQuestionClick={handleSuggested}
            compact={compact}
            typingStatusLabel={s.typingStatusLabel}
            messageSendFailedLabel={s.messageSendFailed}
            retrySendLabel={s.retrySend}
            onRetryMessage={onRetryMessage}
          />
          {!showOnlyQuickQuestions ? (
            <>
              {composerReadOnly && (readOnlyNotice || onBackToWritableChat) ? (
                <div
                  className={cx(
                    "flex-shrink-0 border-t px-3 py-2 flex flex-col gap-2",
                    dark ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-amber-50/90",
                  )}
                  role="status"
                >
                  {readOnlyNotice ? (
                    <p
                      className={cx(
                        "text-xs leading-snug",
                        dark ? "text-gray-300" : "text-gray-700",
                      )}
                    >
                      {readOnlyNotice}
                    </p>
                  ) : null}
                  {onBackToWritableChat ? (
                    <button
                      type="button"
                      onClick={onBackToWritableChat}
                      className={cx(
                        "self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity",
                        dark ? "bg-gray-700 text-gray-100 hover:bg-gray-600" : "bg-white text-gray-900 shadow-sm hover:bg-gray-50 border border-gray-200",
                      )}
                    >
                      {s.backToLatestChat}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <ChatComposer
              dark={dark}
              value={input}
              onChange={setInput}
              onSend={handleSend}
              disabled={isSending || composerReadOnly || conversationLoading}
              placeholder={composerPlaceholder ?? s.placeholder}
              sendLabel={s.send}
              accentColor={accentColor}
              inputMaxLength={inputMaxLength}
              maxComposerRows={maxComposerRows}
              showAttach={showAttach}
              showEmoji={showEmoji}
              showMic={showMic}
              asSeparateBox={composerAsSeparateBox}
              composerBorderWidth={composerBorderWidth}
              composerBorderColor={composerBorderColor}
              onAttach={onAttach}
              onEmoji={onEmoji}
              onMic={onMic}
              textAreaRef={composerTextAreaRef}
              className={compact ? "p-2" : undefined}
            />
            </>
          ) : null}
        </>
      )}
      {showFooter &&
      !showHistoryChrome &&
      ((brandingMessage ?? "").trim() || (privacyText ?? "").trim()) ? (
        <footer
          className={cx(
            "flex-shrink-0 text-center border-t rounded-b-2xl",
            dark ? "border-gray-700" : "border-gray-200",
            compact ? "px-2 py-1.5" : "px-4 py-2"
          )}
        >
          {(brandingMessage ?? "").trim() ? (
            <p className={cx("text-xs", dark ? "text-gray-300" : "text-gray-500")}>
              {(brandingMessage ?? "").trim()}
            </p>
          ) : null}
          {(privacyText ?? "").trim() ? (
            <p
              className={cx(
                "text-[10px] leading-snug",
                (brandingMessage ?? "").trim() ? "mt-1" : "",
                dark ? "text-gray-400" : "text-gray-500",
              )}
            >
              {(privacyText ?? "").trim()}
            </p>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
