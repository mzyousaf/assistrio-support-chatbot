import "server-only";

import { cookies } from "next/headers";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";
import { TRIAL_SESSION_COOKIE_NAME } from "@/lib/trial/trial-session-cookie";

export type ValidatedTrialDashboardSession = {
  platformVisitorId: string;
  emailNormalized: string;
  name?: string;
  sessionExpiresAt: string;
};

/**
 * Reads trial dashboard cookie and validates against Nest (server-to-server + `X-API-Key`).
 * Use from Server Components / Route Handlers under `/trial/*`.
 */
export async function validateTrialDashboardSession(): Promise<ValidatedTrialDashboardSession | null> {
  const raw = (await cookies()).get(TRIAL_SESSION_COOKIE_NAME)?.value;
  if (!raw?.trim()) return null;

  const res = await assistrioBackendFetchSafe("/api/landing/trial/session/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: raw.trim() }),
  });
  if (!res?.ok) return null;

  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!j || j.ok !== true) return null;

  const platformVisitorId = typeof j.platformVisitorId === "string" ? j.platformVisitorId.trim() : "";
  const emailNormalized = typeof j.emailNormalized === "string" ? j.emailNormalized.trim() : "";
  if (!platformVisitorId || !emailNormalized) return null;

  return {
    platformVisitorId,
    emailNormalized,
    name: typeof j.name === "string" && j.name.trim() ? j.name.trim() : undefined,
    sessionExpiresAt: typeof j.sessionExpiresAt === "string" ? j.sessionExpiresAt : "",
  };
}
