"use client";

import { useEffect } from "react";
import { getLandingAssistrioChatConfig } from "@/lib/assistrio-widget-defaults";
import { mountAssistrioWidgetFromCdn } from "@/lib/assistrio-cdn-widget";

/**
 * Site-wide default widget from CDN (same `assistrio-chat.js` as production embeds).
 */
export function AssistrioGlobalEmbed() {
  useEffect(() => {
    const cfg = getLandingAssistrioChatConfig();
    if (!cfg) return;
    mountAssistrioWidgetFromCdn(cfg);
    return () => {
      window.AssistrioChat?.unmount?.();
    };
  }, []);

  return null;
}
