import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot } from "lucide-react";

import { usePreferredColorScheme } from "../hooks/usePreferredColorScheme";
import { Chat, ChatWithLauncher } from "./chat-ui";
import type { ChatUIMessage, ChatUISource } from "./chat-ui";
import type { ChatSpeechInputMeta } from "./chat-ui/types";
import { mapSources } from "./chat-ui";
import { ContainedLauncherPreview } from "./ContainedLauncherPreview";
import { cx } from "./chat-ui/utils";
import { useChatPanelBox } from "../hooks/useChatPanelLayout";
import {
  PANEL_COLLAPSED_HEIGHT_PX,
  PANEL_COLLAPSED_WIDTH_PX,
  PANEL_EXPANDED_WIDTH_PX,
} from "../lib/embedPanelConstraints";
import { containedLauncherPreviewBottomOutsetPx } from "../lib/embedPanelConstraints";
import { launcherBubbleFromChatUI } from "../lib/launcherBubbleFromChatUI";
import { apiFetch } from "../lib/apiFetch";
import { fetchWithNetworkRetry } from "../lib/fetchWithRetry";
import { runtimeEmbedPost } from "../lib/runtimeEmbedPost";
import { buildPlaygroundPreviewConversationOrigin } from "../lib/playgroundPreviewConversationOrigin";
import { buildRuntimeWidgetConversationOrigin } from "../lib/runtimeWidgetConversationOrigin";
import { buildClientAnalyticsContext } from "../lib/clientAnalyticsContext";
import { buildWidgetMessageAnalytics } from "../lib/widgetMessageAnalytics";
import { runtimeEmbedMultipartPost } from "../lib/runtimeEmbedMultipartPost";
import { runtimeEmbedSpeechPost } from "../lib/runtimeEmbedSpeechPost";
import { speechEndpointFromChatUrl } from "../lib/speechEndpoint";
import { createTranscriptionUploadFile } from "../lib/transcriptionUploadFile";
import { sanitizeChatMessageContent } from "../lib/chatMessageDisplay.util";
import { resolveBrandingFooterDisplay } from "../lib/resolveBrandingFooterDisplay";
import { resolveChatRuntimeErrorMessage } from "../lib/resolveChatRuntimeErrorMessage";
import { streamAssistantReply } from "../lib/streamAssistantReply";
import { mergeWidgetStrings, type WidgetStrings } from "../lib/widgetStrings";
import { resolveWelcomeMessage } from "../lib/welcomeMessage";
import { resolveComposerControlStyle, resolveSpeechRecordingWaveStyle } from "../lib/resolveComposerChatUiStyles";
import type { BotChatUI, ScrollChromeStyle, UserBubbleStyle } from "../models/botChatUI";
import type { SuggestedQuestionChip, WidgetPreviewOverrides } from "../types";

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Prefer Mongo assistant message id from chat response when present (24-hex ObjectId). */
function resolveAssistantClientMessageId(serverAssistantMessageId: unknown): string {
  if (typeof serverAssistantMessageId === "string") {
    const t = serverAssistantMessageId.trim();
    if (/^[a-fA-F0-9]{24}$/.test(t)) return t;
  }
  return generateId();
}

/** Persisted Mongo Message._id from embed/history APIs (24-hex). */
function resolvePersistedEmbedHistoryMessageId(serverMessageId: unknown): string {
  if (typeof serverMessageId === "string") {
    const t = serverMessageId.trim();
    if (/^[a-fA-F0-9]{24}$/.test(t)) return t;
  }
  return generateId();
}

function isoNow(): string {
  return new Date().toISOString();
}

/** Wipes preview multichat sessionStorage for this bot+visitor so a full page reload does not restore prior threads. */
function clearPreviewThreadSessionStorage(botId: string, previewVisitorStorageKey: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const msgPrefix = `assistrio_preview_msgs:${botId}:${previewVisitorStorageKey}:`;
    const recentKey = `assistrio_preview_recent:${botId}:${previewVisitorStorageKey}`;
    window.sessionStorage.removeItem(recentKey);
    const toRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const k = window.sessionStorage.key(i);
      if (k && k.startsWith(msgPrefix)) toRemove.push(k);
    }
    for (const k of toRemove) {
      window.sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function mapUserBubbleStyle(raw: string | undefined): UserBubbleStyle {
  if (raw === "default") return "default";
  if (raw === "defaultDark") return "defaultDark";
  return "primary";
}

function resolveScrollChromeStyle(chatUI: BotChatUI | undefined | null): ScrollChromeStyle {
  const s = chatUI?.scrollChromeStyle;
  if (s === "default" || s === "defaultDark" || s === "primary") return s;
  /** @deprecated stored value */
  if (s === "gray") return "defaultDark";
  return chatUI?.scrollChromeUsesPrimary === false ? "default" : "primary";
}

function resolveScrollToBottomChromeStyle(chatUI: BotChatUI | undefined | null): ScrollChromeStyle {
  const s = chatUI?.scrollToBottomChromeStyle;
  if (s === "default" || s === "defaultDark" || s === "primary") return s;
  if (s === "gray") return "defaultDark";
  return resolveScrollChromeStyle(chatUI);
}

function resolveScrollToBottomAlign(chatUI: BotChatUI | undefined | null): "left" | "center" | "right" {
  const s = chatUI?.scrollToBottomAlign;
  if (s === "left" || s === "right") return s;
  return "center";
}

const SUBTITLE_MAX_LENGTH = 80;

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
  assistantMessageId?: string;
  reply?: string;
  content?: string;
  sources?: ChatUISource[];
  conversationId?: string;
  error?: string;
  errorCode?: string;
  message?: string;
  debug?: SuperAdminChatDebug;
  userAttachments?: Array<{ name: string; mimeType: string; url: string; size?: number }>;
}

function truncateSubtitle(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length > maxLen) return t;
  return t.slice(0, maxLen).trimEnd().replace(/\s+\S*$/, "") + "…";
}

