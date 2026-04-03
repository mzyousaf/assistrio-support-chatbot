import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, MessageCircle } from "lucide-react";

import { usePreferredColorScheme } from "../hooks/usePreferredColorScheme";
import { Chat, ChatWithLauncher } from "./chat-ui";
import type { ChatUIMessage, ChatUISource } from "./chat-ui";
import { mapSources } from "./chat-ui";
import { cx } from "./chat-ui/utils";
import { normalizeLauncherIcon } from "../lib/launcherIconNormalize";
import { normalizeLauncherWhenOpen } from "../lib/launcherWhenOpenNormalize";
import { apiFetch } from "../lib/apiFetch";
import { fetchWithNetworkRetry } from "../lib/fetchWithRetry";
import { runtimeEmbedPost } from "../lib/runtimeEmbedPost";
import { mergeWidgetStrings, type WidgetStrings } from "../lib/widgetStrings";
import { resolveWelcomeMessage } from "../lib/welcomeMessage";
import type { BotChatUI, ChatLauncherWhenOpen } from "../models/botChatUI";
import type { WidgetPreviewOverrides } from "../types";

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
  visitorMultiChatMax?: number | null,
): string {
  if (typeof response.error === "string" && response.error.trim()) {
    return response.error;
  }
  switch (response.errorCode) {
    case "BOT_NOT_PUBLISHED":
      return "This bot is not available for embedding right now.";
    case "INVALID_ACCESS_KEY":
      return "Chat access is invalid. Please verify your access key.";
    case "INVALID_SECRET_KEY":
      return "Chat access is invalid. Please verify your secret key.";
    case "VISITOR_ID_REQUIRED":
      return "A visitor session is required for this bot.";
    case "MESSAGE_LIMIT_REACHED":
      return "This bot has reached its message limit.";
    case "VISITOR_MULTI_CHAT_LIMIT_REACHED":
      if (visitorMultiChatMax != null && Number.isFinite(visitorMultiChatMax) && visitorMultiChatMax > 0) {
        return `You've reached the limit of ${visitorMultiChatMax} saved conversation${visitorMultiChatMax === 1 ? "" : "s"}. Open an existing thread from Recent chats or end one before starting new.`;
      }
      return "You've reached the maximum number of saved conversations.";
    case "CONVERSATION_NOT_FOUND":
      return "That conversation could not be loaded.";
    case "EMBED_DOMAIN_NOT_ALLOWED":
    case "EMBED_ORIGIN_REQUIRED":
    case "EMBED_ORIGIN_INVALID":
    case "EMBED_NO_ALLOWLIST":
    case "PREVIEW_ORIGIN_NOT_ALLOWED":
      return "This chat widget is not allowed on this site.";
    default:
      return "No response.";
  }
}

function truncateSubtitle(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd().replace(/\s+\S*$/, "") + "…";
}

