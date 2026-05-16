/**
 * Landing-side anonymous id for analytics / continuity (localStorage + optional URL param).
 * Not used for runtime embed authorization — the API matches the page Origin to allowedOrigins.
 */
export type SiteAnalyticsVisitorStatus = "loading" | "ready";

export type ReconnectResult = { ok: true } | { ok: false; error: string };

export type UseSiteAnalyticsVisitorResult = {
  /** Stable id once {@link SiteAnalyticsVisitorStatus} is `ready`. */
  visitorId: string | null;
  status: SiteAnalyticsVisitorStatus;
  /** Present when `?platformVisitorId=` was invalid (ignored; falls back to storage or a new id). */
  queryParamRejected?: boolean;
  reconnectWithVisitorId: (rawId: string) => ReconnectResult;
};
