"use client";

import { useEffect } from "react";

import {
  mountAssistrioWidgetFromCdn,
  unmountAssistrioCdnWidget,
} from "@/lib/assistrio-cdn-widget";

type Props = {
  botId: string;
};

/**
 * Mounts the embed widget via CDN against same-origin `/api/preview/*` proxies (see route handlers).
 */
export function PreviewPageClient({ botId }: Props) {
  useEffect(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";

    mountAssistrioWidgetFromCdn({
      botId,
      apiBaseUrl: origin,
      widgetInitPath: "/api/preview/widget-init",
      chatPostPath: "/api/preview/chat",
      position: "right",
    });

    return () => {
      unmountAssistrioCdnWidget();
    };
  }, [botId]);

  return null;
}
