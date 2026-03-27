/**
 * Hosted widget built from the `chat-widget` package (same URLs as production embed snippets).
 */

export const ASSISTRIO_WIDGET_CSS = "https://widget.assistrio.com/assistrio-chat.css";
export const ASSISTRIO_WIDGET_JS = "https://widget.assistrio.com/assistrio-chat.js";

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
  if (
    document.querySelector(`link[href="${ASSISTRIO_WIDGET_CSS}"]`) ||
    document.getElementById(ids.linkId)
  ) {
    return;
  }
  const link = document.createElement("link");
  link.id = ids.linkId;
  link.rel = "stylesheet";
  link.href = ASSISTRIO_WIDGET_CSS;
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
    window.AssistrioChat?.unmount?.();
    window.AssistrioChat?.mount?.(window.AssistrioChatConfig);
  };

  const existingScript =
    (document.querySelector(
      `script[src="${ASSISTRIO_WIDGET_JS}"]`,
    ) as HTMLScriptElement | null) ?? (document.getElementById(ids.scriptId) as HTMLScriptElement | null);

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
