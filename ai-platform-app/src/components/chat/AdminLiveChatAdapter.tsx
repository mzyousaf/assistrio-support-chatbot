"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreferredColorScheme } from "@/hooks/usePreferredColorScheme";

import { Chat, ChatWithLauncher } from "@/components/chat-ui";
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

interface SuperAdminChatDebug {
  finalAnswerPipeline?: "unified";
  finalAnswerMode?: "grounded" | "general" | "safe_fallback";
  retrievalOutcome?: "none" | "weak" | "strong";
  retrievalConfidence?: "high" | "medium" | "low";
  /** Distinct knowledge base item ids in the retrieval result (for debug/source). */
  knowledgeBaseItemIds?: string[];
  evidenceItemsInPrompt?: number;
  evidenceItemsTrimmedOut?: string[];
  answerabilityExplanation?: string;
}

interface SuperAdminChatResponse {
  assistantMessage?: string;
  reply?: string;
  content?: string;
  sources?: ChatUISource[];
  conversationId?: string;
  error?: string;
  errorCode?: string;
  debug?: SuperAdminChatDebug;
}

function getRuntimeErrorMessage(
  response: Pick<SuperAdminChatResponse, "error" | "errorCode">,
): string {
  if (typeof response.error === "string" && response.error.trim()) {
    return response.error;
  }
  switch (response.errorCode) {
    case "BOT_NOT_PUBLISHED":
      return "This bot is not available right now.";
    case "INVALID_ACCESS_KEY":
      return "Invalid chat access key.";
    case "INVALID_SECRET_KEY":
      return "Invalid chat secret key.";
    case "VISITOR_ID_REQUIRED":
      return "Visitor session is required for this chat.";
    case "MESSAGE_LIMIT_REACHED":
      return "This bot has reached its message limit.";
    default:
      return "No response.";
  }
}

function truncateSubtitle(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd().replace(/\s+\S*$/, "") + "…";
}

