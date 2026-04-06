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
    EMBED_DOMAIN_NOT_ALLOWED: {
      title: "This website is not an allowed website for this AI Agent",
      detail:
        "Update the AI Agent's allowed websites (Explore evaluation) or showcase registration so this page's hostname matches. If the browser blocked the request entirely, fix API CORS first (see Runtime deployment callout).",
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
      title: "AI Agent has no allowed websites configured",
      detail: "Configure at least one allowed website (hostname or exact origin) for this AI Agent.",
    },
    TRIAL_PLATFORM_VISITOR_OWNER_MISMATCH: {
      title: "Wrong stable id for this Explore AI Support Agent",
      detail: "Use the same platformVisitorId as when the AI Support Agent was created, or reconnect with the saved id.",
    },
    PLATFORM_VISITOR_NOT_IN_BOT_ALLOWLIST: {
      title: "Visitor / URL not registered for this showcase AI Agent",
      detail: "Use register-website on the gallery detail page or fix allowed websites in the product admin.",
    },
    PLATFORM_VISITOR_WEBSITE_ORIGIN_MISMATCH: {
      title: "Page hostname does not match registration",
      detail:
        "The page’s hostname must match the hostname you registered for this platformVisitorId on this AI Agent (we store only the hostname, not path or query).",
    },
    SHOWCASE_RUNTIME_PLATFORM_VISITOR_ID_REQUIRED: {
      title: "Stable id required",
      detail: "Showcase runtime needs a real platformVisitorId in the widget config.",
    },
    TRIAL_RUNTIME_PLATFORM_VISITOR_ID_INVALID: {
      title: "Invalid stable id for Explore runtime",
      detail:
        'Explore runtime cannot use the reserved "anonymous" sentinel — the snippet must include your real platformVisitorId.',
    },
    VISITOR_ID_REQUIRED: {
      title: "platformVisitorId required",
      detail:
        "Explore evaluation AI Support Agents require platformVisitorId on init — include it in AssistrioChatConfig (same as AI Support Agent creation).",
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
      detail: "Use the access key from Explore success or public AI Agent detail — must match this AI Agent.",
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
