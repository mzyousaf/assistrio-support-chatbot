"use client";

import { mountEmbedWidget, unmountEmbedWidget } from "@assistrio/chat-widget";
import { useEffect } from "react";

import "@assistrio/chat-widget/dist/assistrio-chat.css";

type Props = {
  botId: string;
};

/**
 * Mounts the embed widget against same-origin `/api/preview/*` proxies (see route handlers).
 */
export function PreviewPageClient({ botId }: Props) {
  useEffect(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";
    mountEmbedWidget({
      botId,
      apiBaseUrl: origin,
      widgetInitPath: "/api/preview/widget-init",
      chatPostPath: "/api/preview/chat",
      position: "right",
    });
    return () => {
      unmountEmbedWidget();
    };
  }, [botId]);

  return null;
}
