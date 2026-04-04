/**
 * MongoDB-backed rate limits for **intentionally anonymous** HTTP surfaces (landing, widget bootstrap helpers).
 * Keys are `${prefix}:${clientIp}` — see {@link enforcePublicAnonymousRateLimit}.
 *
 * **IP extraction:** {@link getClientIpForRateLimit} → primarily `req.ip`. With Fastify `trustProxy: true` (`TRUST_PROXY=1`
 * in `main.ts`), `req.ip` reflects the **original client** from `X-Forwarded-For` when the connection is from a trusted
 * proxy. If `trustProxy` is off, `req.ip` is often the **load balancer** — all users may share one bucket (too strict) or
 * behavior may look random if multiple app instances see different forwarded headers.
 *
 * **NAT:** Many users behind one public IP share one bucket — expected for per-IP throttling.
 *
 * These limits reduce scraping and brute-force; they do **not** replace auth where data is sensitive.
 */
export const PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS = 60_000;

export const PUBLIC_ANONYMOUS_RATE_LIMITS = {
  /** POST /api/trial/bots — bot creation + visitor row side effects */
  trialCreatePerIpPerMinute: 12,
  /** POST /api/public/visitor-quota/summary — read-only but enumerable if ids leak */
  visitorQuotaSummaryPerIpPerMinute: 100,
  /** POST /api/public/visitor-bot/* — PV-safe owned-bot summaries */
  visitorBotPvPerIpPerMinute: 60,
  /** POST /api/widget/register-website — writes allowlist; still needs embed keys */
  registerWebsitePerIpPerMinute: 24,
  /** GET /api/public/bots */
  publicBotsListPerIpPerMinute: 120,
  /** GET /api/public/bots/:slug */
  publicBotsDetailPerIpPerMinute: 120,
  /** GET /api/public/landing/bots (also protected by API key) */
  landingBotsListPerIpPerMinute: 120,
} as const;

export const PUBLIC_ANON_RATE_PREFIX = {
  trialCreate: 'anon_pub:trial_create',
  visitorQuotaSummary: 'anon_pub:visitor_quota_summary',
  visitorBotPv: 'anon_pub:visitor_bot_pv',
  registerWebsite: 'anon_pub:register_website',
  publicBotsList: 'anon_pub:public_bots_list',
  publicBotsSlug: 'anon_pub:public_bots_slug',
  landingBotsList: 'anon_pub:landing_bots_list',
} as const;