/** Bot glyph: fallback for “Bot avatar” when no image/emoji, and for “Custom” when no custom URL is set. */
function LauncherAvatarPlaceholder() {
  return (
    <span className="flex h-full w-full items-center justify-center text-white" aria-hidden>
      <Bot className="h-[55%] w-[55%] min-h-[18px] min-w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

/**
 * Maps Appearance launcher settings to `ChatLauncherBubble` props (floating embed only).
 * — default: chat icon with optional ring (launcherAvatarRingWidth); when open uses `launcherWhenOpen`.
 * — bot-avatar: bot profile image, else emoji, else bot placeholder.
 * — custom: custom URL if set; otherwise bot placeholder until a URL is added.
 */
function launcherBubbleFromChatUI(
  chatUI: BotChatUI | undefined,
  avatarUrl?: string,
  avatarEmoji?: string,
): {
  size?: number;
  shadowIntensity?: "none" | "low" | "medium" | "high";
  avatar?: React.ReactNode;
  avatarWithBackground?: boolean;
  avatarRingWidth?: number;
  launcherWhenOpen: ChatLauncherWhenOpen;
} {
  const icon = normalizeLauncherIcon(chatUI?.launcherIcon);
  const launcherWhenOpen = normalizeLauncherWhenOpen(chatUI?.launcherWhenOpen);
  const size =
    typeof chatUI?.launcherSize === "number" && chatUI.launcherSize > 0
      ? Math.min(96, Math.max(32, Math.round(chatUI.launcherSize)))
      : undefined;
  const shadowIntensity =
    chatUI?.shadowIntensity === "none" ||
      chatUI?.shadowIntensity === "low" ||
      chatUI?.shadowIntensity === "medium" ||
      chatUI?.shadowIntensity === "high"
      ? chatUI.shadowIntensity
      : undefined;
  const ring =
    typeof chatUI?.launcherAvatarRingWidth === "number"
      ? Math.max(0, Math.min(30, chatUI.launcherAvatarRingWidth))
      : 18;

  if (icon === "bot-avatar") {
    const img = avatarUrl?.trim() ? (
      <img src={avatarUrl.trim()} alt="" className="h-full w-full object-cover rounded-full" />
    ) : avatarEmoji?.trim() ? (
      <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
        {avatarEmoji.trim()}
      </span>
    ) : (
      <LauncherAvatarPlaceholder />
    );
    return {
      size,
      shadowIntensity,
      avatar: img,
      avatarWithBackground: true,
      avatarRingWidth: ring,
      launcherWhenOpen,
    };
  }
  if (icon === "custom") {
    const customUrl = chatUI?.launcherAvatarUrl?.trim();
    if (customUrl) {
      return {
        size,
        shadowIntensity,
        avatar: (
          <img
            src={customUrl}
            alt=""
            className="h-full w-full object-cover rounded-full"
          />
        ),
        avatarWithBackground: true,
        avatarRingWidth: ring,
        launcherWhenOpen,
      };
    }
    return {
      size,
      shadowIntensity,
      avatar: <LauncherAvatarPlaceholder />,
      avatarWithBackground: true,
      avatarRingWidth: ring,
      launcherWhenOpen,
    };
  }
  return {
    size,
    shadowIntensity,
    avatar: (
      <span className="flex h-full w-full items-center justify-center text-white" aria-hidden>
        <MessageCircle className="h-[55%] w-[55%] min-h-[18px] min-w-[18px]" strokeWidth={2} />
      </span>
    ),
    avatarWithBackground: true,
    avatarRingWidth: ring,
    launcherWhenOpen,
  };
}

export interface AdminLiveChatAdapterProps {
  botId: string;
  mode?: "runtime" | "preview";
  botName: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  chatUI?: BotChatUI;
  tagline?: string;
  description?: string;
  welcomeMessage?: string;
  suggestedQuestions?: string[];
  onClose?: () => void;
  onBack?: () => void;
  onMenu?: () => void;
  expandHref?: string;
  apiBaseUrl?: string;
  /**
   * Optional chat endpoint override (relative or absolute URL).
   * Primarily used when the host app proxies widget endpoints.
   */
  chatPostPath?: string;
  accessKey?: string;
  secretKey?: string;
  chatVisitorId: string;
  platformVisitorId?: string;
  authToken?: string;
  previewOverrides?: WidgetPreviewOverrides;
  debug?: boolean;
  footerPrivacyText?: string;
  useFloatingLauncher?: boolean;
  /** From widget init: owner allows multiple threads + optional max */
  visitorMultiChatEnabled?: boolean;
  /** From widget init: null/undefined = unlimited saved threads per visitor */
  visitorMultiChatMax?: number | null;
  /** Shell + chat copy overrides (from `EmbedChatConfig.widgetStrings`). */
  widgetStrings?: WidgetStrings;
  className?: string;
  style?: React.CSSProperties;
}

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

function chatPanelBorderWidthFromChatUI(chatUI: BotChatUI | undefined): number {
  const v = chatUI?.chatPanelBorderWidth;
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.min(5, Math.round(v)));
  }
  return 1;
}

