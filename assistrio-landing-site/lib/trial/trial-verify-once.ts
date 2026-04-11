import { isTrialVerifyReasonKey, type TrialVerifyReasonKey } from "@/lib/trial/trial-verify-reasons";

export type TrialVerifyOnceOutcome =
  | { kind: "dashboard"; href: string }
  | { kind: "verify_reason"; reason: TrialVerifyReasonKey }
  | { kind: "unknown_redirect"; location: string }
  | { kind: "http_error"; status: number }
  | { kind: "aborted" };

const inflight = new Map<string, Promise<TrialVerifyOnceOutcome>>();

/** Set when we are navigating to the trial dashboard so late callers never show a false failure. */
const dashboardSucceeded = new Set<string>();

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Only same-origin relative paths under `/trial/` (no open redirects). */
function safeTrialRedirectHref(redirectTo: string, pageOrigin: string): string | null {
  const t = redirectTo.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (!t.startsWith("/trial/")) return null;
  return new URL(t, pageOrigin).href;
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (typeof e === "object" && e !== null && "name" in e && (e as { name?: string }).name === "AbortError") {
    return true;
  }
  return false;
}

async function parseVerifySessionResponse(res: Response, pageOrigin: string): Promise<TrialVerifyOnceOutcome> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (data && data.ok === true) {
      const raw = data.redirectTo;
      if (typeof raw === "string") {
        const href = safeTrialRedirectHref(raw, pageOrigin);
        if (href) {
          return { kind: "dashboard", href };
        }
      }
      return { kind: "verify_reason", reason: "error" };
    }
    if (data && data.ok === false) {
      const r = data.reason;
      if (typeof r === "string" && isTrialVerifyReasonKey(r)) {
        return { kind: "verify_reason", reason: r };
      }
      return { kind: "verify_reason", reason: "error" };
    }
  }

  if (REDIRECT_STATUSES.has(res.status)) {
    const loc = res.headers.get("Location");
    if (!loc) {
      return { kind: "verify_reason", reason: "error" };
    }
    const url = new URL(loc, pageOrigin);
    const reason = url.searchParams.get("reason");

    if (url.pathname.includes("/trial/verify") && reason) {
      return {
        kind: "verify_reason",
        reason: isTrialVerifyReasonKey(reason) ? reason : "error",
      };
    }

    if (url.pathname.includes("/trial/dashboard")) {
      return { kind: "dashboard", href: url.href };
    }

    return { kind: "unknown_redirect", location: loc };
  }

  return { kind: "http_error", status: res.status };
}

function verifySessionFetchInit(token: string): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
    credentials: "same-origin",
    redirect: "manual",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One retry on transient failures (common “first load error, refresh works”):
 * network errors before any response, or 502–504 from the route / gateway.
 * Does not retry logical failures (e.g. TOKEN_USED) — those return JSON 4xx with a body.
 */
async function executeVerify(token: string): Promise<TrialVerifyOnceOutcome> {
  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";

  const runFetch = () => fetch("/api/trial/verify-session", verifySessionFetchInit(token));

  let res: Response;
  try {
    res = await runFetch();
  } catch (e: unknown) {
    if (isAbortError(e)) {
      return { kind: "aborted" };
    }
    await delay(350);
    try {
      res = await runFetch();
    } catch {
      return { kind: "verify_reason", reason: "error" };
    }
  }

  let outcome = await parseVerifySessionResponse(res, pageOrigin);
  if (outcome.kind === "http_error" && outcome.status >= 502 && outcome.status <= 504) {
    await delay(350);
    try {
      res = await runFetch();
      outcome = await parseVerifySessionResponse(res, pageOrigin);
    } catch {
      /* keep first outcome */
    }
  }
  return outcome;
}

/**
 * Single-flight POST to `/api/trial/verify-session` per token (e.g. React Strict Mode remount duplicate effects).
 * Concurrent callers share one underlying `fetch` and the same parsed outcome.
 */
export function verifyTrialSessionOnce(token: string): Promise<TrialVerifyOnceOutcome> {
  const key = token.trim();
  if (!key) {
    return Promise.resolve({ kind: "verify_reason", reason: "missing" });
  }

  let p = inflight.get(key);
  if (!p) {
    p = executeVerify(key).finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, p);
  }
  return p;
}

export function markTrialVerifyDashboardSucceeded(token: string): void {
  dashboardSucceeded.add(token.trim());
}

export function hasTrialVerifyDashboardSucceeded(token: string): boolean {
  return dashboardSucceeded.has(token.trim());
}
