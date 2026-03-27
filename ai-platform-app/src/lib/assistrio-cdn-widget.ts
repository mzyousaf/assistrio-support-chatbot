/**
 * Types for `window.AssistrioChat` / config — must stay aligned with the hosted `assistrio-chat.js`
 * contract (built from the `chat-widget` package). No npm import of that package.
 */

export type AssistrioChatGlobal = {
  mount: (config?: Partial<EmbedChatConfig>) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

/** Embed snippet / AssistrioChatConfig shape (CDN widget). */
export type EmbedChatConfig = {
  botId: string;
  apiBaseUrl: string;
  mode?: "runtime" | "preview";
  accessKey?: string;
  secretKey?: string;
  widgetInitPath?: string;
  chatPostPath?: string;
  platformVisitorId?: string;
  chatVisitorId?: string;
  authToken?: string;
  /** When false, chat visitor id is not stored in localStorage. Defaults false if authToken is set. */
  persistChatSession?: boolean;
  position?: "left" | "right";
  previewOverrides?: unknown;
  disableRemoteConfig?: boolean;
};

export const ASSISTRIO_WIDGET_CSS = "https://widget.assistrio.com/assistrio-chat.css";
export const ASSISTRIO_WIDGET_JS = "https://widget.assistrio.com/assistrio-chat.js";

declare global {
  interface Window {
    AssistrioChatConfig?: Partial<EmbedChatConfig>;
    AssistrioChat?: AssistrioChatGlobal;
  }
}

export type AssistrioCdnElementIds = {
  linkId: string;
  scriptId: string;
};

const defaultIds: AssistrioCdnElementIds = {
  linkId: "assistrio-chat-css",
  scriptId: "assistrio-chat-js",
};

/**
 * Injects the hosted Assistrio widget script/CSS (same as customer embed snippet) and mounts with `config`.
 */
export function mountAssistrioWidgetFromCdn(
  config: Partial<EmbedChatConfig>,
  ids: AssistrioCdnElementIds = defaultIds
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.AssistrioChatConfig = config;

  if (!document.getElementById(ids.linkId)) {
    const link = document.createElement("link");
    link.id = ids.linkId;
    link.rel = "stylesheet";
    link.href = ASSISTRIO_WIDGET_CSS;
    document.head.appendChild(link);
  }

  const mountWidget = () => {
    window.AssistrioChat?.unmount?.();
    window.AssistrioChat?.mount?.(window.AssistrioChatConfig);
  };

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
  script.src = ASSISTRIO_WIDGET_JS;
  script.async = true;
  script.addEventListener("load", mountWidget, { once: true });
  document.body.appendChild(script);
}

export function unmountAssistrioCdnWidget(): void {
  if (typeof window === "undefined") return;
  window.AssistrioChat?.unmount?.();
}