/** Map embed API `messages` (runtime or preview) to `ChatUIMessage` for display parity with the DB. */
function mapEmbedApiRowsToChatUIMessages(
  rows: Array<{
    id?: string;
    role: string;
    content: string;
    createdAt: string;
    speechInput?: ChatSpeechInputMeta;
    attachments?: Array<{ name: string; mimeType: string; url: string; size?: number }>;
    feedback?: { rating?: string } | null;
  }>,
): ChatUIMessage[] {
  const keepAttachment = (a: { name: string; mimeType: string; url: string; size?: number }) =>
    Boolean(
      String(a.name ?? "").trim() ||
        String(a.mimeType ?? "").trim() ||
        (typeof a.size === "number" && Number.isFinite(a.size)),
    );
  return rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const fr = m.feedback?.rating;
      const feedbackRating = fr === "up" || fr === "down" ? fr : undefined;
      return {
        id: resolvePersistedEmbedHistoryMessageId(m.id),
        role: m.role as "user" | "assistant",
        content: sanitizeChatMessageContent(m.role as "user" | "assistant", String(m.content ?? "")),
        createdAt: m.createdAt || isoNow(),
        status: "sent" as const,
        ...(feedbackRating ? { feedbackRating } : {}),
        ...(m.speechInput?.mode === "voice" || m.speechInput?.mode === "dictate"
          ? {
              speechInput: {
                mode: m.speechInput.mode,
                ...(m.speechInput.transcript ? { transcript: m.speechInput.transcript } : {}),
                ...(m.speechInput.audioUrl ? { audioUrl: m.speechInput.audioUrl } : {}),
                ...(m.speechInput.mimeType ? { mimeType: m.speechInput.mimeType } : {}),
                ...(m.speechInput.durationMs != null ? { durationMs: m.speechInput.durationMs } : {}),
              },
            }
          : {}),
        ...(Array.isArray(m.attachments) && m.attachments.length > 0
          ? {
              attachments: m.attachments
                .map((a) => ({
                  name: String(a.name ?? ""),
                  mimeType: String(a.mimeType ?? "application/octet-stream"),
                  url: String(a.url ?? ""),
                  ...(typeof a.size === "number" && Number.isFinite(a.size) ? { size: a.size } : {}),
                }))
                .filter(keepAttachment),
            }
          : {}),
      };
    });
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
  /** From widget init: labels + optional KB ids for suggestion-scoped first reply. */
  suggestedQuestionChips?: SuggestedQuestionChip[];
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
  /** Chat/session identity only — threads, history, embed cookie binding. */
  chatVisitorId: string;
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
  /** Non-floating inline panel sizes (defaults 404×730 collapsed, 560×~85vh expanded, clamped). */
  inlinePanelCollapsedWidth?: number;
  inlinePanelCollapsedHeight?: number;
  inlinePanelExpandedWidth?: number;
  inlinePanelExpandedHeight?: number | string;
  /**
   * When `useFloatingLauncher` is false: show a non-interactive launcher bubble pinned to the widget stage
   * (requires `EmbedChatConfig.showContainedLauncherPreview` from the host).
   */
  showContainedLauncherPreview?: boolean;
  onContainedPanelExpandChange?: (expanded: boolean) => void;
  /**
   * Preview init may omit this; the first `chat` response supplies `conversationId` once the user
   * sends a message (no server thread until then).
   */
  serverConversationIdFromInit?: string;
  /** Admin preview: sent as `previewContext.sourcePage` on each chat message. */
  previewSourcePage?: string;
  /** Dashboard preview: isolates sessionStorage thread keys per workspace section. */
  previewVisitorScope?: string;
  /**
   * Runtime channel: default script embed (`/api/chat/*`). `shared` and `iframe` use alternate public routes.
   */
  runtimeSurface?: "embed" | "shared" | "iframe";
  /** Required when `runtimeSurface === "shared"`. */
  sharedSlug?: string;
  /** Optional preview token for draft share links (`?shareToken=`). */
  sharePreviewToken?: string;
  /** Parent site origin — required when `runtimeSurface === "iframe"` (validated server-side). */
  iframeParentOrigin?: string;
  /** Parent page URL when embedder passes `parentPageUrl` on the iframe src (cross-origin safe). */
  iframeParentPageUrl?: string;
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
  suggestedQuestionChips,
  onClose,
  onBack,
  onMenu,
  expandHref,
  apiBaseUrl,
  chatPostPath,
  accessKey,
  secretKey,
  chatVisitorId,
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
  inlinePanelCollapsedWidth,
  inlinePanelCollapsedHeight,
  inlinePanelExpandedWidth,
  inlinePanelExpandedHeight,
  showContainedLauncherPreview = false,
  onContainedPanelExpandChange,
  serverConversationIdFromInit,
  previewSourcePage,
  previewVisitorScope,
  runtimeSurface = "embed",
  sharedSlug,
  sharePreviewToken,
  iframeParentOrigin,
  iframeParentPageUrl,
}: AdminLiveChatAdapterProps) {
  void expandHref;
  void debug;

  const previewScopeSuffix =
    mode === "preview" && previewVisitorScope?.trim() ? `:${previewVisitorScope.trim()}` : "";

  /** SessionStorage segment when `chatVisitorId` is empty (authenticated preview; server derives identity). */
  const previewVisitorStorageKey =
    mode === "preview" ? `${chatVisitorId.trim() || "auth"}${previewScopeSuffix}` : chatVisitorId;

  const runtimeMessagePath = useMemo(() => {
    if (runtimeSurface === "shared") {
      const slug = (sharedSlug ?? "").trim();
      return slug ? `/api/shared/bots/${encodeURIComponent(slug)}/chat` : "/api/chat/message";
    }
    if (runtimeSurface === "iframe") {
      return "/api/widget/iframe/chat";
    }
    return "/api/chat/message";
  }, [runtimeSurface, sharedSlug]);

  const chatPath =
    chatPostPath ?? (mode === "preview" ? "/api/widget/preview/chat" : runtimeMessagePath);
  const endpoint = apiBaseUrl
    ? `${apiBaseUrl.replace(/\/+$/, "")}${chatPath}`
    : chatPath;
  const speechEndpointUrl = useMemo(() => speechEndpointFromChatUrl(endpoint), [endpoint]);
  const conversationIdRef = useRef<string | null>(null);
  const pendingStartNewRef = useRef(false);
  const previewHydrationKeyRef = useRef(0);
  const containedStageRef = useRef<HTMLDivElement | null>(null);
  /** One-time restore of latest thread on runtime load (always for runtime so single-thread embeds load history). */
  const didAutoRestoreConversationRef = useRef(false);
  /** Active conversation id for UI (writable vs read-only in single-thread mode). */
  const [viewingConversationId, setViewingConversationId] = useState<string | null>(null);
  const runtimeEmbedOrigin =
    mode === "runtime" && runtimeSurface === "embed" && typeof window !== "undefined"
      ? window.location.origin
      : undefined;

  const iframeContextPayload = useMemo(() => {
    if (runtimeSurface !== "iframe" || typeof window === "undefined") {
      return { parentOrigin: "", parentPageUrl: "", iframeUrl: "", referrer: "" };
    }
    const parent = (iframeParentOrigin ?? "").trim();
    const parentPage = (iframeParentPageUrl ?? "").trim().slice(0, 2048);
    return {
      parentOrigin: parent,
      parentPageUrl: parentPage,
      iframeUrl: window.location.href.slice(0, 2048),
      referrer: (document.referrer || "").slice(0, 2048),
    };
  }, [runtimeSurface, iframeParentOrigin, iframeParentPageUrl]);

  const sharedContextPayload = useMemo(() => {
    if (runtimeSurface !== "shared" || typeof window === "undefined") {
      return { shareToken: "", pageUrl: "", referrer: "", origin: "" };
    }
    return {
      shareToken: (sharePreviewToken ?? "").trim(),
      pageUrl: window.location.href.slice(0, 2048),
      referrer: (document.referrer || "").slice(0, 2048),
      origin: window.location.origin.slice(0, 256),
    };
  }, [runtimeSurface, sharePreviewToken]);

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

  const welcomeMsgRef = useRef(welcomeMsg);
  welcomeMsgRef.current = welcomeMsg;

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
  const { primaryColor, dark, bubbleBorderRadius } = resolveChatUI(chatUI, preferredScheme);
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
    const base = apiBaseUrl ? apiBaseUrl.replace(/\/+$/, "") : "";
    let listUrl: string;
    let bodyWithoutKeys: Record<string, unknown>;
    if (runtimeSurface === "shared") {
      const slug = (sharedSlug ?? "").trim();
      if (!slug) return;
      const listPath = `/api/shared/bots/${encodeURIComponent(slug)}/conversations/list`;
      listUrl = base ? `${base}${listPath}` : listPath;
      bodyWithoutKeys = {
        ...(chatVisitorId ? { chatVisitorId } : {}),
        ...(sharedContextPayload.shareToken ? { shareToken: sharedContextPayload.shareToken } : {}),
        ...(sharedContextPayload.pageUrl ? { pageUrl: sharedContextPayload.pageUrl } : {}),
        ...(sharedContextPayload.referrer ? { referrer: sharedContextPayload.referrer } : {}),
        ...(sharedContextPayload.origin ? { origin: sharedContextPayload.origin } : {}),
      };
    } else if (runtimeSurface === "iframe") {
      const listPath = "/api/widget/iframe/conversations/list";
      listUrl = base ? `${base}${listPath}` : listPath;
      bodyWithoutKeys = {
        botId,
        parentOrigin: iframeContextPayload.parentOrigin,
        ...(iframeContextPayload.parentPageUrl
          ? { parentPageUrl: iframeContextPayload.parentPageUrl }
          : {}),
        pageUrl: iframeContextPayload.iframeUrl,
        referrer: iframeContextPayload.referrer,
        ...(chatVisitorId ? { chatVisitorId } : {}),
      };
    } else {
      const listPath = "/api/chat/conversations/list";
      listUrl = base ? `${base}${listPath}` : listPath;
      const conversationOrigin =
        mode === "runtime" && runtimeSurface === "embed" ? buildRuntimeWidgetConversationOrigin() : undefined;
      bodyWithoutKeys = {
        botId,
        ...(runtimeEmbedOrigin ? { embedOrigin: runtimeEmbedOrigin } : {}),
        ...(conversationOrigin ? { conversationOrigin } : {}),
        ...(chatVisitorId ? { chatVisitorId } : {}),
      };
    }
    try {
      const res =
        runtimeSurface === "shared"
          ? await fetch(listUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(bodyWithoutKeys),
            })
          : await runtimeEmbedPost(listUrl, bodyWithoutKeys, { accessKey, secretKey });
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
  }, [
    mode,
    botId,
    apiBaseUrl,
    accessKey,
    secretKey,
    runtimeEmbedOrigin,
    chatVisitorId,
    runtimeSurface,
    sharedSlug,
    sharedContextPayload.shareToken,
    sharedContextPayload.pageUrl,
    sharedContextPayload.referrer,
    sharedContextPayload.origin,
    iframeContextPayload.parentOrigin,
    iframeContextPayload.iframeUrl,
    iframeContextPayload.referrer,
  ]);

  const fetchPreviewMessagesFromApi = useCallback(
    async (forConversationId: string): Promise<ChatUIMessage[] | null> => {
      const cid = forConversationId.trim();
      const vid = (chatVisitorId ?? "").trim();
      if (!cid || !vid || !apiBaseUrl?.trim()) return null;
      const url = `${apiBaseUrl.replace(/\/+$/, "")}/api/widget/preview/conversations/messages`;
      const res = await fetchWithNetworkRetry(
        () =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              botId,
              conversationId: cid,
              chatVisitorId: vid,
              ...(authToken ? { authToken } : {}),
            }),
          }),
        { retries: 2, delayMs: 400 },
      );
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; messages?: unknown[] };
      if (!res.ok || !Array.isArray(data.messages) || data.messages.length === 0) return null;
      const mapped = mapEmbedApiRowsToChatUIMessages(
        data.messages as Parameters<typeof mapEmbedApiRowsToChatUIMessages>[0],
      );
      return mapped.length > 0 ? mapped : null;
    },
    [apiBaseUrl, botId, chatVisitorId, authToken],
  );

  useEffect(() => {
    if (mode === "preview") {
      // Preview: do not restore assistrio_preview_* from sessionStorage on load; identity reset effect clears it.
      return;
    }
    void refreshRuntimeRecent();
  }, [visitorMultiChatEnabled, mode, refreshRuntimeRecent]);

  useEffect(() => {
    didAutoRestoreConversationRef.current = false;
    setViewingConversationId(null);
    setIncludeWelcomeInMessages(mode !== "runtime");
    setRuntimeListLoading(mode === "runtime");
    setMessagesLoading(false);
    if (mode === "preview") {
      clearPreviewThreadSessionStorage(botId, previewVisitorStorageKey);
      setRecentChats([]);
      const initCid = (serverConversationIdFromInit ?? "").trim();
      if (initCid) {
        conversationIdRef.current = initCid;
        pendingStartNewRef.current = false;
      } else {
        conversationIdRef.current = null;
        pendingStartNewRef.current = true;
      }
      setMessages(welcomeMsg ? [welcomeMsg] : []);
    } else {
      setMessages([]);
    }
  }, [botId, chatVisitorId, mode, welcomeMsg, previewVisitorStorageKey, serverConversationIdFromInit]);

  /** After preview `init`, load the thread from the API so the UI matches Mongo. Draft welcome (ref) is fallback if API is empty. */
  useEffect(() => {
    if (mode !== "preview") return;
    const cid = (serverConversationIdFromInit ?? "").trim();
    const vid = (chatVisitorId ?? "").trim();
    if (!cid || !vid || !apiBaseUrl?.trim()) return;
    const seq = (previewHydrationKeyRef.current += 1);
    setMessagesLoading(true);
    void (async () => {
      const mapped = await fetchPreviewMessagesFromApi(cid);
      if (seq !== previewHydrationKeyRef.current) return;
      if (mapped && mapped.length > 0) {
        setIncludeWelcomeInMessages(false);
        setMessages(mapped);
      } else {
        const w = welcomeMsgRef.current;
        setIncludeWelcomeInMessages(true);
        setMessages(w ? [w] : []);
      }
      setMessagesLoading(false);
    })();
  }, [mode, serverConversationIdFromInit, chatVisitorId, apiBaseUrl, fetchPreviewMessagesFromApi]);

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
      const base = apiBaseUrl ? apiBaseUrl.replace(/\/+$/, "") : "";
      let msgUrl: string;
      let bodyWithoutKeys: Record<string, unknown>;
      if (runtimeSurface === "shared") {
        const slug = (sharedSlug ?? "").trim();
        if (!slug) return;
        const msgPath = `/api/shared/bots/${encodeURIComponent(slug)}/conversations/messages`;
        msgUrl = base ? `${base}${msgPath}` : msgPath;
        bodyWithoutKeys = {
          conversationId,
          ...(chatVisitorId ? { chatVisitorId } : {}),
          ...(sharedContextPayload.shareToken ? { shareToken: sharedContextPayload.shareToken } : {}),
          ...(sharedContextPayload.pageUrl ? { pageUrl: sharedContextPayload.pageUrl } : {}),
          ...(sharedContextPayload.referrer ? { referrer: sharedContextPayload.referrer } : {}),
          ...(sharedContextPayload.origin ? { origin: sharedContextPayload.origin } : {}),
        };
      } else if (runtimeSurface === "iframe") {
        const msgPath = "/api/widget/iframe/conversations/messages";
        msgUrl = base ? `${base}${msgPath}` : msgPath;
        bodyWithoutKeys = {
          botId,
          conversationId,
          parentOrigin: iframeContextPayload.parentOrigin,
          ...(iframeContextPayload.parentPageUrl
            ? { parentPageUrl: iframeContextPayload.parentPageUrl }
            : {}),
          pageUrl: iframeContextPayload.iframeUrl,
          referrer: iframeContextPayload.referrer,
          ...(chatVisitorId ? { chatVisitorId } : {}),
        };
      } else {
        const msgPath = "/api/chat/conversations/messages";
        msgUrl = base ? `${base}${msgPath}` : msgPath;
        const conversationOrigin =
          mode === "runtime" && runtimeSurface === "embed" ? buildRuntimeWidgetConversationOrigin() : undefined;
        bodyWithoutKeys = {
          botId,
          conversationId,
          ...(runtimeEmbedOrigin ? { embedOrigin: runtimeEmbedOrigin } : {}),
          ...(conversationOrigin ? { conversationOrigin } : {}),
          ...(chatVisitorId ? { chatVisitorId } : {}),
        };
      }
      try {
        const res =
          runtimeSurface === "shared"
            ? await fetch(msgUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyWithoutKeys),
              })
            : await runtimeEmbedPost(msgUrl, bodyWithoutKeys, { accessKey, secretKey });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          messages?: Parameters<typeof mapEmbedApiRowsToChatUIMessages>[0];
        };
        if (!res.ok || !Array.isArray(data.messages)) {
          setIncludeWelcomeInMessages(true);
          setMessages(welcomeMsg ? [welcomeMsg] : []);
          return;
        }
        const mapped = mapEmbedApiRowsToChatUIMessages(data.messages);
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
      welcomeMsg,
      runtimeSurface,
      sharedSlug,
      sharedContextPayload.shareToken,
      sharedContextPayload.pageUrl,
      sharedContextPayload.referrer,
      sharedContextPayload.origin,
      iframeContextPayload.parentOrigin,
      iframeContextPayload.iframeUrl,
      iframeContextPayload.referrer,
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

  const speechClientEnabled = useMemo(() => {
    if (!(apiBaseUrl ?? "").trim()) return false;
    const mic = chatUI?.showMic === true;
    const voice = typeof chatUI?.showVoice === "boolean" ? chatUI.showVoice === true : mic;
    return mic || voice;
  }, [apiBaseUrl, chatUI?.showMic, chatUI?.showVoice]);

  const executeSend = useCallback(
    async (
      value: string,
      userMessageId: string,
      speechInput?: ChatSpeechInputMeta,
      files?: File[],
      sendOptions?: { suggestionId?: string; dictationSessionCount?: number },
    ) => {
      try {
        const startNew = pendingStartNewRef.current;
        const speechPayload =
          speechInput == null
            ? {}
            : {
                speechInput: {
                  mode: speechInput.mode,
                  ...(speechInput.transcript ? { transcript: speechInput.transcript } : {}),
                  ...(speechInput.audioUrl ? { audioUrl: speechInput.audioUrl } : {}),
                  ...(speechInput.mimeType ? { mimeType: speechInput.mimeType } : {}),
                  ...(speechInput.durationMs != null ? { durationMs: speechInput.durationMs } : {}),
                },
              };
        const fileList = files?.length ? files : [];
        const sp = (previewSourcePage ?? "").trim();
        const previewConversationOrigin =
          mode === "preview" ? buildPlaygroundPreviewConversationOrigin(sp || undefined) : undefined;
        const clientAc = buildClientAnalyticsContext();
        const analyticsOptional =
          clientAc && (clientAc.location || clientAc.deviceInfo) ? { analyticsContext: clientAc } : {};
        const messageAnalyticsPayload = buildWidgetMessageAnalytics({
          speechInput,
          files: fileList.length ? fileList : undefined,
          suggestionId: sendOptions?.suggestionId,
          messageText: value,
          dictationSessionCount: sendOptions?.dictationSessionCount,
        });
        const messageAnalyticsOptional = { messageAnalytics: messageAnalyticsPayload };
        const bodyPayload = {
          botId,
          message: value,
          ...(startNew ? { startNewConversation: true as const } : {}),
          ...(!startNew && conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
          ...(accessKey ? { accessKey } : {}),
          ...(secretKey ? { secretKey } : {}),
          ...(chatVisitorId ? { chatVisitorId } : {}),
          ...(authToken ? { authToken } : {}),
          ...(previewOverrides ? { previewOverrides } : {}),
          ...(mode === "preview" && sp ? { previewContext: { sourcePage: sp } } : {}),
          ...(previewConversationOrigin ? { conversationOrigin: previewConversationOrigin } : {}),
          ...(sendOptions?.suggestionId ? { suggestionId: sendOptions.suggestionId } : {}),
          ...speechPayload,
          ...analyticsOptional,
          ...messageAnalyticsOptional,
        };
        const bodyCore = {
          message: value,
          ...(startNew ? { startNewConversation: true as const } : {}),
          ...(!startNew && conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
          ...(chatVisitorId ? { chatVisitorId } : {}),
          ...(sendOptions?.suggestionId ? { suggestionId: sendOptions.suggestionId } : {}),
          ...speechPayload,
          ...analyticsOptional,
          ...messageAnalyticsOptional,
        };
        let bodyWithoutKeys: Record<string, unknown>;
        if (mode === "runtime" && runtimeSurface === "shared") {
          bodyWithoutKeys = {
            ...bodyCore,
            ...(sharedContextPayload.shareToken ? { shareToken: sharedContextPayload.shareToken } : {}),
            ...(sharedContextPayload.pageUrl ? { pageUrl: sharedContextPayload.pageUrl } : {}),
            ...(sharedContextPayload.referrer ? { referrer: sharedContextPayload.referrer } : {}),
            ...(sharedContextPayload.origin ? { origin: sharedContextPayload.origin } : {}),
          };
        } else if (mode === "runtime" && runtimeSurface === "iframe") {
          bodyWithoutKeys = {
            botId,
            ...bodyCore,
            parentOrigin: iframeContextPayload.parentOrigin,
            ...(iframeContextPayload.parentPageUrl
              ? { parentPageUrl: iframeContextPayload.parentPageUrl }
              : {}),
            pageUrl: iframeContextPayload.iframeUrl,
            referrer: iframeContextPayload.referrer,
          };
        } else {
          const conversationOrigin =
            mode === "runtime" && runtimeSurface === "embed" ? buildRuntimeWidgetConversationOrigin() : undefined;
          bodyWithoutKeys = {
            botId,
            ...bodyCore,
            ...(runtimeEmbedOrigin ? { embedOrigin: runtimeEmbedOrigin } : {}),
            ...(conversationOrigin ? { conversationOrigin } : {}),
          };
        }
        const buildMultipart = (payload: Record<string, unknown>, includeKeys: boolean): FormData => {
          const fd = new FormData();
          fd.append("payload", JSON.stringify(payload));
          for (const f of fileList) fd.append("file", f, f.name);
          if (includeKeys) {
            if (accessKey) fd.append("accessKey", accessKey);
            if (secretKey) fd.append("secretKey", secretKey);
          }
          return fd;
        };
        let res: Response;
        if (mode === "preview") {
          if (fileList.length > 0) {
            res = await fetchWithNetworkRetry(
              () =>
                apiBaseUrl
                  ? fetch(endpoint, {
                      method: "POST",
                      body: buildMultipart(bodyPayload as Record<string, unknown>, true),
                      credentials: "include",
                    })
                  : runtimeEmbedMultipartPost(endpoint, (ik) => buildMultipart(bodyPayload as Record<string, unknown>, ik), {
                      accessKey,
                      secretKey,
                    }),
              { retries: 2, delayMs: 400 },
            );
          } else {
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
          }
        } else if (fileList.length > 0 && (mode !== "runtime" || runtimeSurface === "embed" || runtimeSurface === "iframe" || runtimeSurface === "shared")) {
          res = await fetchWithNetworkRetry(
            () =>
              runtimeEmbedMultipartPost(endpoint, (ik) => buildMultipart(bodyWithoutKeys as Record<string, unknown>, ik), {
                accessKey,
                secretKey,
              }),
            { retries: 2, delayMs: 400 },
          );
        } else if (mode === "runtime" && runtimeSurface === "shared") {
          res = await fetchWithNetworkRetry(
            () =>
              fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyWithoutKeys),
              }),
            { retries: 2, delayMs: 400 },
          );
        } else {
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
          resolveChatRuntimeErrorMessage(data, { visitorMultiChatMax });
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
              preview: (value.trim() || fileList[0]?.name || "Attachment").slice(0, 80),
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

        const sources = mapSources(data.sources);
        const serverAttachments =
          Array.isArray(data.userAttachments) && data.userAttachments.length > 0
            ? data.userAttachments
                .map((a) => ({
                  name: typeof a.name === "string" ? a.name : "",
                  mimeType: typeof a.mimeType === "string" ? a.mimeType : "application/octet-stream",
                  url: typeof a.url === "string" ? a.url : "",
                  ...(typeof a.size === "number" && Number.isFinite(a.size) ? { size: a.size } : {}),
                }))
                .filter((a) => String(a.name ?? "").trim())
            : [];

        if (!res.ok) {
          const assistantErrId = generateId();
          const errText = sanitizeChatMessageContent(
            "assistant",
            typeof content === "string" ? content : "No response.",
          );
          setMessages((prev) => {
            const withUser = prev.map((m) =>
              m.id === userMessageId ? { ...m, status: "error" as const } : m,
            );
            return [
              ...withUser,
              {
                id: assistantErrId,
                role: "assistant" as const,
                content: "",
                createdAt: isoNow(),
                sources,
                status: "streaming" as const,
              },
            ];
          });
          await streamAssistantReply(assistantErrId, errText, setMessages, { finalStatus: "error" });
          return;
        }

        const assistantId = resolveAssistantClientMessageId(data.assistantMessageId);
        const fullContent = sanitizeChatMessageContent(
          "assistant",
          typeof content === "string" ? content : "No response.",
        );

        setMessages((prev) => {
          const withUser = prev.map((m) =>
            m.id === userMessageId
              ? {
                  ...m,
                  status: "sent" as const,
                  ...(serverAttachments.length > 0 ? { attachments: serverAttachments } : {}),
                }
              : m,
          );
          return [
            ...withUser,
            {
              id: assistantId,
              role: "assistant" as const,
              content: "",
              createdAt: isoNow(),
              sources,
              status: "streaming" as const,
            },
          ];
        });

        await streamAssistantReply(assistantId, fullContent, setMessages);
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
      authToken,
      previewOverrides,
      previewSourcePage,
      visitorMultiChatEnabled,
      visitorMultiChatMax,
      readPreviewRecent,
      writePreviewRecent,
      refreshRuntimeRecent,
      runtimeSurface,
      iframeContextPayload,
      sharedContextPayload,
      sharedSlug,
    ],
  );

  const postSpeechAudio = useCallback(
    async (args: { blob: Blob; recorderMimeType?: string; mode: "dictate" | "voice"; durationMs: number }) => {
      const buildForm = (includeKeys: boolean): FormData => {
        const fd = new FormData();
        const file = createTranscriptionUploadFile(args.blob, args.recorderMimeType);
        fd.append("file", file);
        fd.append("botId", botId);
        fd.append("mode", args.mode);
        fd.append("durationMs", String(args.durationMs));
        if (chatVisitorId) fd.append("chatVisitorId", chatVisitorId);
        if (mode === "preview" && authToken) fd.append("authToken", authToken);
        if (mode === "runtime" && runtimeSurface === "shared" && sharedContextPayload.shareToken) {
          fd.append("shareToken", sharedContextPayload.shareToken);
        }
        if (mode === "runtime" && runtimeSurface === "iframe") {
          if (iframeContextPayload.parentOrigin) fd.append("parentOrigin", iframeContextPayload.parentOrigin);
          if (iframeContextPayload.iframeUrl) fd.append("pageUrl", iframeContextPayload.iframeUrl);
          if (iframeContextPayload.parentPageUrl) {
            fd.append("parentPageUrl", iframeContextPayload.parentPageUrl);
          }
          if (iframeContextPayload.referrer) fd.append("referrer", iframeContextPayload.referrer);
        }
        if (includeKeys) {
          if (accessKey) fd.append("accessKey", accessKey);
          if (secretKey) fd.append("secretKey", secretKey);
        }
        return fd;
      };

      const res =
        mode === "preview"
          ? await fetchWithNetworkRetry(
              () =>
                apiBaseUrl
                  ? fetch(speechEndpointUrl, {
                      method: "POST",
                      body: buildForm(true),
                      credentials: "include",
                    })
                  : apiFetch(speechEndpointUrl, {
                      method: "POST",
                      body: buildForm(true),
                      credentials: "include",
                    }),
              { retries: 2, delayMs: 400 },
            )
          : await fetchWithNetworkRetry(
              () => runtimeEmbedSpeechPost(speechEndpointUrl, buildForm, { accessKey, secretKey }),
              { retries: 2, delayMs: 400 },
            );

      const data = (await res.json().catch(() => ({}))) as {
        transcript?: string;
        audioUrl?: string;
        mimeType?: string;
        durationMs?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Speech request failed");
      }
      const transcript = typeof data.transcript === "string" ? data.transcript : "";
      return {
        transcript,
        audioUrl: typeof data.audioUrl === "string" ? data.audioUrl : undefined,
        mimeType: typeof data.mimeType === "string" ? data.mimeType : undefined,
        durationMs: typeof data.durationMs === "number" ? data.durationMs : args.durationMs,
      };
    },
    [
      mode,
      botId,
      chatVisitorId,
      accessKey,
      secretKey,
      authToken,
      apiBaseUrl,
      speechEndpointUrl,
      runtimeSurface,
      sharedContextPayload.shareToken,
      iframeContextPayload.parentOrigin,
      iframeContextPayload.iframeUrl,
      iframeContextPayload.referrer,
    ],
  );

  const onSpeechAnalytics = useCallback(
    (payload: { mode: "dictate" | "voice"; transcriptLength: number; hasAudioUrl: boolean }) => {
      const visitorId = (chatVisitorId ?? "").trim();
      if (!visitorId || !apiBaseUrl) return;
      const base = apiBaseUrl.replace(/\/+$/, "");
      try {
        void fetch(`${base}/api/analytics/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            visitorId,
            type: "widget_speech_completed",
            botId,
            metadata: payload,
          }),
        });
      } catch {
        // ignore
      }
    },
    [apiBaseUrl, botId, chatVisitorId],
  );

  const handleMessageFeedback = useCallback(
    async (messageId: string, rating: "up" | "down") => {
      let shouldTrack = false;
      setMessages((prev) => {
        const cur = prev.find((m) => m.id === messageId && m.role === "assistant");
        if (cur?.feedbackRating === rating) return prev;
        shouldTrack = true;
        return prev.map((m) =>
          m.id === messageId && m.role === "assistant" ? { ...m, feedbackRating: rating } : m,
        );
      });
      const visitorId = (chatVisitorId ?? "").trim();
      if (!shouldTrack || !visitorId || !apiBaseUrl) return;
      const conversationId = conversationIdRef.current ?? "";
      const base = apiBaseUrl.replace(/\/+$/, "");
      const feedbackChannel =
        mode === "preview"
          ? "preview"
          : runtimeSurface === "iframe"
            ? "iframe_runtime"
            : runtimeSurface === "shared"
              ? "shared_link"
              : "runtime_embed";
      try {
        await fetch(`${base}/api/analytics/track`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            visitorId,
            type: "assistant_message_feedback",
            botId,
            metadata: {
              messageId,
              ...(conversationId ? { conversationId } : {}),
              rating,
              source: feedbackChannel,
            },
          }),
        });
      } catch {
        // ignore
      }
    },
    [apiBaseUrl, botId, chatVisitorId, mode, runtimeSurface],
  );

  const onSend = useCallback(
    async (text: string, speechInput?: ChatSpeechInputMeta, files?: File[], options?: { suggestionId?: string; dictationSessionCount?: number }) => {
      let value = text.trim();
      if (!value && speechInput?.mode === "voice" && speechInput.audioUrl) {
        value = "Voice message";
      }
      const fileArr = files?.length ? files : [];
      if ((!value && fileArr.length === 0) || isSending) return;
      if (composerReadOnlyRuntime) return;

      const userMessageId = generateId();
      const optimisticAttachments =
        fileArr.length > 0
          ? fileArr.map((f) => ({
              name: f.name,
              mimeType: f.type || "application/octet-stream",
              url: URL.createObjectURL(f),
              size: f.size,
            }))
          : undefined;
      const userMsg: ChatUIMessage = {
        id: userMessageId,
        role: "user",
        content: sanitizeChatMessageContent("user", value),
        createdAt: isoNow(),
        status: "sending",
        ...(optimisticAttachments ? { attachments: optimisticAttachments } : {}),
        ...(speechInput?.mode === "voice" && speechInput.audioUrl
          ? {
              speechInput: {
                mode: "voice" as const,
                ...(speechInput.transcript ? { transcript: speechInput.transcript } : {}),
                audioUrl: speechInput.audioUrl,
                ...(speechInput.mimeType ? { mimeType: speechInput.mimeType } : {}),
                ...(speechInput.durationMs != null ? { durationMs: speechInput.durationMs } : {}),
              },
            }
          : speechInput?.mode === "dictate" && (speechInput.transcript ?? "").trim()
            ? {
                speechInput: {
                  mode: "dictate" as const,
                  transcript: (speechInput.transcript ?? "").trim(),
                },
              }
            : {}),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);
      void executeSend(value, userMessageId, speechInput, fileArr.length ? fileArr : undefined, options);
    },
    [isSending, composerReadOnlyRuntime, executeSend],
  );

  const handleRetryMessage = useCallback(
    (messageId: string) => {
      const found = messages.find((m) => m.id === messageId);
      if (!found || found.role !== "user" || found.status !== "error") return;
      if (found.attachments?.length) return;
      const trimmed = found.content.trim();
      if (!trimmed) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx < 0) return prev;
        return prev.slice(0, idx + 1).map((m, i) =>
          i === idx ? { ...m, status: "sending" as const } : m,
        );
      });
      setIsSending(true);
      void executeSend(trimmed, messageId);
    },
    [executeSend, messages],
  );

  const privacyLineRaw =
    (chatUI?.privacyText ?? "").trim() || (footerPrivacyText ?? "").trim();
  const { showBrandingLine, brandingMessage: brandingMessageResolved } = resolveBrandingFooterDisplay(chatUI);
  const showPrivacyLine = chatUI?.showPrivacyText !== false && Boolean(privacyLineRaw);
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
            <span className="assistrio-emoji-presentation text-2xl" aria-hidden>
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

  useEffect(() => {
    if (useFloatingLauncher) {
      onContainedPanelExpandChange?.(false);
      return;
    }
    onContainedPanelExpandChange?.(menuExpanded);
  }, [useFloatingLauncher, menuExpanded, onContainedPanelExpandChange]);

  /** Panel pixel box matches measured host (`/share/:slug` card or `/iframe/:botId` viewport). */
  const containedSizeToHost = useMemo(
    () =>
      !useFloatingLauncher &&
      mode === "runtime" &&
      (runtimeSurface === "shared" || runtimeSurface === "iframe"),
    [useFloatingLauncher, mode, runtimeSurface],
  );

  /** Square inner chrome so outer host supplies border-radius (avoids clipped / double corners). */
  const containedFlattenInnerChrome = containedSizeToHost;

  const containedIframeNoTransition = useMemo(
    () => !useFloatingLauncher && mode === "runtime" && runtimeSurface === "iframe",
    [useFloatingLauncher, mode, runtimeSurface],
  );

  /** Share hosted page: let Chat panel border paint fully; iframe embed still clips. */
  const containedInnerOverflowHidden =
    !containedFlattenInnerChrome || runtimeSurface === "iframe";

  const containedSizeOpts = useMemo(
    () => ({
      collapsedWidth: inlinePanelCollapsedWidth ?? PANEL_COLLAPSED_WIDTH_PX,
      collapsedHeight: inlinePanelCollapsedHeight ?? PANEL_COLLAPSED_HEIGHT_PX,
      expandedWidth: inlinePanelExpandedWidth ?? PANEL_EXPANDED_WIDTH_PX,
      expandedHeight: inlinePanelExpandedHeight ?? "75vh",
      reservedBottomPx: showContainedLauncherPreview
        ? containedLauncherPreviewBottomOutsetPx(launcherBubble.size)
        : 0,
      fillHost: containedSizeToHost,
    }),
    [
      inlinePanelCollapsedWidth,
      inlinePanelCollapsedHeight,
      inlinePanelExpandedWidth,
      inlinePanelExpandedHeight,
      showContainedLauncherPreview,
      launcherBubble.size,
      containedSizeToHost,
    ],
  );

  const { box: panelBox, canExpand: panelCanExpand } = useChatPanelBox(
    useFloatingLauncher,
    menuExpanded,
    launcherBubble.size,
    containedStageRef,
    containedSizeOpts,
  );

  useEffect(() => {
    if (panelCanExpand) return;
    if (useFloatingLauncher) {
      setFloatingPanelExpanded(false);
    } else {
      setExpanded(false);
    }
  }, [panelCanExpand, useFloatingLauncher]);

  const chatShared = {
    width: "100%" as const,
    height: "100%" as const,
    dark,
    accentColor: primaryColor,
    bubbleBorderRadius,
    showChatBorder: chatUI?.showChatBorder !== false,
    chatPanelBorderColor: chatUI?.chatPanelBorderColor === "default" ? "default" as const : "primary" as const,
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
    showAssistrioBrandingPaid: chatUI?.showAssistrioBrandingPaid !== false,
    brandingMessage: brandingMessageResolved,
    privacyText: privacyTextResolved,
    statusIndicator: chatUI?.statusIndicator ?? "none",
    liveIndicatorStyle: chatUI?.liveIndicatorStyle ?? "label",
    statusDotStyle: chatUI?.statusDotStyle ?? "blinking",
    showScrollToBottom: chatUI?.showScrollToBottom !== false,
    showScrollToBottomLabel: chatUI?.showScrollToBottomLabel !== false,
    scrollToBottomLabel: (chatUI?.scrollToBottomLabel ?? "").trim() || undefined,
    showScrollbar: chatUI?.showScrollbar !== false,
    scrollChromeStyle: resolveScrollChromeStyle(chatUI),
    scrollToBottomChromeStyle: resolveScrollToBottomChromeStyle(chatUI),
    scrollToBottomAlign: resolveScrollToBottomAlign(chatUI),
    userTextBubbleStyle: mapUserBubbleStyle(chatUI?.userTextBubbleStyle),
    userVoiceBubbleStyle: mapUserBubbleStyle(chatUI?.userVoiceBubbleStyle),
    messageListOverflow: "auto" as const,
    composerAsSeparateBox: chatUI?.composerAsSeparateBox !== false,
    composerBorderWidth: composerBorderWidthFromChatUI(chatUI),
    composerBorderColor: chatUI?.composerBorderColor === "default" ? "default" as const : "primary" as const,
    composerControlStyle: resolveComposerControlStyle(chatUI),
    speechRecordingWaveStyle: resolveSpeechRecordingWaveStyle(chatUI),
    showSuggestedChips: Boolean(suggestedQuestions?.length || suggestedQuestionChips?.length),
    suggestedQuestions,
    suggestedQuestionChips,
    showComposerWithSuggestedQuestions: chatUI?.showComposerWithSuggestedQuestions === true,
    hideSuggestionChipText: chatUI?.hideSuggestionChipText === true,
    onBack: onBack ?? (() => { }),
    onMenu,
    showMenuExpand: chatUI?.showMenuExpand !== false && panelCanExpand,
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
    showMetadata: false,
    senderName: "",
    showSenderName: false,
    showTime: false,
    timePosition: chatUI?.timePosition === "bottom" ? "bottom" as const : "top" as const,
    showCopyButton: chatUI?.showCopyButton !== false,
    showSources: mode === "preview" && chatUI?.showSources === true,
    showMessageFeedback: chatUI?.showMessageFeedback !== false,
    onMessageFeedback: handleMessageFeedback,
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
      feedbackHelpful: "Helpful",
      feedbackNotHelpful: "Not helpful",
    },
    showAttach: chatUI?.allowFileUpload === true,
    showMic: chatUI?.showMic === true,
    showVoice:
      typeof chatUI?.showVoice === "boolean"
        ? chatUI.showVoice === true
        : chatUI?.showMic === true,
    onAttach: undefined,
    onMic: () => { },
    postSpeechAudio: speechClientEnabled ? postSpeechAudio : undefined,
    onSpeechAnalytics: speechClientEnabled ? onSpeechAnalytics : undefined,
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
        width={panelBox.width}
        height={panelBox.height}
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
      ref={containedStageRef}
      className={cx("assistrio-chat-widget relative max-h-full min-h-0 min-w-0 max-w-full overflow-visible", className)}
      style={{
        width: panelBox.width,
        height: panelBox.height,
        minHeight: 0,
        maxWidth: "100%",
        maxHeight: "100%",
        boxSizing: "border-box",
        transition: containedIframeNoTransition ? "none" : "width 0.3s ease-out, height 0.3s ease-out",
        ...style,
      }}
    >
      <div
        className={cx(
          "relative z-0 flex h-full w-full min-h-0 min-w-0 flex-col",
          containedInnerOverflowHidden ? "overflow-hidden" : "overflow-visible",
          containedFlattenInnerChrome ? "rounded-none" : "rounded-2xl",
        )}
      >
        <Chat
          {...chatShared}
          showMenuExpand={chatUI?.showMenuExpand !== false}
          onMenuExpand={() => setExpanded((e) => !e)}
          isExpanded={expanded}
          className={containedFlattenInnerChrome ? "!rounded-none" : undefined}
          strings={{
            ...chatShared.strings,
            expandLabel: expanded ? "Collapse" : "Expand chat",
          }}
        />
      </div>
      {showContainedLauncherPreview ? (
        <ContainedLauncherPreview
          chatUI={chatUI}
          avatarUrl={avatarUrl}
          avatarEmoji={avatarEmoji}
          primaryColor={primaryColor}
        />
      ) : null}
    </div>
  );
}
