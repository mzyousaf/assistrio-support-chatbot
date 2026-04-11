import "server-only";

import { requireLandingSiteXApiKey } from "@/lib/api/landing-site-server-key";
import { getPublicApiBaseUrl } from "@/lib/utils/env";

/**
 * Absolute Nest URL for `path` (must start with `/`, e.g. `/api/public/bots`).
 * Uses {@link getPublicApiBaseUrl} → `NEXT_PUBLIC_API_BASE_URL`.
 */
export function assistrioBackendAbsoluteUrl(path: string): string {
  const base = getPublicApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Server-side `fetch` to the Assistrio API. Always sends `X-API-Key` (and default `Accept: application/json` if omitted).
 * Do not use from client components — use same-origin `/api/*` route handlers that call this instead.
 */
export async function assistrioBackendFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = assistrioBackendAbsoluteUrl(path);
  const headers = new Headers(init?.headers);
  headers.set("X-API-Key", requireLandingSiteXApiKey());
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  return fetch(url, { ...init, headers });
}

export function isAssistrioBackendConfigError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const m = e.message;
  return (
    m.includes("Missing NEXT_PUBLIC_API_BASE_URL") ||
    m.includes("LANDING_SITE_X_API_KEY") ||
    m.includes("LANDING_SITE_X_API_KEY") ||
    m.includes("NEXT_ASSISTRIO_LANDING_SITE_X_API_KEY")
  );
}

/**
 * Like {@link assistrioBackendFetch}; returns `null` when base URL or `X-API-Key` env is missing (for App Router `503` responses).
 */
export async function assistrioBackendFetchSafe(path: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await assistrioBackendFetch(path, init);
  } catch (e) {
    if (isAssistrioBackendConfigError(e)) {
      return null;
    }
    throw e;
  }
}
