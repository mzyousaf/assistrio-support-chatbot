"use client";

import React, { useCallback, useState } from "react";
import type { ChatUIMessage, ChatUISource } from "./types";
import { cx } from "./utils";
import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatComposer } from "./ChatComposer";

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
  /** Quick links in menu (max 3): { text, route } */
  menuQuickLinks?: Array<{ text: string; route: string }>;
  onClose?: () => void;

  // Messages (controlled)
  messages: ChatUIMessage[];
  isSending?: boolean;
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
  /** Footer text when showBranding (e.g. "Powered by ..."). Falls back to privacyText if unset. */
  brandingMessage?: string;
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
  showScrollbar = true,
  composerAsSeparateBox = true,
  composerBorderWidth = 1,
  composerBorderColor = "primary",
  onMenu,
  showMenuExpand,
  onMenuExpand,
  isExpanded,
  menuQuickLinks,
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
  const effectiveStatus = statusIndicator ?? (showLive ? "live" : "none");

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  }, [input, onSend]);

  const handleSuggested = useCallback(
    (text: string) => {
      onSuggestedQuestion?.(text);
      setInput(text);
      onSend(text);
      setInput("");
    },
    [onSuggestedQuestion, onSend]
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
    ...strings,
  };

  const hasUserMessage = messages.some((m) => m.role === "user");
  const showOnlyQuickQuestions =
    !hasUserMessage &&
    showSuggestedChips &&
    suggestedQuestions &&
    suggestedQuestions.length > 0 &&
    !showComposerWithSuggestedQuestions;

  return (
    <div
      className={cx(
        "flex flex-col overflow-hidden shadow-xl rounded-2xl",
        dark
          ? "bg-gray-900 text-gray-100"
          : "bg-white text-gray-900",
        className
      )}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...(showChatBorder && accentColor
          ? { border: `1px solid ${accentColor}99` }
          : {}),
        ...style,
      }}
      role="region"
      aria-label="Chat"
    >
      {showHeader ? (
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
          onClose={onClose}
          backLabel={s.back}
          closeLabel={s.close}
          menuLabel={s.menu}
          liveLabel={s.live}
          activeLabel={s.active ?? "Active"}
        />
      ) : null}
      <ChatMessages
        dark={dark}
        messages={messages}
        isSending={isSending}
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
        scrollToBottomLabel={s.scrollToBottomLabel}
        showScrollToBottom={showScrollToBottom}
        showScrollbar={showScrollbar}
        emptyState={emptyState}
        onSourceClick={onSourceClick}
        suggestedQuestions={
          showSuggestedChips && suggestedQuestions && suggestedQuestions.length > 0 ? suggestedQuestions : undefined
        }
        onSuggestedQuestionClick={handleSuggested}
        compact={compact}
      />
      {!showOnlyQuickQuestions ? (
        <ChatComposer
          dark={dark}
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isSending}
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
          className={compact ? "p-2" : undefined}
        />
      ) : null}
      {showFooter && (brandingMessage ?? privacyText ?? s.privacyText) ? (
        <footer
          className={cx(
            "flex-shrink-0 text-center border-t rounded-b-2xl",
            dark ? "border-gray-700" : "border-gray-200",
            compact ? "px-2 py-1" : "px-4 py-2"
          )}
        >
          <p className={cx("text-xs", dark ? "text-gray-500" : "text-gray-500")}>
            {brandingMessage ?? privacyText ?? s.privacyText}
          </p>
        </footer>
      ) : null}
    </div>
  );
}
