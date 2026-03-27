"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { BotChatUI } from "@/models/Bot";
import { EmbedWidgetRoot } from "@/embed";
import { getApiBaseUrl } from "@/lib/api";

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

const PREVIEW_DEBOUNCE_MS = 360;

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

  const [debouncedOverrides, setDebouncedOverrides] = useState(previewOverrides);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedOverrides(previewOverrides), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [previewOverrides]);

  const apiBaseUrl = getApiBaseUrl();

  return (
    <div className="max-w-[1400px] w-full mx-auto px-6 xl:px-8 py-6">
      <div className="min-h-0">
        {children}
      </div>
      {apiBaseUrl ? (
        <EmbedWidgetRoot
          rawConfig={{
            botId,
            apiBaseUrl,
            mode: "preview",
            accessKey,
            secretKey,
            platformVisitorId: ownerVisitorId,
            previewOverrides: debouncedOverrides,
          }}
        />
      ) : null}
    </div>
  );
}
