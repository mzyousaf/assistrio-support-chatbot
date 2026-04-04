/**
 * Landing-side anonymous identity: `platformVisitorId` is the stable id for ownership/quota continuity
 * (aligned with backend embed + trial APIs). Not a chat/session id — the widget generates chat identity separately.
 *
 * @see `docs/PRODUCT_MODEL.md` for the full surface-area / tradeoff checklist.
 */
export type PlatformVisitorIdStatus = "loading" | "ready";

export type ReconnectResult = { ok: true } | { ok: false; error: string };

export type UsePlatformVisitorIdResult = {
  /** Stable id once {@link PlatformVisitorIdStatus} is `ready`. */
  platformVisitorId: string | null;
  status: PlatformVisitorIdStatus;
  /** Present when `?platformVisitorId=` was invalid (ignored; falls back to storage or a new id). */
  queryParamRejected?: boolean;
  /**
   * Apply a saved id from another device or a bookmark. Validates format, persists to `localStorage`, updates state.
   * Does not verify “true” ownership — anyone who knows the id can assume this anonymous bucket (same as backend).
   */
  reconnectWithPlatformVisitorId: (rawId: string) => ReconnectResult;
};
