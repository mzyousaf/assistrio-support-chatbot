/**
 * Landing-site embed contract for **public runtime demo** (CDN `assistrio-chat.js`).
 *
 * Runtime init validates the page Origin header against the bot owner's **allowedOrigins** (exact match).
 */
export type ShowcaseRuntimeEmbedConfig = {
  mode: "runtime";
  botId: string;
  /** Assistrio API origin (no trailing slash), e.g. same as `NEXT_PUBLIC_ASSISTRIO_API_BASE_URL`. */
  apiBaseUrl: string;
  accessKey: string;
  /** Current page origin for embed gate (`window.location.origin`). */
  embedOrigin: string;
};