export interface AdminLiveChatAdapterProps {
  botId: string;
  botName: string;
  avatarUrl?: string;
  /** Shown in header when no image URL */
  avatarEmoji?: string;
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
  /** When set, chat requests go to this origin (embed / external API). Otherwise same-origin + NEXT_PUBLIC_API_BASE_URL via apiFetch. */
  apiBaseUrl?: string;
  /** Optional embed/site key; sent in JSON body when set. */
  accessKey?: string;
  /** Append ?debug=true to chat URL (default true for in-app live test). */
  debug?: boolean;
  /** Footer privacy line when branding is shown; defaults to in-app test copy when omitted. */
  footerPrivacyText?: string;
  /** Use floating launcher + panel (e.g. embed widget) instead of a sized preview panel. */
  useFloatingLauncher?: boolean;
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
  avatarEmoji,
  chatUI,
  tagline,
  description,
  welcomeMessage,
  suggestedQuestions,
  onClose,
  onBack,
  onMenu,
  expandHref,
  apiBaseUrl,
  accessKey,
  debug = true,
  footerPrivacyText,
  useFloatingLauncher = false,
  className,
  style,
}: AdminLiveChatAdapterProps) {
  void expandHref;

  const chatPath = `/api/user/bots/${botId}/chat${debug ? "?debug=true" : ""}`;
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/+$/, "")}${chatPath}`
    : chatPath;
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
        const bodyPayload = {
          message: value,
          ...(conversationIdRef.current && { conversationId: conversationIdRef.current }),
          ...(accessKey ? { accessKey } : {}),
        };
        const res = apiBaseUrl
          ? await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(bodyPayload),
          })
          : await apiFetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(bodyPayload),
          });

        const data = (await res.json().catch(() => ({}))) as SuperAdminChatResponse;

        const content =
          data.assistantMessage ??
          data.reply ??
          data.content ??
          getRuntimeErrorMessage(data);
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
    [endpoint, isSending, apiBaseUrl, accessKey]
  );

  const privacyTextResolved =
    showBranding
      ? (footerPrivacyText ?? "Your test conversations are not stored.")
      : undefined;

  const launcherPosition =
    chatUI?.launcherPosition === "bottom-left" ? "bottom-left" : "bottom-right";

  const avatarNode =
    chatUI?.showAvatarInHeader !== false
      ? avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : avatarEmoji ? (
        <span className="text-2xl" aria-hidden>
          {avatarEmoji}
        </span>
      ) : undefined
      : undefined;

  const chatShared = {
    width: "100%" as const,
    height: "100%" as const,
    dark,
    accentColor: primaryColor,
    bubbleBorderRadius,
    showChatBorder: chatUI?.showChatBorder !== false,
    showHeader: true,
    showAvatarInHeader: chatUI?.showAvatarInHeader !== false,
    showFooter: showBranding,
    brandingMessage: (chatUI?.brandingMessage ?? "").trim() || undefined,
    privacyText: privacyTextResolved,
    statusIndicator: chatUI?.statusIndicator ?? "live",
    liveIndicatorStyle: chatUI?.liveIndicatorStyle ?? "label",
    statusDotStyle: chatUI?.statusDotStyle ?? "blinking",
    showScrollToBottom: chatUI?.showScrollToBottom !== false,
    showScrollbar: chatUI?.showScrollbar !== false,
    composerAsSeparateBox: chatUI?.composerAsSeparateBox !== false,
    composerBorderWidth: composerBorderWidthFromChatUI(chatUI),
    composerBorderColor: chatUI?.composerBorderColor === "default" ? "default" as const : "primary" as const,
    showSuggestedChips: Boolean(suggestedQuestions?.length),
    suggestedQuestions,
    showComposerWithSuggestedQuestions: chatUI?.showComposerWithSuggestedQuestions === true,
    onBack: onBack ?? (() => { }),
    onMenu,
    showMenuExpand: useFloatingLauncher ? false : chatUI?.showMenuExpand !== false,
    onMenuExpand: useFloatingLauncher ? undefined : () => setExpanded((e) => !e),
    isExpanded: useFloatingLauncher ? undefined : expanded,
    menuQuickLinks: chatUI?.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined,
    onClose: onClose ?? (() => { }),
    avatar: avatarNode,
    title: botName,
    subtitle,
    messages,
    isSending,
    onSend,
    showMetadata: true,
    senderName:
      (chatUI?.senderName ?? "").trim()
        ? (chatUI?.senderName ?? "").trim()
        : `${botName}${DEFAULT_SENDER_NAME_SUFFIX}`,
    showSenderName: chatUI?.showSenderName !== false,
    showTime: chatUI?.showTime !== false,
    timePosition: chatUI?.timePosition === "bottom" ? "bottom" as const : "top" as const,
    showCopyButton: chatUI?.showCopyButton !== false,
    showSources: chatUI?.showSources !== false,
    allowMarkdown: true,
    strings: {
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
    },
    showAttach: chatUI?.allowFileUpload === true,
    showEmoji: chatUI?.showEmoji !== false,
    showMic: chatUI?.showMic === true,
    onAttach: () => { },
    onEmoji: () => { },
    onMic: () => { },
  };

  if (useFloatingLauncher) {
    return (
      <ChatWithLauncher
        {...chatShared}
        launcherPosition={launcherPosition}
        defaultOpen={false}
        width={400}
        height={700}
        accentColor={primaryColor}
        dark={dark}
        onClose={onClose}
        className={className}
        style={style}
      />
    );
  }

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
        {...chatShared}
        showMenuExpand={chatUI?.showMenuExpand !== false}
        onMenuExpand={() => setExpanded((e) => !e)}
        isExpanded={expanded}
        strings={{
          ...chatShared.strings,
          expandLabel: expanded ? "Collapse" : "Expand chat",
        }}
        style={{ border: "none", boxShadow: "none" }}
      />
    </div>
  );
}
