"use client";

import React, { useEffect, useMemo } from "react";
import type { BotChatUI } from "@/models/Bot";
import type { AssistrioChatGlobal, EmbedChatConfig } from "@/embed/types";

declare global {
  interface Window {
    AssistrioChatConfig?: Partial<EmbedChatConfig>;
    AssistrioChat?: AssistrioChatGlobal;
  }
}

export interface EditBotWorkspaceLayoutProps {
  botId: string;
  botName: string;
  botAvatarUrl?: string;
  accessKey?: string;
  secretKey?: string;
  ownerVisitorId?: string;
  /** Live preview from form (name, imageUrl, chatUI, tagline, description, welcomeMessage, suggestedQuestions) – chat reflects edits in real time */
  livePreview?: { name: string; imageUrl?: string; chatUI?: BotChatUI; tagline?: string; description?: string; welcomeMessage?: string; suggestedQuestions?: string[] } | null;
  /** When true, chat opens automatically on first render (default true). Pass from bot.chatUI.openChatOnLoad when available. */
  defaultChatOpen?: boolean;
  /** URL to open when user chooses "Expand chat" in menu (e.g. /demo/:slug) */
  expandHref?: string;
  /** Left pane: editor content (BotEditorPane) */
  children: React.ReactNode;
}

export function EditBotWorkspaceLayout({
  botId,
  botName,
  botAvatarUrl,
  accessKey,
  secretKey,
  ownerVisitorId,
  livePreview,
  defaultChatOpen = true,
  expandHref,
  children,
}: EditBotWorkspaceLayoutProps) {
  void defaultChatOpen;
  void expandHref;

  const previewOverrides = useMemo(() => {
    const fallbackName = botName.trim();
    const fallbackAvatar = botAvatarUrl?.trim();
    return {
      botName: livePreview?.name?.trim() || fallbackName || undefined,
      avatarUrl: livePreview?.imageUrl?.trim() || fallbackAvatar || undefined,
      tagline: livePreview?.tagline?.trim() || undefined,
      description: livePreview?.description?.trim() || undefined,
      welcomeMessage: livePreview?.welcomeMessage?.trim() || undefined,
      suggestedQuestions: Array.isArray(livePreview?.suggestedQuestions)
        ? livePreview.suggestedQuestions
        : undefined,
      chatUI: livePreview?.chatUI ?? undefined,
    };
  }, [botName, botAvatarUrl, livePreview]);

  const apiBaseUrl =
    (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim() ||
    (typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const linkId = "assistrio-chat-css";
    const scriptId = "assistrio-chat-js";
    const cssHref = "https://widget.assistrio.com/assistrio-chat.css";
    const jsSrc = "https://widget.assistrio.com/assistrio-chat.js";

    window.AssistrioChatConfig = {
      botId,
      apiBaseUrl,
      mode: "preview",
      accessKey,
      secretKey,
      platformVisitorId: ownerVisitorId,
      previewOverrides,
      position: "right",
    };

    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = cssHref;
      document.head.appendChild(link);
    }

    const mountWidget = () => {
      if (window.AssistrioChat?.unmount) {
        window.AssistrioChat.unmount();
      }
      window.AssistrioChat?.mount?.(window.AssistrioChatConfig);
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.AssistrioChat?.mount) {
        mountWidget();
      } else {
        existingScript.addEventListener("load", mountWidget, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = jsSrc;
    script.async = true;
    script.addEventListener("load", mountWidget, { once: true });
    document.body.appendChild(script);
  }, [botId, apiBaseUrl, accessKey, secretKey, ownerVisitorId, previewOverrides]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.AssistrioChat?.unmount?.();
      }
    };
  }, []);

  return (
    <div className="max-w-[1400px] w-full mx-auto px-6 xl:px-8 py-6">
      <div className="min-h-0">
        {children}
      </div>
    </div>
  );
}
