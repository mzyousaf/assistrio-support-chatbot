/**
 * Public Assistrio API base URL (no secrets). Used by server routes fetching public bots
 * and by browser calls for trial / quota / widget registration.
 */
export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_ASSISTRIO_API_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "Missing NEXT_PUBLIC_ASSISTRIO_API_BASE_URL. Copy .env.example to .env.local and set your backend origin.",
    );
  }
  return raw.replace(/\/$/, "");
}

/**
 * Returns undefined instead of throwing — use when rendering a friendly “not configured” state.
 */
export function tryGetPublicApiBaseUrl(): string | undefined {
  try {
    return getPublicApiBaseUrl();
  } catch {
    return undefined;
  }
}
