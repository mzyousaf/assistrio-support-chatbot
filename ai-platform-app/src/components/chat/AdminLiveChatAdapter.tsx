"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreferredColorScheme } from "@/hooks/usePreferredColorScheme";

import { Chat } from "@/components/chat-ui";
import type { ChatUIMessage, ChatUISource } from "@/components/chat-ui";
import { mapSources } from "@/components/chat-ui";
import { cx } from "@/components/chat-ui/utils";
import { apiFetch } from "@/lib/api";
import { resolveWelcomeMessage } from "@/lib/welcomeMessage";
import type { BotChatUI } from "@/models/Bot";

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}


const SUBTITLE_MAX_LENGTH = 80;
const DEFAULT_SENDER_NAME_SUFFIX = " - AI";

function truncateSubtitle(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd().replace(/\s+\S*$/, "") + "…";
}

export interface AdminLiveChatAdapterProps {
  botId: string;
  botName: string;
  avatarUrl?: string;
  /** Live chat UI config from form – preview updates as user edits (primaryColor, backgroundStyle, bubbleStyle, etc.) */
  chatUI?: BotChatUI;
  /** Tagline or short description shown under bot name (preferred over description) */
  tagline?: string;
  /** Full description; used when no tagline, truncated for subtitle */
  description?: string;
  /** Shown as first assistant message when set */
  welcomeMessage?: string;
  /** Suggested questions shown when chat is empty (from FAQs or Suggested questions) */
  suggestedQuestions?: string[];
  /** Called when user clicks close (e.g. to close mobile drawer) */
  onClose?: () => void;
  /** Called when user clicks back */
  onBack?: () => void;
  /** Called when user clicks menu (used when no menu dropdown items) */
  onMenu?: () => void;
  /** URL to open when user chooses "Expand chat" in menu (e.g. /demo/:slug) */
  expandHref?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Adapter that renders the Chat UI (Intercom Fin–inspired) for Super Admin live testing in bot edit mode.
 */
const DEFAULT_PRIMARY = "#14B8A6";

function resolveChatUI(
  chatUI: BotChatUI | undefined,
  preferredScheme: "light" | "dark"
): { primaryColor: string; dark: boolean; bubbleBorderRadius: number; showBranding: boolean } {
  const primaryColor =
    typeof chatUI?.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor)
      ? chatUI.primaryColor
      : DEFAULT_PRIMARY;
  const style = chatUI?.backgroundStyle;
  const dark =
    style === "light" ? false : style === "dark" ? true : preferredScheme === "dark";
  const bubbleBorderRadius =
    typeof chatUI?.bubbleBorderRadius === "number"
      ? Math.max(0, Math.min(32, chatUI.bubbleBorderRadius))
      : (chatUI as { bubbleStyle?: string })?.bubbleStyle === "squared"
        ? 0
        : 20;
  const showBranding = chatUI?.showBranding !== false;
  return { primaryColor, dark, bubbleBorderRadius, showBranding };
}

function composerBorderWidthFromChatUI(chatUI: BotChatUI | undefined): number {
  const v = chatUI?.composerBorderWidth;
  if (typeof v === "number" && v >= 0 && v <= 6) {
    const w = Number(v);
    return w > 0 && w < 0.5 ? 0.5 : Math.max(0, Math.min(6, w));
  }
  if ((chatUI as { showComposerBorder?: boolean })?.showComposerBorder === false) return 0;
  return 1;
}

