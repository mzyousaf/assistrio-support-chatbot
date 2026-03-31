"use client";

import React, { useEffect, useState } from "react";
import { EmbedWidgetRoot } from "@assistrio/chat-widget";
import type { EmbedChatConfig } from "@assistrio/chat-widget";

type BotEditEmbedPreviewProps = {
  botId: string;
  /** Draft UI + behavior prompts for `/api/widget/preview/*` (personality/config merged server-side on chat). */
  previewOverrides: NonNullable<EmbedChatConfig["previewOverrides"]> & {
    personality?: unknown;
    config?: unknown;
    leadCapture?: unknown;
  };
};

/**
 * Live widget preview in the editor: `EmbedWidgetRoot` in preview mode with cookie auth.
 * `previewOverrides` carries unsaved copy + prompts (`personality`, `config`) for the preview APIs.
 */
export function BotEditEmbedPreview({ botId, previewOverrides }: BotEditEmbedPreviewProps) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  useEffect(() => {
    setApiBaseUrl(
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) ||
        (typeof window !== "undefined" ? window.location.origin : "") ||
        "",
    );
  }, []);

  if (!apiBaseUrl) return null;

  return (
    <EmbedWidgetRoot
      rawConfig={{
        botId,
        apiBaseUrl,
        mode: "preview",
        sessionPreview: true,
        position: "right",
        previewOverrides: previewOverrides as EmbedChatConfig["previewOverrides"],
      }}
    />
  );
}
