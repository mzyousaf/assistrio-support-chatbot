/** Backend base URL – all API requests and trial/demo links use this (no dependency on platform app). */
const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_BASE_URL =
  typeof raw === "string" && raw.trim() !== ""
    ? raw.trim().replace(/\/$/, "")
    : "";

/**
 * Server-only secret; must match backend `LANDING_SITE_BOTS_API_KEY`.
 * Required for `/bots`: only `GET /api/public/landing/bots` with `X-API-Key` is used.
 */
const landingKeyRaw = process.env.LANDING_SITE_BOTS_API_KEY;
export const LANDING_SITE_BOTS_API_KEY =
  typeof landingKeyRaw === "string" && landingKeyRaw.trim() !== ""
    ? landingKeyRaw.trim()
    : "";
