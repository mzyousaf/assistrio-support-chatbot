"use client";

import { useEffect } from "react";
import { getLandingAssistrioChatConfig } from "@/lib/assistrio-widget-defaults";
import {
  mountAssistrioWidgetFromCdn,
  unmountAssistrioCdnWidget,
} from "@/lib/assistrio-cdn-widget";

/**
 * Loads the hosted Assistrio embed (CDN bundle from `chat-widget`) and mounts chat for the given bot.
 * Updates when `botId` changes; unmounts when `botId` is null.
 */
export function AssistrioChatEmbed({
  botId,
  apiBaseUrl,
  accessKey,
  secretKey,
  platformVisitorId,
}: {
  botId: string | null;
  apiBaseUrl: string;
  accessKey?: string;
  secretKey?: string;
  platformVisitorId?: string;
}) {
  /** When preview unmounts, put the site default widget back (same as global embed). */
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      window.AssistrioChat?.unmount();
      const cfg = getLandingAssistrioChatConfig();
      if (!cfg) return;
      window.AssistrioChatConfig = { ...cfg };
      window.AssistrioChat?.mount();
    };
  }, []);

  useEffect(() => {
    if (!botId || !apiBaseUrl) {
      if (typeof window !== "undefined" && window.AssistrioChat?.isMounted?.()) {
        window.AssistrioChat.unmount();
      }
      return;
    }

    try {
      mountAssistrioWidgetFromCdn({
        botId,
        apiBaseUrl,
        ...(accessKey ? { accessKey } : {}),
        ...(secretKey ? { secretKey } : {}),
        ...(platformVisitorId ? { platformVisitorId } : {}),
        position: "right",
      });
    } catch (e) {
      console.error("[AssistrioChatEmbed]", e);
    }

    return () => {
      unmountAssistrioCdnWidget();
    };
  }, [botId, apiBaseUrl, accessKey, secretKey, platformVisitorId]);

  return null;
}
