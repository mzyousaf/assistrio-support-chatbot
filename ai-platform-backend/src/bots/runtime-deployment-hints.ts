/**
 * Non-secret, operator-facing hints appended to some `/api/widget/init` error bodies as `deploymentHint`.
 * Helps distinguish **browser CORS** (no JSON body) from **embed origin** failures (HTTP 403 with body).
 */

export const RUNTIME_INIT_DEPLOYMENT_HINTS = {
  corsPrerequisite:
    'Browser cross-origin requests need a valid Origin (HTTPS in production). Public widget routes reflect eligible HTTPS origins. If you still see a CORS error, check HTTPS, preflight, and that this is not a strict route (e.g. preview). Embed authorization is separate (allowedOrigins, keys).',

  embedDomain:
    'Add this page origin (exact string: scheme + host + port) as an active entry under the bot allowed origins in the admin app. Localhost is allowed automatically in development only.',

  originHeader:
    'The API uses the browser Origin header for embed checks. Ensure the client is a normal browser fetch (not a server) and that proxies forward Origin.',
} as const;
