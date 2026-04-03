/**
 * Widget script/CSS URLs for the landing site.
 *
 * Defaults load from this site’s `public/` (`/assistrio-chat.js`) so the UI matches the
 * `chat-widget` package in the repo. Override with `NEXT_PUBLIC_ASSISTRIO_WIDGET_*` to use
 * the hosted CDN (e.g. https://widget.assistrio.com/assistrio-chat.js) if you do not ship the bundle.
 */

export function getAssistrioWidgetJsUrl(): string {
  const v = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ASSISTRIO_WIDGET_JS?.trim() : "";
  return v || "/assistrio-chat.js";
}

export function getAssistrioWidgetCssUrl(): string {
  const v = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_ASSISTRIO_WIDGET_CSS?.trim() : "";
  return v || "/assistrio-chat.css";
}

/** Subset of embed config passed to `AssistrioChat.mount` / `AssistrioChatConfig` (matches chat-widget types). */
export interface AssistrioEmbedConfig {
  botId?: string;
  apiBaseUrl?: string;
  position?: "left" | "right";
  accessKey?: string;
  secretKey?: string;
  platformVisitorId?: string;
  widgetInitPath?: string;
  chatPostPath?: string;
  mode?: "runtime" | "preview";
  previewOverrides?: unknown;
  disableRemoteConfig?: boolean;
  chatVisitorId?: string;
  authToken?: string;
  /** Cookie session preview (same as platform Edit Bot); no JWT in body. */
  sessionPreview?: boolean;
  persistChatSession?: boolean;
}

export type AssistrioChatGlobal = {
  mount: (config?: Partial<AssistrioEmbedConfig>) => void;
  unmount: () => void;
  isMounted: () => boolean;
};

declare global {
  interface Window {
    AssistrioChatConfig?: Partial<AssistrioEmbedConfig>;
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

function findOrCreateStylesheet(ids: AssistrioCdnElementIds): void {
  if (typeof document === "undefined") return;
  const cssUrl = getAssistrioWidgetCssUrl();
  if (document.querySelector(`link[href="${cssUrl}"]`) || document.getElementById(ids.linkId)) {
    return;
  }
  const link = document.createElement("link");
  link.id = ids.linkId;
  link.rel = "stylesheet";
  link.href = cssUrl;
  document.head.appendChild(link);
}

/**
 * Injects the hosted Assistrio widget script/CSS and mounts with `config` (same as customer embed snippet).
 */
export function mountAssistrioWidgetFromCdn(
  config: Partial<AssistrioEmbedConfig>,
  ids: AssistrioCdnElementIds = defaultIds
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.AssistrioChatConfig = config;
  findOrCreateStylesheet(ids);

  const mountWidget = () => {
    window.AssistrioChat?.mount?.(window.AssistrioChatConfig);
  };

  const jsUrl = getAssistrioWidgetJsUrl();
  const existingScript =
    (document.querySelector(`script[src="${jsUrl}"]`) as HTMLScriptElement | null) ??
    (document.getElementById(ids.scriptId) as HTMLScriptElement | null);

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
  script.src = jsUrl;
  script.async = true;
  script.addEventListener("load", mountWidget, { once: true });
  document.body.appendChild(script);
}

export function unmountAssistrioCdnWidget(): void {
  if (typeof window === "undefined") return;
  window.AssistrioChat?.unmount?.();
}
