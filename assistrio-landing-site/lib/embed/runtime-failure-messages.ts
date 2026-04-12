/**
 * Maps backend `/api/widget/init` `errorCode` values to short, non-secret explanations for docs and UI.
 * Keep in sync with `widget-init.controller.ts` and `runtime-deployment-hints.ts` (backend).
 */
export function describeRuntimeInitErrorCode(errorCode: string | undefined): {
  title: string;
  detail: string;
} | null {
  if (!errorCode) return null;
  const table: Record<string, { title: string; detail: string }> = {
    EMBED_ORIGIN_NOT_ALLOWED: {
      title: "This page origin is not allowed for this AI Agent",
      detail:
        "Add this page's exact origin (scheme + host + port) as an active allowed origin on the agent. If the browser blocked the request entirely, fix API CORS first.",
    },
    EMBED_ORIGIN_HEADER_REQUIRED: {
      title: "Origin header missing",
      detail:
        "The API needs the browser Origin header. Use a normal page load + fetch; check proxies forward Origin.",
    },
    EMBED_ORIGIN_INVALID: {
      title: "Origin could not be parsed",
      detail: "Ensure the page is served over a valid URL (https recommended for production).",
    },
    EMBED_NO_ALLOWLIST: {
      title: "AI Agent has no allowed origins configured",
      detail: "Configure at least one active allowed https origin for this AI Agent.",
    },
    BOT_OWNER_REQUIRED: {
      title: "AI Agent is missing workspace ownership",
      detail: "Runtime embed requires a migrated workspace-owned bot with ownerId set.",
    },
    BOT_NOT_FOUND: {
      title: "AI Agent not available",
      detail: "Check AI Agent id; it may be missing or not exposed for embed.",
    },
    BOT_NOT_PUBLISHED: {
      title: "AI Agent not published",
      detail: "Publish the AI Agent or fix visibility before runtime embed.",
    },
    INVALID_ACCESS_KEY: {
      title: "Invalid access key",
      detail: "Use the access key from public AI Agent detail — must match this AI Agent.",
    },
    INVALID_SECRET_KEY: {
      title: "Invalid or missing secret key",
      detail: "Private AI Agents may require secretKey in init (not in public landing snippets).",
    },
    RATE_LIMITED: {
      title: "Too many requests (rate limited)",
      detail:
        "The API returned 429 — wait retryAfterSeconds if present, then retry. This is per client IP as the API sees it (TRUST_PROXY behind load balancers). Not the same as CORS (no response body) or an allowed website 403.",
    },
  };
  return table[errorCode] ?? {
    title: "Widget init failed",
    detail: `Error code: ${errorCode}. Check the API response for deploymentHint if present.`,
  };
}
