/**
 * Stable anonymous **platform** identity for Assistrio landing + embed flows.
 *
 * - Same value as backend `platformVisitorId`: ties trial ownership, quota, and (for showcase) runtime auth.
 * - Persisted in `localStorage` for return visits; `?platformVisitorId=` enables cross-device reconnect when the user pastes a saved id.
 * - **Not** `chatVisitorId`: chat/session lines are created by the widget/runtime — do not synthesize them here.
 *
 * Format matches backend validation: 6–120 chars `[a-zA-Z0-9._:-]`
 */
export const PLATFORM_VISITOR_ID_STORAGE_KEY = "platform_visitor_id";

const PLATFORM_VISITOR_ID_RE = /^[a-zA-Z0-9._:-]{6,120}$/;

export function isValidPlatformVisitorIdFormat(value: string): boolean {
  return PLATFORM_VISITOR_ID_RE.test(String(value ?? "").trim());
}

export function generatePlatformVisitorId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  throw new Error("crypto.randomUUID is not available in this environment.");
}

/**
 * Reads `platformVisitorId` from a URLSearchParams (e.g. `window.location.search`).
 * Returns trimmed value only if format-valid; otherwise `null`.
 */
export function parseValidPlatformVisitorIdFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  const raw = searchParams.get("platformVisitorId")?.trim();
  if (!raw) return null;
  return isValidPlatformVisitorIdFormat(raw) ? raw : null;
}
