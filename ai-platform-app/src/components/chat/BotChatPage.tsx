"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Chat } from "@/components/chat-ui";
import type { ChatUIMessage, ChatUISource } from "@/components/chat-ui";
import { mapSources } from "@/components/chat-ui";
import { usePreferredColorScheme } from "@/hooks/usePreferredColorScheme";
import { useVisitorId } from "@/hooks/useVisitorId";
import { apiFetch } from "@/lib/api";
import { resolveWelcomeMessage } from "@/lib/welcomeMessage";
import type { BotChatUI } from "@/models/Bot";

const SUBTITLE_MAX_LENGTH = 80;

function truncate(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trimEnd().replace(/\s+\S*$/, "") + "…";
}

type BotChatProps = {
  bot: {
    id: string;
    slug: string;
    name: string;
    /** Tagline shown under bot name; falls back to shortDescription or truncated description */
    tagline?: string;
    shortDescription?: string;
    description?: string;
    welcomeMessage?: string;
    avatarEmoji?: string;
    imageUrl?: string;
    chatUI?: BotChatUI;
    faqs?: Array<{ question: string; answer: string }>;
    exampleQuestions?: string[];
    mode: "demo" | "trial";
  };
};

const DEFAULT_SENDER_NAME = " - AI";

function composerBorderWidthFromChatUI(chatUI: BotChatUI | undefined): number {
  const v = chatUI?.composerBorderWidth;
  if (typeof v === "number" && v >= 0 && v <= 6) {
    const w = Number(v);
    return w > 0 && w < 0.5 ? 0.5 : Math.max(0, Math.min(6, w));
  }
  if ((chatUI as { showComposerBorder?: boolean })?.showComposerBorder === false) return 0;
  return 1;
}

