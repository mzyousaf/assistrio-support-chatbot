import "server-only";

function resolveLandingSiteXApiKeyRaw(): string | undefined {
  return (
    process.env.LANDING_SITE_X_API_KEY?.trim() ||
    process.env.NEXT_ASSISTRIO_LANDING_SITE_X_API_KEY?.trim()
  );
}

/**
 * Server-only marketing → API secret (matches Nest `LANDING_SITE_X_API_KEY`). Not `NEXT_PUBLIC_*`.
 * Prefer `LANDING_SITE_X_API_KEY`.
 */
export function requireLandingSiteXApiKey(): string {
  const k = resolveLandingSiteXApiKeyRaw();
  if (!k) {
    throw new Error(
      "Missing LANDING_SITE_X_API_KEY (or NEXT_ASSISTRIO_LANDING_SITE_X_API_KEY). Must match Nest LANDING_SITE_X_API_KEY.",
    );
  }
  return k;
}

export function tryGetLandingSiteXApiKey(): string | undefined {
  return resolveLandingSiteXApiKeyRaw();
}
