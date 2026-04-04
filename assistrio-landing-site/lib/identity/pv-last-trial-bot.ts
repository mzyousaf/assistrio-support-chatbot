/**
 * Browser-local convenience: remember the last trial bot id for the active `platformVisitorId`
 * so the landing trial page can offer a lightweight "resume summary" without a server-side account.
 *
 * - Not a security boundary — anyone with this browser profile can read it.
 * - Cleared automatically when the stored id does not match the active platform visitor id (e.g. after reconnect).
 * - PV-safe APIs still require `{ platformVisitorId, botId }` and verify ownership server-side.
 *
 * Do not use for internal analytics; do not mix with `/api/user/analytics/*`.
 */

import { isValidPlatformVisitorIdFormat } from "@/lib/identity/platform-visitor";

export const PV_LAST_TRIAL_BOT_STORAGE_KEY = "assistrio_pv_last_trial_bot";

export type PvLastTrialBotRef = {
  schemaVersion: 1;
  platformVisitorId: string;
  botId: string;
  savedAt: string;
};

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isLikelyMongoObjectId(value: string): boolean {
  return OBJECT_ID_RE.test(String(value ?? "").trim());
}

/**
 * Persist the latest visitor-owned trial bot reference for this browser (overwrites any previous).
 */
export function savePvLastTrialBotRef(platformVisitorId: string, botId: string): void {
  if (typeof window === "undefined") return;
  const pv = String(platformVisitorId ?? "").trim();
  const bid = String(botId ?? "").trim();
  if (!isValidPlatformVisitorIdFormat(pv) || !isLikelyMongoObjectId(bid)) return;

  const payload: PvLastTrialBotRef = {
    schemaVersion: 1,
    platformVisitorId: pv,
    botId: bid,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(PV_LAST_TRIAL_BOT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function parseStored(raw: string): PvLastTrialBotRef | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed == null || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (o.schemaVersion !== 1) return null;
  if (typeof o.platformVisitorId !== "string" || typeof o.botId !== "string") return null;
  if (typeof o.savedAt !== "string") return null;
  if (!isValidPlatformVisitorIdFormat(o.platformVisitorId)) return null;
  if (!isLikelyMongoObjectId(o.botId)) return null;
  return {
    schemaVersion: 1,
    platformVisitorId: o.platformVisitorId.trim(),
    botId: o.botId.trim(),
    savedAt: o.savedAt,
  };
}

/**
 * Returns the stored ref only if it matches the **active** platform visitor id; otherwise removes stale data.
 */
export function readPvLastTrialBotRefForActivePlatformVisitor(
  activePlatformVisitorId: string | null,
): PvLastTrialBotRef | null {
  if (typeof window === "undefined" || !activePlatformVisitorId) return null;
  const active = activePlatformVisitorId.trim();
  if (!isValidPlatformVisitorIdFormat(active)) return null;

  let raw: string | null;
  try {
    raw = localStorage.getItem(PV_LAST_TRIAL_BOT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const parsed = parseStored(raw);
  if (!parsed) {
    try {
      localStorage.removeItem(PV_LAST_TRIAL_BOT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  if (parsed.platformVisitorId !== active) {
    try {
      localStorage.removeItem(PV_LAST_TRIAL_BOT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }

  return parsed;
}

export function clearPvLastTrialBotRef(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PV_LAST_TRIAL_BOT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
