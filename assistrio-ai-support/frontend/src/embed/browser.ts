/**
 * Browser entry for the Assistrio chat widget (third-party sites).
 *
 * Loads after assistrio-chat.css. Exposes {@link AssistrioChatGlobal} on `window.AssistrioChat`.
 *
 * --- Installer snippet (host page) ---
 *
 * <link rel="stylesheet" href="https://YOUR_CDN/assistrio-chat.css" />
 * <script>
 *   window.AssistrioChatConfig = {
 *     botId: "YOUR_BOT_ID",
 *     apiBaseUrl: "https://YOUR_API_ORIGIN",
 *     accessKey: "OPTIONAL",
 *     position: "right"
 *   };
 * </script>
 * <script src="https://YOUR_CDN/assistrio-chat.js" async></script>
 *
 * Or call manually after load:
 *   window.AssistrioChat.mount({ botId, apiBaseUrl, ... });
 */

import { mountEmbedWidget, unmountEmbedWidget, getMountedEmbedWidget } from "./bootstrap";
import { readEmbedConfig } from "./config";
import type { AssistrioChatGlobal, EmbedChatConfig } from "./types";

declare global {
  interface Window {
    AssistrioChatConfig?: Partial<EmbedChatConfig>;
    AssistrioChat?: AssistrioChatGlobal;
  }
}

export type { AssistrioChatGlobal };

function mergeConfig(override?: Partial<EmbedChatConfig>): Partial<EmbedChatConfig> {
  const base = typeof window !== "undefined" ? window.AssistrioChatConfig ?? {} : {};
  return { ...base, ...override };
}

function safeMount(override?: Partial<EmbedChatConfig>): void {
  try {
    const merged = mergeConfig(override);
    readEmbedConfig(merged);
    mountEmbedWidget(merged);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (typeof console !== "undefined" && console.error) {
      console.error("[Assistrio Chat]", msg);
    }
  }
}

function safeAutoMount(): void {
  if (typeof window === "undefined") return;
  if (!window.AssistrioChatConfig) return;
  safeMount();
}

function installGlobalApi(): void {
  if (typeof window === "undefined") return;
  window.AssistrioChat = {
    mount: safeMount,
    unmount: unmountEmbedWidget,
    isMounted: getMountedEmbedWidget,
  };
}

installGlobalApi();

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeAutoMount, { once: true });
  } else {
    safeAutoMount();
  }
}