const FALLBACK_EXAMPLE_QUESTIONS = [
  "What does this service do?",
  "Who is this best for?",
  "How can I get started?",
];

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function buildWelcomeMessage(bot: BotChatProps["bot"]): ChatUIMessage | null {
  const template = (bot.welcomeMessage ?? "").trim();
  if (!template) return null;
  const content = resolveWelcomeMessage(template, {
    name: bot.name,
    tagline: bot.tagline ?? bot.shortDescription,
    description: bot.description,
  });
  return {
    id: `welcome_${bot.id}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    status: "sent",
  };
}

export default function BotChatPage({ bot }: BotChatProps) {
  const { platformVisitorId } = useVisitorId();
  const preferredScheme = usePreferredColorScheme();
  const welcomeMsg = useMemo(() => buildWelcomeMessage(bot), [bot.id, bot.welcomeMessage]);
  const [messages, setMessages] = useState<ChatUIMessage[]>(() =>
    welcomeMsg ? [welcomeMsg] : []
  );
  const [isSending, setIsSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (!welcomeMsg || messages.length > 0) return;
    setMessages([welcomeMsg]);
  }, [welcomeMsg, messages.length]);

  const primaryColor =
    typeof bot.chatUI?.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(bot.chatUI.primaryColor)
      ? bot.chatUI.primaryColor
      : "#14B8A6";
  const dark = useMemo(() => {
    const style = bot.chatUI?.backgroundStyle;
    if (style === "light") return false;
    if (style === "dark") return true;
    return preferredScheme === "dark";
  }, [bot.chatUI?.backgroundStyle, preferredScheme]);
  const bubbleBorderRadius =
    typeof bot.chatUI?.bubbleBorderRadius === "number"
      ? Math.max(0, Math.min(32, bot.chatUI.bubbleBorderRadius))
      : (bot.chatUI as { bubbleStyle?: string })?.bubbleStyle === "squared"
        ? 0
        : 20;

  const headerSubtitle = useMemo(() => {
    const tag = (bot.tagline ?? bot.shortDescription ?? "").trim();
    if (tag) return tag;
    const desc = (bot.description ?? "").trim();
    return desc ? truncate(desc, SUBTITLE_MAX_LENGTH) : "";
  }, [bot.tagline, bot.shortDescription, bot.description]);

  const suggestedQuestions = useMemo(() => {
    const explicit = Array.isArray(bot.exampleQuestions)
      ? bot.exampleQuestions.map((q) => String(q || "").trim()).filter(Boolean)
      : [];
    if (explicit.length > 0) return explicit.slice(0, 6);
    return FALLBACK_EXAMPLE_QUESTIONS;
  }, [bot.exampleQuestions]);

  const onSend = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || isSending || limitReached || !platformVisitorId) return;

      const userMsg: ChatUIMessage = {
        id: generateId(),
        role: "user",
        content: value,
        createdAt: isoNow(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      try {
        const endpoint = bot.mode === "demo" ? "/api/demo/chat" : "/api/trial/chat";
        const res = await apiFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botSlug: bot.slug,
            message: value,
            platformVisitorId,
          }),
        });

        if (res.status === 403) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string; message?: string }
            | null;
          if (data?.error === "limit_reached") {
            setLimitReached(true);
            const msg = data?.message ?? "You reached the free limit.";
            setMessages((prev) => [
              ...prev,
              {
                id: generateId(),
                role: "assistant",
                content: msg,
                createdAt: isoNow(),
                status: "sent",
              },
            ]);
            return;
          }
        }

        if (res.status === 429) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          const errMsg =
            data?.message ?? "You are sending messages too fast. Please wait a moment.";
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: errMsg,
              createdAt: isoNow(),
              status: "error",
            },
          ]);
          return;
        }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: "Something went wrong. Please try again.",
              createdAt: isoNow(),
              status: "error",
            },
          ]);
          return;
        }

        const data = (await res.json()) as {
          reply?: string;
          assistantMessage?: string;
          sources?: ChatUISource[];
        };
        const reply = data?.assistantMessage ?? data?.reply ?? "No reply.";
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: reply,
            createdAt: isoNow(),
            sources: mapSources(data?.sources),
            status: "sent",
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: "Network error. Please try again.",
            createdAt: isoNow(),
            status: "error",
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [bot.mode, bot.slug, isSending, limitReached, platformVisitorId]
  );

  const emptyState =
    limitReached ? (
      <p className="text-sm text-slate-400">
        Free limit reached. To unlock a full setup, get in touch.
      </p>
    ) : (
      <p className="text-sm text-slate-500">Ask a question to start the conversation.</p>
    );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50 p-4 md:p-6">
      <div className="flex-1 flex justify-center items-start max-w-3xl mx-auto w-full">
        <Chat
          width="100%"
          height={600}
          dark={dark}
          accentColor={primaryColor}
          bubbleBorderRadius={bubbleBorderRadius}
          showChatBorder={bot.chatUI?.showChatBorder !== false}
          showHeader
          showAvatarInHeader={bot.chatUI?.showAvatarInHeader !== false}
          showFooter={bot.chatUI?.showBranding !== false}
          brandingMessage={(bot.chatUI?.brandingMessage ?? "").trim() || undefined}
          privacyText="Your conversations are private and secure."
          statusIndicator={bot.chatUI?.statusIndicator ?? "none"}
          liveIndicatorStyle={bot.chatUI?.liveIndicatorStyle ?? "label"}
          statusDotStyle={bot.chatUI?.statusDotStyle ?? "blinking"}
          showScrollToBottom={bot.chatUI?.showScrollToBottom !== false}
          showScrollbar={bot.chatUI?.showScrollbar !== false}
          composerAsSeparateBox={bot.chatUI?.composerAsSeparateBox !== false}
          composerBorderWidth={composerBorderWidthFromChatUI(bot.chatUI)}
          composerBorderColor={bot.chatUI?.composerBorderColor === "default" ? "default" : "primary"}
          showSuggestedChips
          showComposerWithSuggestedQuestions={bot.chatUI?.showComposerWithSuggestedQuestions === true}
          avatar={
            bot.chatUI?.showAvatarInHeader !== false
              ? bot.imageUrl ? (
                <img src={bot.imageUrl} alt="" className="w-full h-full object-cover rounded-full" />
              ) : bot.avatarEmoji ? (
                <span className="text-2xl" aria-hidden>
                  {bot.avatarEmoji}
                </span>
              ) : undefined
              : undefined
          }
          title={bot.name}
          subtitle={headerSubtitle || undefined}
          messages={messages}
          isSending={isSending}
          onSend={onSend}
          showMetadata
          senderName={
            (bot.chatUI?.senderName ?? "").trim()
              ? (bot.chatUI?.senderName ?? "").trim()
              : `${bot.name}${DEFAULT_SENDER_NAME}`
          }
          showSenderName={bot.chatUI?.showSenderName !== false}
          showTime={bot.chatUI?.showTime !== false}
          timePosition={bot.chatUI?.timePosition === "bottom" ? "bottom" : "top"}
          showCopyButton={bot.chatUI?.showCopyButton !== false}
          showSources={bot.chatUI?.showSources !== false}
          allowMarkdown
          emptyState={emptyState}
          suggestedQuestions={suggestedQuestions}
          strings={{
            placeholder: limitReached ? "Free limit reached." : "Type your message…",
            send: "Send",
            copy: "Copy",
            copied: "Copied!",
            sourcesLabel: "Sources",
          }}
          showAttach={bot.chatUI?.allowFileUpload === true}
          showEmoji={bot.chatUI?.showEmoji !== false}
          showMic={bot.chatUI?.showMic === true}
          onAttach={() => { }}
          onEmoji={() => { }}
          onMic={() => { }}
          className="max-w-[460px] w-full"
        />
      </div>
    </div>
  );
}
