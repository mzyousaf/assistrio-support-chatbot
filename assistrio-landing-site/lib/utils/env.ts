/**
 * Public Assistrio API base URL (no secrets). From `NEXT_PUBLIC_API_BASE_URL` only.
 * Used for server → Nest calls, embed `apiBaseUrl`, and browser calls where safe (e.g. widget init — not for keyed routes).
 */
export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "Missing NEXT_PUBLIC_API_BASE_URL. Copy .env.example to .env.local and set your Nest API origin (no trailing slash).",
    );
  }
  return raw.replace(/\/$/, "");
}

/**
 * Returns undefined instead of throwing — use for client UI fallbacks and optional browser calls.
 */
export function tryGetPublicApiBaseUrl(): string | undefined {
  try {
    return getPublicApiBaseUrl();
  } catch {
    return undefined;
  }
}
