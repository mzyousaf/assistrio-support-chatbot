/**
 * Operator-facing copy: how to tell **which layer** failed when runtime does not work from a customer origin.
 * Does not perform network checks — static guidance only. See also `runtime-failure-messages.ts` (errorCode → detail).
 */

export type RuntimeFailureLayer = {
  id: "cors" | "cdn" | "missing_api" | "domain_allowlist" | "identity" | "credentials" | "rate_limit";
  /** What you observe (DevTools / UI). */
  symptom: string;
  /** What to fix (no secrets). */
  fixHint: string;
};

/** Order matches typical triage: transport → config → server rules. */
export const RUNTIME_FAILURE_LAYERS: RuntimeFailureLayer[] = [
  {
    id: "missing_api",
    symptom: "Marketing site shows “configure NEXT_PUBLIC_ASSISTRIO_API_BASE_URL” or snippet is empty.",
    fixHint: "Build the landing app with the public API origin set; rebuild after changing env.",
  },
  {
    id: "cdn",
    symptom: "Network: assistrio-chat.js or .css failed (404, blocked, ERR_NAME_NOT_RESOLVED).",
    fixHint: "Check NEXT_PUBLIC_ASSISTRIO_WIDGET_* overrides; default is widget.assistrio.com.",
  },
  {
    id: "cors",
    symptom: "Network: preflight or request to the API fails with a CORS error; **no** JSON error body from init.",
    fixHint: "Add the **exact** page origin (https://host:port) to API CORS_EXTRA_ORIGINS. This is not the same as AI Agent allowedDomains.",
  },
  {
    id: "domain_allowlist",
    symptom: "Network: POST …/api/widget/init returns **403** with JSON containing errorCode (e.g. EMBED_DOMAIN_NOT_ALLOWED, PLATFORM_VISITOR_*).",
    fixHint: "Fix trial allowedDomain, showcase allowedDomains, or register-website URL vs this page origin.",
  },
  {
    id: "identity",
    symptom: "403 / 400 with errorCode TRIAL_PLATFORM_VISITOR_* or SHOWCASE_RUNTIME_PLATFORM_VISITOR_ID_REQUIRED.",
    fixHint: "Use the same platformVisitorId as trial creation; snippet must include the stable id.",
  },
  {
    id: "credentials",
    symptom: "403 with INVALID_ACCESS_KEY or AI Agent not found / unpublished.",
    fixHint: "Verify AI Agent id and access key match; the AI Agent must be published for embed.",
  },
  {
    id: "rate_limit",
    symptom:
      "HTTP **429** with JSON (`errorCode: RATE_LIMITED`, optional `retryAfterSeconds`) — **not** CORS (you got a response body).",
    fixHint:
      "Wait and retry. Limits are per client IP as the API sees it — set TRUST_PROXY=1 behind a load balancer or all users may share one IP bucket. Corporate NAT shares one bucket across users.",
  },
];
