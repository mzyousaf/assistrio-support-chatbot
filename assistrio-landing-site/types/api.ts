/**
 * Typed envelopes for client-side API helpers (trial, quota, website registration).
 * Server helpers use the same types where applicable.
 */

export type TrialCreateRequest = {
  platformVisitorId: string;
  /** Full URL or hostname; API stores only the hostname. */
  allowedDomain: string;
  name?: string;
  welcomeMessage?: string;
  shortDescription?: string;
  description?: string;
  imageUrl?: string;
  avatarEmoji?: string;
};

export type TrialCreateResponse = {
  ok: true;
  platformVisitorId: string;
  stableIdentity: string;
  /** @deprecated Prefer platformVisitorId */
  visitorId: string;
  allowedDomain: string;
  bot: {
    id: string;
    slug: string;
    name: string;
    type: string;
    status: string;
    visibility: string;
    isPublic: boolean;
    accessKey: string;
    welcomeMessage?: string;
    imageUrl?: string;
    avatarEmoji?: string;
    messageLimitMode: string;
    messageLimitTotal: number | null;
    messageLimitUpgradeMessage?: string | null;
  };
};

/** Matches `VisitorsService.getPublicVisitorQuotaSummary` (public API). */
export type VisitorQuotaBuckets = {
  preview: { limit: number; used: number; remaining: number };
  trialRuntime: { limit: number; used: number; remaining: number };
  showcaseRuntime: { limit: number; used: number; remaining: number };
};

export type PublicVisitorQuotaSummaryResponse = {
  ok: true;
  platformVisitorId: string;
  quotas: VisitorQuotaBuckets;
};

/**
 * PV-safe public bot summary — `POST /api/public/visitor-bot/summary` (`VisitorsService.getPvSafeVisitorBotSummary`).
 * Not internal `/api/user/analytics` — see `ai-platform-backend/docs/ANALYTICS_BOUNDARIES.md`.
 */
export type PvVisitorBotSummaryResponse = {
  ok: true;
  platformVisitorId: string;
  bot: {
    id: string;
    name: string;
    slug: string;
    status: string;
    type: "visitor-own";
    allowedDomains: string[];
    /** Convenience: first allowlisted hostname pattern, if any */
    allowedDomain: string;
    createdAt: string | null;
    leadCaptureEnabled: boolean;
  };
  usage: {
    preview: VisitorQuotaBuckets["preview"];
    trialRuntime: { used: number; limit: number; remaining: number };
    showcaseRuntime: VisitorQuotaBuckets["showcaseRuntime"];
  };
};

/** `POST /api/public/visitor-bot/basic-insights` */
export type PvVisitorBotBasicInsightsResponse = {
  ok: true;
  platformVisitorId: string;
  botId: string;
  conversationCount: number;
  messageCount: number;
  leadCaptureEnabled: boolean;
  lastActivityAt: string | null;
};

/** `POST /api/public/visitor-bot/leads-summary` — counts only */
export type PvVisitorBotLeadsSummaryResponse = {
  ok: true;
  platformVisitorId: string;
  botId: string;
  conversationsWithCapturedLeads: number;
  totalLeadFieldsCaptured: number;
};

export type RegisterShowcaseWebsiteRequest = {
  botId: string;
  accessKey: string;
  secretKey?: string;
  platformVisitorId: string;
  /** Full URL or hostname; API stores only the hostname in `websiteUrl` on the allowlist row. */
  websiteUrl: string;
};

export type RegisterShowcaseWebsiteResponse = {
  ok: true;
  botId: string;
  platformVisitorWebsiteAllowlist: Array<{ platformVisitorId: string; websiteUrl: string }>;
};

export class AssistrioApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  /** Present on some API errors (e.g. widget-style hints); never contains secrets. */
  readonly deploymentHint?: string;
  /** Suggested wait before retry (e.g. HTTP 429 `RATE_LIMITED`). */
  readonly retryAfterSeconds?: number;
  readonly body: unknown;

  constructor(
    message: string,
    opts: {
      status: number;
      errorCode?: string;
      deploymentHint?: string;
      retryAfterSeconds?: number;
      body?: unknown;
    },
  ) {
    super(message);
    this.name = "AssistrioApiError";
    this.status = opts.status;
    this.errorCode = opts.errorCode;
    this.deploymentHint = opts.deploymentHint;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.body = opts.body;
  }
}