export function AdminLiveChatAdapter({
  botId,
  botName,
  avatarUrl,
  chatUI,
  tagline,
  description,
  welcomeMessage,
  suggestedQuestions,
  onClose,
  onBack,
  onMenu,
  expandHref,
  className,
  style,
}: AdminLiveChatAdapterProps) {
  const endpoint = `/api/super-admin/bots/${botId}/chat?debug=true`;
  const conversationIdRef = useRef<string | null>(null);

  const welcomeMsg = useMemo((): ChatUIMessage | null => {
    const template = (welcomeMessage ?? "").trim();
    if (!template) return null;
    const content = resolveWelcomeMessage(template, {
      name: botName,
      tagline,
      description,
    });
    return {
      id: `welcome_${botId}`,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
  }, [botId, welcomeMessage, botName, tagline, description]);

  const preferredScheme = usePreferredColorScheme();
  const [messages, setMessages] = useState<ChatUIMessage[]>(() => (welcomeMsg ? [welcomeMsg] : []));
  const [isSending, setIsSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { primaryColor, dark, bubbleBorderRadius, showBranding } = resolveChatUI(chatUI, preferredScheme);

  useEffect(() => {
    if (!welcomeMsg) {
      setMessages((prev) => (prev.length === 1 && prev[0]?.id?.startsWith("welcome_") ? [] : prev));
      return;
    }
    setMessages((prev) => {
      const rest = prev.length > 0 && prev[0]?.id?.startsWith("welcome_") ? prev.slice(1) : prev;
      return [welcomeMsg, ...rest];
    });
  }, [welcomeMsg]);

  const subtitle =
    (tagline ?? "").trim() ||
    (description?.trim() ? truncateSubtitle(description, SUBTITLE_MAX_LENGTH) : "") ||
    "Live test";

  const onSend = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || isSending) return;

      const userMsg: ChatUIMessage = {
        id: generateId(),
        role: "user",
        content: value,
        createdAt: isoNow(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      try {
        const res = await apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: value,
            ...(conversationIdRef.current && { conversationId: conversationIdRef.current }),
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          assistantMessage?: string;
          reply?: string;
          content?: string;
          sources?: ChatUISource[];
          conversationId?: string;
          error?: string;
        };

        const content =
          data.assistantMessage ?? data.reply ?? data.content ?? data.error ?? "No response.";
        if (data.conversationId) {
          conversationIdRef.current = data.conversationId;
        }

        const assistantMsg: ChatUIMessage = {
          id: generateId(),
          role: "assistant",
          content: typeof content === "string" ? content : "No response.",
          createdAt: isoNow(),
          sources: mapSources(data.sources),
          status: res.ok ? "sent" : "error",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        const err = e instanceof Error ? e.message : "Network error.";
        const assistantMsg: ChatUIMessage = {
          id: generateId(),
          role: "assistant",
          content: err,
          createdAt: isoNow(),
          status: "error",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [endpoint, isSending]
  );

  return (
    <div
      className={cx("overflow-hidden", className)}
      style={{
        width: expanded ? 560 : 400,
        height: expanded ? "75vh" : 700,
        transition: "width 0.3s ease-out, height 0.3s ease-out",
        ...style,
      }}
    >
      <Chat
        width="100%"
        height="100%"
        dark={dark}
        accentColor={primaryColor}
        bubbleBorderRadius={bubbleBorderRadius}
        showChatBorder={chatUI?.showChatBorder !== false}
        showHeader
        showAvatarInHeader={chatUI?.showAvatarInHeader !== false}
        showFooter={showBranding}
        brandingMessage={(chatUI?.brandingMessage ?? "").trim() || undefined}
        privacyText={showBranding ? "Your test conversations are not stored." : undefined}
        statusIndicator={chatUI?.statusIndicator ?? "live"}
        liveIndicatorStyle={chatUI?.liveIndicatorStyle ?? "label"}
        statusDotStyle={chatUI?.statusDotStyle ?? "blinking"}
        showScrollToBottom={chatUI?.showScrollToBottom !== false}
        showScrollbar={chatUI?.showScrollbar !== false}
        composerAsSeparateBox={chatUI?.composerAsSeparateBox !== false}
        composerBorderWidth={composerBorderWidthFromChatUI(chatUI)}
        composerBorderColor={chatUI?.composerBorderColor === "default" ? "default" : "primary"}
        showSuggestedChips={Boolean(suggestedQuestions?.length)}
        suggestedQuestions={suggestedQuestions}
        showComposerWithSuggestedQuestions={chatUI?.showComposerWithSuggestedQuestions === true}
        onBack={onBack ?? (() => { })}
        onMenu={onMenu}
        showMenuExpand={chatUI?.showMenuExpand !== false}
        onMenuExpand={() => setExpanded((e) => !e)}
        isExpanded={expanded}
        menuQuickLinks={chatUI?.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined}
        onClose={onClose ?? (() => { })}
        avatar={
          chatUI?.showAvatarInHeader !== false
            ? (avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : undefined)
            : undefined
        }
        title={botName}
        subtitle={subtitle}
        messages={messages}
        isSending={isSending}
        onSend={onSend}
        showMetadata
        senderName={
          (chatUI?.senderName ?? "").trim()
            ? (chatUI?.senderName ?? "").trim()
            : `${botName}${DEFAULT_SENDER_NAME_SUFFIX}`
        }
        showSenderName={chatUI?.showSenderName !== false}
        showTime={chatUI?.showTime !== false}
        timePosition={chatUI?.timePosition === "bottom" || chatUI?.timePosition === "bottom-right" ? "bottom" : "top"}
        showCopyButton={chatUI?.showCopyButton !== false}
        showSources={chatUI?.showSources !== false}
        allowMarkdown
        strings={{
          title: botName,
          subtitle,
          placeholder: "Type a message…",
          send: "Send",
          copy: "Copy",
          copied: "Copied!",
          sourcesLabel: "Sources",
          scrollToBottomLabel: "Scroll to latest",
          back: "Back",
          close: "Close",
          menu: "Menu",
          live: "Live",
          active: "Active",
          expandLabel: expanded ? "Collapse" : "Expand chat",
        }}
        showAttach={chatUI?.allowFileUpload === true}
        showEmoji={chatUI?.showEmoji !== false}
        showMic={chatUI?.showMic === true}
        onAttach={() => { }}
        onEmoji={() => { }}
        onMic={() => { }}
      />
    </div>
  );
}
