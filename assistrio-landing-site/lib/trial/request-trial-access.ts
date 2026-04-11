import type { TrialCtaOpenContext } from "@/lib/flows/trial-cta-types";

export type RequestTrialAccessInput = {
  platformVisitorId: string;
  name: string;
  email: string;
  cta: TrialCtaOpenContext;
};

export type RequestTrialAccessResult = {
  emailId: string;
};

/**
 * Calls landing `POST /api/trial/request-access` — persists lead + token on backend, sends magic-link email via Resend.
 */
export async function requestTrialAccess(input: RequestTrialAccessInput): Promise<RequestTrialAccessResult> {
  let res: Response;
  try {
    res = await fetch("/api/trial/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        platformVisitorId: input.platformVisitorId,
        name: input.name,
        email: input.email,
        cta: {
          label: input.cta.label,
          location: input.cta.location,
          href: input.cta.href,
          sourcePath: input.cta.sourcePath,
          showcaseSlug: input.cta.showcaseSlug,
          showcaseBotId: input.cta.showcaseBotId,
        },
      }),
    });
  } catch {
    const err = new Error(
      "We couldn’t reach the server. Check your connection and try again.",
    ) as Error & { errorCode?: string; status?: number; retryAfterSeconds?: number };
    err.errorCode = "NETWORK_ERROR";
    throw err;
  }

  let parsed: {
    ok?: boolean;
    emailId?: string;
    error?: string;
    errorCode?: string;
    retryAfterSeconds?: number;
  } = {};
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    const msg =
      typeof parsed.error === "string" && parsed.error.trim()
        ? parsed.error.trim()
        : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { errorCode?: string; status?: number; retryAfterSeconds?: number };
    err.errorCode = typeof parsed.errorCode === "string" ? parsed.errorCode : undefined;
    err.status = res.status;
    err.retryAfterSeconds =
      typeof parsed.retryAfterSeconds === "number" && Number.isFinite(parsed.retryAfterSeconds)
        ? parsed.retryAfterSeconds
        : undefined;
    throw err;
  }

  const emailId = typeof parsed.emailId === "string" ? parsed.emailId.trim() : "";
  if (!parsed.ok || !emailId) {
    const err = new Error("Unexpected response from server.") as Error & {
      errorCode?: string;
      status?: number;
      retryAfterSeconds?: number;
    };
    err.errorCode = "BACKEND_ERROR";
    err.status = res.status;
    throw err;
  }

  return { emailId };
}
