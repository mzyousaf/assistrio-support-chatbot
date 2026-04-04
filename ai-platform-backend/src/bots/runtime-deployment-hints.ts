/**
 * Non-secret, operator-facing hints appended to some `/api/widget/init` error bodies as `deploymentHint`.
 * Helps distinguish **browser CORS** (no JSON body) from **embed domain / allowlist** failures (HTTP 403 with body).
 * Public runtime routes use **reflect-any-HTTPS-origin** CORS (`public-embed-cors-paths.util.ts`); this hint still
 * applies if Origin is missing, invalid, or non-HTTPS in production.
 *
 * @see `assistrio-landing-site/docs/RUNTIME_DEPLOYMENT.md`
 */

export const RUNTIME_INIT_DEPLOYMENT_HINTS = {
  /** When `Origin` header is missing or domain gate fails — CORS is a separate prerequisite for browser calls. */
  corsPrerequisite:
    'Browser cross-origin requests need a valid Origin (HTTPS in production). Public widget routes reflect allowed origins without listing each customer in CORS_EXTRA_ORIGINS. If you still see a CORS error, check HTTPS, preflight, and that this is not a strict route (e.g. preview). Embed authorization is separate (allowedDomains, keys, identity).',

  /** Domain gate failed: hostname not in bot rules. */
  embedDomain:
    'Ensure this page hostname is included in the bot allowedDomains (trial) or satisfy showcase allowlist / register-website rules. Scheme and port matter for exact: rules.',

  /** No allowlist configured on bot. */
  noAllowlist:
    'This bot has no valid allowedDomains rules. Configure at least one hostname or exact origin in the product/admin flow.',

  /** Origin header missing on request — non-browser or stripped proxy. */
  originHeader:
    'The API uses the browser Origin header for embed checks. Ensure the client is a normal browser fetch (not a server) and that proxies forward Origin.',

  /** Trial owner id mismatch. */
  trialOwner:
    'platformVisitorId must match the trial bot owner. Use the same id as trial creation, or reconnect in the landing app.',

  /** Showcase / allowlist visitor mismatch. */
  platformVisitorAllowlist:
    'For this bot, register the page URL for your platformVisitorId (showcase register-website) or fix the allowlist entry.',
} as const;
