/**
 * Non-secret hints for 429 `RATE_LIMITED` responses — operator-facing only.
 * Distinguishes **IP-based throttling** from **per-visitor message quotas** (different `errorCode`s).
 */

export const RATE_LIMIT_DEPLOYMENT_HINTS = {
  /** Mongo-backed anonymous public routes (`enforcePublicAnonymousRateLimit`). */
  publicAnonymous:
    'Per client IP per rolling minute (see retryAfterSeconds). If all users hit this behind one corporate NAT, they share one bucket. Behind a reverse proxy, set TRUST_PROXY=1 on the API so the real client IP is used — otherwise the limiter may see only the proxy IP.',

  /** In-process per-IP limiter on embed init + chat domain gate (`consumeEmbedRuntimeRateLimitToken`). */
  embedRuntime:
    'Per client IP per minute for this embed path. Same TRUST_PROXY note as public limits. This limiter is in-memory per API instance — multi-instance deployments share Mongo for anonymous routes but embed buckets are per process unless configured otherwise.',

  /** Optional cross-reference — not sent alone. */
  notCors:
    'HTTP 429 with JSON means the request reached the API (unlike a browser CORS failure). Wait retryAfterSeconds and reduce burst traffic.',
} as const;