export function AdminLiveChatAdapter({
  botId,
  mode = "runtime",
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
  chatPostPath,
  accessKey,
  secretKey,
  chatVisitorId,
  platformVisitorId,
  authToken,
  previewOverrides,
  debug = true,
  footerPrivacyText,
  useFloatingLauncher = false,
  visitorMultiChatEnabled = false,
  visitorMultiChatMax = null,
  widgetStrings,
  className,
  style,
}: AdminLiveChatAdapterProps) {
  void expandHref;
  void debug;

  /** SessionStorage segment when `chatVisitorId` is empty (authenticated preview; server derives identity). */
  const previewVisitorStorageKey =
    mode === "preview" ? (chatVisitorId.trim() || "auth") : chatVisitorId;

  const defaultChatPath =
    mode === "preview"
      ? "/api/widget/preview/chat"
      : "/api/chat/message";
  const chatPath = chatPostPath ?? defaultChatPath;
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/+$/, "")}${chatPath}`
    : chatPath;
  const conversationIdRef = useRef<string | null>(null);
  const pendingStartNewRef = useRef(false);
  /** One-time restore of latest thread on runtime load (always for runtime so single-thread embeds load history). */
  const didAutoRestoreConversationRef = useRef(false);
  /** Active conversation id for UI (writable vs read-only in single-thread mode). */
  const [viewingConversationId, setViewingConversationId] = useState<string | null>(null);
  const runtimeEmbedOrigin =
    mode === "runtime" && typeof window !== "undefined" ? window.location.origin : undefined;

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
  /** Runtime: no welcome until list confirms empty thread; preview: show welcome immediately. */
  const [includeWelcomeInMessages, setIncludeWelcomeInMessages] = useState(() => mode !== "runtime");
  const [runtimeListLoading, setRuntimeListLoading] = useState(mode === "runtime");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messages, setMessages] = useState<ChatUIMessage[]>(() =>
    mode === "runtime" ? [] : welcomeMsg ? [welcomeMsg] : [],
  );
  const [isSending, setIsSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [floatingPanelExpanded, setFloatingPanelExpanded] = useState(false);
  const { primaryColor, dark, bubbleBorderRadius, showBranding } = resolveChatUI(chatUI, preferredScheme);
  const launcherBubble = useMemo(
    () => launcherBubbleFromChatUI(chatUI, avatarUrl, avatarEmoji),
    [chatUI, avatarUrl, avatarEmoji],
  );

  useEffect(() => {
    if (!includeWelcomeInMessages) return;
    if (!welcomeMsg) {
      setMessages((prev) => (prev.length === 1 && prev[0]?.id?.startsWith("welcome_") ? [] : prev));
      return;
    }
    setMessages((prev) => {
      const rest = prev.length > 0 && prev[0]?.id?.startsWith("welcome_") ? prev.slice(1) : prev;
      return [welcomeMsg, ...rest];
    });
  }, [welcomeMsg, includeWelcomeInMessages]);

  type RecentRow = { id: string; preview: string; lastActivityAt: string };
  const previewRecentStorageKey = `assistrio_preview_recent:${botId}:${previewVisitorStorageKey}`;

  const readPreviewRecent = useCallback((): RecentRow[] => {
    if (typeof window === "undefined" || !window.sessionStorage) return [];
    try {
      const raw = window.sessionStorage.getItem(previewRecentStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => {
          const o = row as Record<string, unknown>;
          const id = typeof o.id === "string" ? o.id : "";
          const preview = typeof o.preview === "string" ? o.preview : "";
          const lastActivityAt = typeof o.lastActivityAt === "string" ? o.lastActivityAt : isoNow();
          return id ? { id, preview, lastActivityAt } : null;
        })
        .filter((x): x is RecentRow => x != null)
        .slice(0, 25);
    } catch {
      return [];
    }
  }, [previewRecentStorageKey]);

  const writePreviewRecent = useCallback(
    (rows: RecentRow[]) => {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      try {
        window.sessionStorage.setItem(previewRecentStorageKey, JSON.stringify(rows.slice(0, 25)));
      } catch {
        /* ignore quota */
      }
    },
    [previewRecentStorageKey],
  );

  const [recentChats, setRecentChats] = useState<RecentRow[]>(() =>
    mode === "preview" && visitorMultiChatEnabled ? [] : [],
  );

  const refreshRuntimeRecent = useCallback(async () => {
    if (mode !== "runtime") return;
    const listPath = "/api/chat/conversations/list";
    const listUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, "")}${listPath}` : listPath;
    const bodyWithoutKeys = {
      botId,
      ...(runtimeEmbedOrigin ? { embedOrigin: runtimeEmbedOrigin } : {}),
      ...(chatVisitorId ? { chatVisitorId } : {}),
      ...(platformVisitorId ? { platformVisitorId } : {}),
    };
    try {
      const res = await runtimeEmbedPost(listUrl, bodyWithoutKeys, { accessKey, secretKey });
      const data = (await res.json().catch(() => ({}))) as { conversations?: RecentRow[] };
      if (res.ok && Array.isArray(data.conversations)) {
        setRecentChats(data.conversations);
      }
    } catch {
      /* ignore */
    } finally {
      if (mode === "runtime") {
        setRuntimeListLoading(false);
      }
    }
  }, [mode, botId, apiBaseUrl, accessKey, secretKey, runtimeEmbedOrigin, chatVisitorId, platformVisitorId]);

  useEffect(() => {
    if (mode === "preview") {
      if (visitorMultiChatEnabled) {
        setRecentChats(readPreviewRecent());
      } else {
        setRecentChats([]);
      }
      return;
    }
    void refreshRuntimeRecent();
  }, [visitorMultiChatEnabled, mode, readPreviewRecent, refreshRuntimeRecent]);

  useEffect(() => {
    didAutoRestoreConversationRef.current = false;
    setViewingConversationId(null);
    setIncludeWelcomeInMessages(mode !== "runtime");
    setRuntimeListLoading(mode === "runtime");
    setMessagesLoading(false);
    setMessages(mode === "runtime" ? [] : []);
  }, [botId, chatVisitorId, mode]);

  /** No saved threads: show welcome in widget after list has loaded. */
  useEffect(() => {
    if (mode !== "runtime") return;
    if (runtimeListLoading) return;
    if (recentChats.length !== 0) return;
    setIncludeWelcomeInMessages(true);
  }, [mode, runtimeListLoading, recentChats.length]);

  useEffect(() => {
    if (mode !== "preview" || !visitorMultiChatEnabled) return;
    const cid = conversationIdRef.current;
    if (!cid || messages.length < 2) return;
    try {
      const key = `assistrio_preview_msgs:${botId}:${previewVisitorStorageKey}:${cid}`;
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(key, JSON.stringify(messages));
      }
    } catch {
      /* ignore */
    }
  }, [messages, mode, visitorMultiChatEnabled, botId, previewVisitorStorageKey]);

  const handleSessionStartNew = useCallback(() => {
    conversationIdRef.current = null;
    pendingStartNewRef.current = true;
    setIncludeWelcomeInMessages(true);
    setMessages(welcomeMsg ? [welcomeMsg] : []);
  }, [welcomeMsg]);

  const handleSessionEnd = useCallback(() => {
    conversationIdRef.current = null;
    pendingStartNewRef.current = false;
    setIncludeWelcomeInMessages(true);
    setMessages(welcomeMsg ? [welcomeMsg] : []);
  }, [welcomeMsg]);

  const handleSelectRecent = useCallback(
    async (conversationId: string) => {
      if (!conversationId.trim()) return;
      conversationIdRef.current = conversationId;
      pendingStartNewRef.current = false;
      if (mode === "runtime") {
        setViewingConversationId(conversationId.trim());
        setMessagesLoading(true);
        setIncludeWelcomeInMessages(false);
        setMessages([]);
      }
      if (mode === "preview") {
        const key = `assistrio_preview_msgs:${botId}:${previewVisitorStorageKey}:${conversationId}`;
        try {
          const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(key) : null;
          if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed) && parsed.length > 0) {
              const mapped = parsed.filter(
                (m): m is ChatUIMessage =>
                  !!m &&
                  typeof m === "object" &&
                  (m as ChatUIMessage).role !== undefined &&
                  typeof (m as ChatUIMessage).content === "string",
              );
              if (mapped.length > 0) {
                setIncludeWelcomeInMessages(false);
                setMessages(mapped);
                return;
              }
            }
          }
        } catch {
          /* fall through */
        }
        setIncludeWelcomeInMessages(true);
        setMessages(welcomeMsg ? [welcomeMsg] : []);
        return;
      }
      const msgPath = "/api/chat/conversations/messages";
      const msgUrl = apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, "")}${msgPath}` : msgPath;
      const bodyWithoutKeys = {
        botId,
        conversationId,
        ...(runtimeEmbedOrigin ? { embedOrigin: runtimeEmbedOrigin } : {}),
        ...(chatVisitorId ? { chatVisitorId } : {}),
        ...(platformVisitorId ? { platformVisitorId } : {}),
      };
      try {
        const res = await runtimeEmbedPost(msgUrl, bodyWithoutKeys, { accessKey, secretKey });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          messages?: Array<{ role: string; content: string; createdAt: string }>;
        };
        if (!res.ok || !Array.isArray(data.messages)) {
          setIncludeWelcomeInMessages(true);
          setMessages(welcomeMsg ? [welcomeMsg] : []);
          return;
        }
        const mapped: ChatUIMessage[] = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: generateId(),
            role: m.role as "user" | "assistant",
            content: String(m.content ?? ""),
            createdAt: m.createdAt || isoNow(),
            status: "sent",
          }));
        if (mapped.length === 0) {
          setIncludeWelcomeInMessages(true);
          setMessages(welcomeMsg ? [welcomeMsg] : []);
          return;
        }
        setMessages(mapped);
      } catch {
        setIncludeWelcomeInMessages(true);
        setMessages(welcomeMsg ? [welcomeMsg] : []);
      } finally {
        if (mode === "runtime") {
          setMessagesLoading(false);
        }
      }
    },
    [
      mode,
      botId,
      apiBaseUrl,
      accessKey,
      secretKey,
      runtimeEmbedOrigin,
      chatVisitorId,
      platformVisitorId,
      welcomeMsg,
    ],
  );

  useEffect(() => {
    if (mode !== "runtime") return;
    if (didAutoRestoreConversationRef.current) return;
    if (!recentChats.length) return;
    didAutoRestoreConversationRef.current = true;
    void handleSelectRecent(recentChats[0].id);
  }, [mode, recentChats, handleSelectRecent]);

  const latestConversationId = useMemo(() => recentChats[0]?.id ?? null, [recentChats]);

  const conversationLoading = useMemo(
    () => (mode === "runtime" && runtimeListLoading) || messagesLoading,
    [mode, runtimeListLoading, messagesLoading],
  );

  const composerReadOnlyRuntime = useMemo(() => {
    if (mode !== "runtime" || visitorMultiChatEnabled) return false;
    if (!latestConversationId || !viewingConversationId) return false;
    return viewingConversationId !== latestConversationId;
  }, [mode, visitorMultiChatEnabled, latestConversationId, viewingConversationId]);

  const sessionAtCap = useMemo(() => {
    if (!visitorMultiChatEnabled) return false;
    if (visitorMultiChatMax === null || visitorMultiChatMax === undefined) return false;
    if (!Number.isFinite(visitorMultiChatMax) || visitorMultiChatMax <= 0) return false;
    return recentChats.length >= visitorMultiChatMax;
  }, [visitorMultiChatEnabled, visitorMultiChatMax, recentChats.length]);

  const runtimeSessionMenuVisible = useMemo(
    () => mode === "runtime" && (visitorMultiChatEnabled || recentChats.length > 0),
    [mode, visitorMultiChatEnabled, recentChats.length],
  );

  /** Preview keeps multi-chat menu when enabled; runtime adds single-thread history. */
  const embedSessionMenuVisible =
    mode === "preview" ? visitorMultiChatEnabled : runtimeSessionMenuVisible;

  const sessionStartNewDisabled = useMemo(() => {
    if (!visitorMultiChatEnabled) return false;
    if (visitorMultiChatMax === null || visitorMultiChatMax === undefined) return false;
    return recentChats.length >= visitorMultiChatMax;
  }, [visitorMultiChatEnabled, visitorMultiChatMax, recentChats.length]);

  const handleBackToWritableChat = useCallback(() => {
    if (!latestConversationId) return;
    void handleSelectRecent(latestConversationId);
  }, [latestConversationId, handleSelectRecent]);

  const subtitle =
    (tagline ?? "").trim() ||
    (description?.trim() ? truncateSubtitle(description, SUBTITLE_MAX_LENGTH) : "") ||
    "Live test";

  const ws = mergeWidgetStrings(widgetStrings);

  const executeSend = useCallback(
    async (value: string, userMessageId: string) => {
      try {
        const startNew = pendingStartNewRef.current;
        let res: Response;
        if (mode === "preview") {
          const bodyPayload = {
            botId,
            message: value,
            ...(startNew ? { startNewConversation: true as const } : {}),
            ...(!startNew && conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
            ...(accessKey ? { accessKey } : {}),
            ...(secretKey ? { secretKey } : {}),
            ...(chatVisitorId ? { chatVisitorId } : {}),
            ...(platformVisitorId ? { platformVisitorId } : {}),
            ...(authToken ? { authToken } : {}),
            ...(previewOverrides ? { previewOverrides } : {}),
          };
          res = await fetchWithNetworkRetry(
            () =>
              apiBaseUrl
                ? fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(bodyPayload),
                  })
                : apiFetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify(bodyPayload),
                  }),
            { retries: 2, delayMs: 400 },
          );
        } else {
          const bodyWithoutKeys = {
            botId,
            message: value,
            ...(startNew ? { startNewConversation: true as const } : {}),
            ...(!startNew && conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
            ...(runtimeEmbedOrigin ? { embedOrigin: runtimeEmbedOrigin } : {}),
            ...(chatVisitorId ? { chatVisitorId } : {}),
            ...(platformVisitorId ? { platformVisitorId } : {}),
          };
          res = await fetchWithNetworkRetry(
            () => runtimeEmbedPost(endpoint, bodyWithoutKeys, { accessKey, secretKey }),
            { retries: 2, delayMs: 400 },
          );
        }

        const data = (await res.json().catch(() => ({}))) as SuperAdminChatResponse;

        const content =
          data.assistantMessage ??
          data.reply ??
          data.content ??
          getRuntimeErrorMessage(data, visitorMultiChatMax);
        pendingStartNewRef.current = false;
        if (data.conversationId) {
          conversationIdRef.current = data.conversationId;
          if (mode === "runtime") {
            setViewingConversationId(data.conversationId);
          }
        }
        if (res.ok && data.conversationId && visitorMultiChatEnabled) {
          if (mode === "preview") {
            const rows = readPreviewRecent();
            const entry: RecentRow = {
              id: data.conversationId,
              preview: value.slice(0, 80),
              lastActivityAt: isoNow(),
            };
            const next = [entry, ...rows.filter((x) => x.id !== entry.id)].slice(0, 25);
            writePreviewRecent(next);
            setRecentChats(next);
          } else {
            void refreshRuntimeRecent();
          }
        } else if (res.ok && data.conversationId && mode === "runtime" && !visitorMultiChatEnabled) {
          void refreshRuntimeRecent();
        }

        const assistantMsg: ChatUIMessage = {
          id: generateId(),
          role: "assistant",
          content: typeof content === "string" ? content : "No response.",
          createdAt: isoNow(),
          sources: mapSources(data.sources),
          status: res.ok ? "sent" : "error",
        };
        setMessages((prev) => {
          const withUser = prev.map((m) =>
            m.id === userMessageId ? { ...m, status: res.ok ? ("sent" as const) : ("error" as const) } : m,
          );
          return [...withUser, assistantMsg];
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessageId ? { ...m, status: "error" as const } : m)),
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      endpoint,
      apiBaseUrl,
      accessKey,
      mode,
      botId,
      secretKey,
      runtimeEmbedOrigin,
      chatVisitorId,
      platformVisitorId,
      authToken,
      previewOverrides,
      visitorMultiChatEnabled,
      visitorMultiChatMax,
      readPreviewRecent,
      writePreviewRecent,
      refreshRuntimeRecent,
    ],
  );

  const onSend = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || isSending) return;
      if (composerReadOnlyRuntime) return;

      const userMessageId = generateId();
      const userMsg: ChatUIMessage = {
        id: userMessageId,
        role: "user",
        content: value,
        createdAt: isoNow(),
        status: "sending",
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);
      await executeSend(value, userMessageId);
    },
    [isSending, composerReadOnlyRuntime, executeSend],
  );

  const handleRetryMessage = useCallback(
    (messageId: string) => {
      let payload = "";
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx < 0) return prev;
        const msg = prev[idx];
        if (msg.role !== "user" || msg.status !== "error") return prev;
        payload = msg.content;
        return prev.slice(0, idx + 1).map((m, i) =>
          i === idx ? { ...m, status: "sending" as const } : m,
        );
      });
      const trimmed = payload.trim();
      if (!trimmed) return;
      setIsSending(true);
      void executeSend(trimmed, messageId);
    },
    [executeSend],
  );

  const brandingLine = (chatUI?.brandingMessage ?? "").trim();
  const privacyLineRaw =
    (chatUI?.privacyText ?? "").trim() || (footerPrivacyText ?? "").trim();
  const showBrandingLine = chatUI?.showBranding !== false && Boolean(brandingLine);
  const showPrivacyLine = chatUI?.showPrivacyText !== false && Boolean(privacyLineRaw);
  const brandingMessageResolved = showBrandingLine ? brandingLine : undefined;
  const privacyTextResolved = showPrivacyLine ? privacyLineRaw : undefined;
  const showFooterResolved = showBrandingLine || showPrivacyLine;

  const launcherPosition =
    chatUI?.launcherPosition === "bottom-left" ? "bottom-left" : "bottom-right";

  const avatarNode =
    chatUI?.showAvatarInHeader !== false
      ? avatarUrl?.trim()
        ? (
          <img src={avatarUrl.trim()} alt="" className="w-full h-full object-cover" />
        )
        : avatarEmoji?.trim()
          ? (
            <span className="text-2xl" aria-hidden>
              {avatarEmoji.trim()}
            </span>
          )
          : (
            <Bot
              className={cx("w-6 h-6 flex-shrink-0", dark ? "text-gray-400" : "text-gray-500")}
              aria-hidden
              strokeWidth={1.75}
            />
          )
      : undefined;

  const menuExpanded = useFloatingLauncher ? floatingPanelExpanded : expanded;

  const chatShared = {
    width: "100%" as const,
    height: "100%" as const,
    dark,
    accentColor: primaryColor,
    bubbleBorderRadius,
    showChatBorder: chatUI?.showChatBorder !== false,
    chatPanelBorderWidth: chatPanelBorderWidthFromChatUI(chatUI),
    shadowIntensity:
      chatUI?.shadowIntensity === "none" ||
        chatUI?.shadowIntensity === "low" ||
        chatUI?.shadowIntensity === "medium" ||
        chatUI?.shadowIntensity === "high"
        ? chatUI.shadowIntensity
        : ("medium" as const),
    showHeader: true,
    showAvatarInHeader: chatUI?.showAvatarInHeader !== false,
    showFooter: showFooterResolved,
    brandingMessage: brandingMessageResolved,
    privacyText: privacyTextResolved,
    statusIndicator: chatUI?.statusIndicator ?? "none",
    liveIndicatorStyle: chatUI?.liveIndicatorStyle ?? "label",
    statusDotStyle: chatUI?.statusDotStyle ?? "blinking",
    showScrollToBottom: chatUI?.showScrollToBottom !== false,
    showScrollToBottomLabel: chatUI?.showScrollToBottomLabel !== false,
    scrollToBottomLabel: (chatUI?.scrollToBottomLabel ?? "").trim() || undefined,
    showScrollbar: chatUI?.showScrollbar !== false,
    composerAsSeparateBox: chatUI?.composerAsSeparateBox !== false,
    composerBorderWidth: composerBorderWidthFromChatUI(chatUI),
    composerBorderColor: chatUI?.composerBorderColor === "default" ? "default" as const : "primary" as const,
    showSuggestedChips: Boolean(suggestedQuestions?.length),
    suggestedQuestions,
    showComposerWithSuggestedQuestions: chatUI?.showComposerWithSuggestedQuestions === true,
    onBack: onBack ?? (() => { }),
    onMenu,
    showMenuExpand: chatUI?.showMenuExpand !== false,
    onMenuExpand: useFloatingLauncher
      ? () => setFloatingPanelExpanded((e) => !e)
      : () => setExpanded((e) => !e),
    isExpanded: menuExpanded,
    menuQuickLinks: chatUI?.menuQuickLinks?.length ? chatUI.menuQuickLinks : undefined,
    showMenuQuickLinks: chatUI?.showMenuQuickLinks !== false,
    quickLinksMenuIcon: chatUI?.menuQuickLinksMenuIcon,
    showSessionMenu: embedSessionMenuVisible,
    showSessionStartNew:
      mode === "preview" ? visitorMultiChatEnabled : visitorMultiChatEnabled && !sessionAtCap,
    showSessionEndChat:
      mode === "preview" ? visitorMultiChatEnabled : visitorMultiChatEnabled && !sessionAtCap,
    showSessionRecentChats:
      mode === "preview"
        ? visitorMultiChatEnabled
        : visitorMultiChatEnabled || recentChats.length > 0,
    sessionHistoryEnabled: embedSessionMenuVisible,
    onSessionStartNewChat: handleSessionStartNew,
    onSessionEndChat: handleSessionEnd,
    sessionStartNewDisabled,
    sessionRecentChats: embedSessionMenuVisible ? recentChats : undefined,
    onSessionSelectRecentChat: handleSelectRecent,
    composerReadOnly: composerReadOnlyRuntime,
    readOnlyNotice:
      composerReadOnlyRuntime
        ? "You're viewing an older conversation. Only your latest chat can receive new messages."
        : undefined,
    onBackToWritableChat: composerReadOnlyRuntime && latestConversationId ? handleBackToWritableChat : undefined,
    onClose: onClose ?? (() => { }),
    avatar: avatarNode,
    title: botName,
    subtitle,
    messages,
    isSending,
    conversationLoading,
    onSend,
    onRetryMessage: handleRetryMessage,
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
      scrollToBottomLabel: (chatUI?.scrollToBottomLabel ?? "").trim() || "Scroll to latest",
      back: "Back",
      close: "Close",
      menu: "Menu",
      live: "Live",
      active: "Active",
      expandLabel: menuExpanded ? "Collapse" : "Expand chat",
      chatDialogLabel: ws.chatDialogLabel,
      messageSendFailed: ws.messageSendFailed,
      retrySend: ws.retrySend,
      typingStatusLabel: ws.someoneTyping,
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
        defaultOpen={chatUI?.openChatOnLoad !== false}
        launcherSize={launcherBubble.size}
        launcherShadowIntensity={launcherBubble.shadowIntensity}
        launcherAvatar={launcherBubble.avatar}
        launcherAvatarWithBackground={launcherBubble.avatarWithBackground}
        launcherAvatarRingWidth={launcherBubble.avatarRingWidth}
        launcherWhenOpen={launcherBubble.launcherWhenOpen}
        panelOpenAnimation={chatUI?.chatOpenAnimation ?? "slide-up-fade"}
        width={floatingPanelExpanded ? 560 : 400}
        height={floatingPanelExpanded ? "75vh" : 700}
        accentColor={primaryColor}
        dark={dark}
        onClose={onClose}
        dialogAriaLabel={ws.chatDialogLabel}
        className={className}
        style={style}
      />
    );
  }

  return (
    <div
      className={cx("assistrio-chat-widget overflow-hidden", className)}
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
      />
    </div>
  );
}
