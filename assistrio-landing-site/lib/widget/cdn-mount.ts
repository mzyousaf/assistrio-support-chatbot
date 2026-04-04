"use client";

import { getAssistrioWidgetCdnUrls } from "./cdn-urls";
import type { ShowcaseRuntimeEmbedConfig } from "@/types/widget-runtime";

const DEFAULT_IDS = { linkId: "assistrio-landing-widget-css", scriptId: "assistrio-landing-widget-js" };

declare global {
  interface Window {
    AssistrioChatConfig?: Record<string, unknown>;
    AssistrioChat?: {
      mount: (config?: Record<string, unknown>) => void;
      unmount: () => void;
      isMounted: () => boolean;
    };
  }
}

/**
 * Injects widget CSS/JS (if missing) and calls `AssistrioChat.mount` with **runtime** config.
 * The widget attaches a floating launcher to `document.body` — any surrounding card is explanatory only.
 */
export function mountAssistrioRuntimeFromCdn(
  config: ShowcaseRuntimeEmbedConfig,
  options?: {
    injectStylesheet?: boolean;
    onScriptError?: () => void;
    /** Fires after `AssistrioChat.mount` runs (post script load if needed). */
    onMounted?: () => void;
  },
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const { js, css } = getAssistrioWidgetCdnUrls();
  const injectStylesheet = options?.injectStylesheet !== false;
  const ids = DEFAULT_IDS;

  window.AssistrioChatConfig = {
    mode: config.mode,
    botId: config.botId,
    apiBaseUrl: config.apiBaseUrl,
    accessKey: config.accessKey,
    platformVisitorId: config.platformVisitorId,
    embedOrigin: config.embedOrigin,
  };

  const mountWidget = () => {
    const api = window.AssistrioChat?.mount;
    if (typeof api === "function") {
      api(window.AssistrioChatConfig);
      options?.onMounted?.();
    } else {
      options?.onScriptError?.();
    }
  };

  if (injectStylesheet && !document.getElementById(ids.linkId)) {
    const link = document.createElement("link");
    link.id = ids.linkId;
    link.rel = "stylesheet";
    link.href = css;
    document.head.appendChild(link);
  }

  const existingScript = document.getElementById(ids.scriptId) as HTMLScriptElement | null;
  if (existingScript) {
    if (window.AssistrioChat?.mount) {
      mountWidget();
    } else {
      existingScript.addEventListener("load", mountWidget, { once: true });
    }
    return;
  }

  const script = document.createElement("script");
  script.id = ids.scriptId;
  script.src = js;
  script.async = true;
  script.addEventListener("load", mountWidget, { once: true });
  script.addEventListener(
    "error",
    () => {
      options?.onScriptError?.();
    },
    { once: true },
  );
  document.body.appendChild(script);
}

export function unmountAssistrioRuntimeFromCdn(): void {
  if (typeof window === "undefined") return;
  window.AssistrioChat?.unmount?.();
}
