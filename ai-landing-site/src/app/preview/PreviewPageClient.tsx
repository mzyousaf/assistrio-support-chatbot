"use client";

import { AssistrioEmbedWidgetRoot } from "@/components/embed/AssistrioEmbedWidgetRoot";

type Props = {
  botId: string;
};

/**
 * Same-origin `/api/preview/*` proxies (see route handlers). Uses npm package embed (not CDN snippet).
 */
export function PreviewPageClient({ botId }: Props) {
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "";

  if (!origin) {
    return null;
  }

  return (
    <AssistrioEmbedWidgetRoot
      rawConfig={{
        botId,
        apiBaseUrl: origin,
        widgetInitPath: "/api/preview/widget-init",
        chatPostPath: "/api/preview/chat",
        position: "right",
      }}
    />
  );
}
