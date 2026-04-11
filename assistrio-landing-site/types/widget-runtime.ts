/**
 * Landing-site embed contract for **showcase runtime only** (CDN `assistrio-chat.js`).
 *
 * - **platformVisitorId** — stable anonymous id (quota/ownership); required for showcase runtime per backend.
 * - **chatVisitorId** — not set by landing; the widget creates/persists chat sessions internally.
 * - **mode** — always `"runtime"` here; preview/session flows stay on Assistrio product UIs, not this page.
 */
export type ShowcaseRuntimeEmbedConfig = {
  mode: "runtime";
  botId: string;
  /** Assistrio API origin (no trailing slash), e.g. same as `NEXT_PUBLIC_API_BASE_URL`. */
  apiBaseUrl: string;
  accessKey: string;
  /**
   * Same id as anonymous landing identity — reconnecting this string reconnects quota continuity.
   * Treat as private access–like: anyone with it can hit quota-related anonymous APIs.
   */
  platformVisitorId: string;
  /**
   * Current page origin for embed gate (`window.location.origin`). Required for runtime init on most setups.
   */
  embedOrigin: string;
};
