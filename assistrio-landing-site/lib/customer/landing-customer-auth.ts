import { tryGetPublicApiBaseUrl } from "@/lib/utils/env";

export type LandingCustomerSessionStatus = "loading" | "anonymous" | "authenticated";

/** Shape returned by `GET /api/customer/auth/session` (and legacy `/api/customer/me`). */
export type LandingCustomerMe = {
  id: string;
  email: string;
  role: string;
  workspaceIds: string[];
  workspaces?: Array<{ id: string; name: string }>;
  firstName?: string;
  lastName?: string;
  picture?: string;
};

/**
 * Customer product app origin (e.g. https://app.assistrio.com). Used for Dashboard links.
 * Trailing slash stripped.
 */
export function tryGetCustomerAppOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

export function buildCustomerGoogleAuthStartUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/$/, "")}/api/customer/auth/google`;
}

export function buildCustomerSessionUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/$/, "")}/api/customer/auth/session`;
}

/** @deprecated Prefer {@link buildCustomerSessionUrl}. Kept for callers not yet migrated. */
export function buildCustomerMeUrl(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/$/, "")}/api/customer/me`;
}

export function buildCustomerAppEntryUrl(appOrigin: string): string {
  return `${appOrigin.replace(/\/$/, "")}/`;
}

export type FetchLandingCustomerMeResult =
  | { ok: true; me: LandingCustomerMe }
  | { ok: false; anonymous: true }
  | { ok: false; error: string };

/**
 * Browser-only: credentialed session probe against the Nest API (`GET /api/customer/auth/session`).
 */
export async function fetchLandingCustomerMe(apiOrigin: string): Promise<FetchLandingCustomerMeResult> {
  const url = buildCustomerSessionUrl(apiOrigin);
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const body = (await res.json()) as unknown;
      if (
        body &&
        typeof body === "object" &&
        typeof (body as { id?: unknown }).id === "string" &&
        typeof (body as { email?: unknown }).email === "string"
      ) {
        return { ok: true, me: body as LandingCustomerMe };
      }
      return { ok: false, anonymous: true };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, anonymous: true };
    }
    return { ok: false, error: `Unexpected response (${res.status})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** API base for browser calls; undefined if marketing env is not wired. */
export function tryGetCustomerApiOriginForBrowser(): string | undefined {
  return tryGetPublicApiBaseUrl();
}
