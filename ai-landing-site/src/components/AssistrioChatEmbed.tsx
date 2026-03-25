"use client";

import { useEffect } from "react";
import { getLandingAssistrioChatConfig } from "@/lib/assistrio-widget-defaults";

const WIDGET_CSS = "https://widget.assistrio.com/assistrio-chat.css";
const WIDGET_JS = "https://widget.assistrio.com/assistrio-chat.js";

declare global {
  interface Window {
    AssistrioChatConfig?: Record<string, unknown>;
    AssistrioChat?: {
      mount: (cfg?: Record<string, unknown>) => void;
      unmount: () => void;
      isMounted: () => boolean;
    };
  }
}

function ensureCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href="${WIDGET_CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = WIDGET_CSS;
  document.head.appendChild(link);
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.AssistrioChat) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${WIDGET_JS}"]`,
    ) as HTMLScriptElement | null;

    const onReady = () => {
      if (window.AssistrioChat) resolve();
      else reject(new Error("Assistrio widget did not expose AssistrioChat"));
    };

    if (existing) {
      if (window.AssistrioChat) {
        resolve();
        return;
      }
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Assistrio widget script")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGET_JS;
    script.async = true;
    script.onload = onReady;
    script.onerror = () =>
      reject(new Error("Failed to load Assistrio widget script"));
    document.body.appendChild(script);
  });
}

type AssistrioChatEmbedProps = {
  botId: string | null;
  apiBaseUrl: string;
};

/**
 * Loads the hosted Assistrio embed and mounts chat for the given bot.
 * Updates when `botId` changes; unmounts when `botId` is null.
 */
export function AssistrioChatEmbed({ botId, apiBaseUrl }: AssistrioChatEmbedProps) {
  /** When preview unmounts, put the site default widget back (same as global embed). */
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      window.AssistrioChat?.unmount();
      const cfg = getLandingAssistrioChatConfig();
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

    let cancelled = false;

    (async () => {
      try {
        ensureCss();
        await loadScript();
        if (cancelled) return;

        window.AssistrioChatConfig = {
          botId,
          apiBaseUrl,
          position: "right",
        };

        window.AssistrioChat?.unmount();
        window.AssistrioChat?.mount();
      } catch (e) {
        console.error("[AssistrioChatEmbed]", e);
      }
    })();

    return () => {
      cancelled = true;
      window.AssistrioChat?.unmount();
    };
  }, [botId, apiBaseUrl]);

  return null;
}
