/**
 * Identity resolution for **embed** HTTP APIs (`/api/chat/*`, `/api/widget/*`, `/api/trial/*`).
 *
 * Human-readable product mirror (landing + UX rules): `assistrio-landing-site/docs/PRODUCT_MODEL.md`.
 *
 * **Stable anonymous identity (reconnect / cross-device):**
 * - **`platformVisitorId`** is the stable saved id (client-generated; host app persists it).
 * - Reuse the **same** value in embed config on every device for the same quota/ownership bucket.
 * - **`localStorage` alone** does not sync across devices — copy the id into the snippet or use `?platformVisitorId=` on the landing URL.
 * - Sharing this id shares quota access; it is **not** implied by hostname alone.
 *
 * **Contracts (do not blur these):**
 * - `platformVisitorId` — ownership, quota, analytics, allowlist bypass. Never derive from chat identity.
 * - `chatVisitorId` — chat/session/history only.
 * - Legacy JSON field `visitorId` — **endpoint-specific** compat alias only; see each resolver’s JSDoc.
 *
 * **Embed runtime (separate concerns):**
 * - **Origin / domain** (embed domain gate + `allowedDomains` + optional per-visitor website allowlist) → *where* the widget may run.
 * - **platformVisitorId** → *whose* quota / ownership bucket (never inferred from domain alone).
 * - **chatVisitorId** → *which* conversation thread.
 */

/** User-owned non-showcase embed chat when the client omits `platformVisitorId` (not a real visitor row id). */
export const PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL = 'anonymous' as const;

export type EmbedCreatorType = 'visitor' | 'user';

/**
 * Format check for `platformVisitorId` on public/trial APIs (stable client-generated id).
 * Does not prove ownership — only rejects obviously invalid strings.
 */
export function isValidPlatformVisitorIdFormat(value: string): boolean {
  return /^[a-zA-Z0-9._:-]{6,120}$/.test(String(value ?? '').trim());
}

/**
 * Chat/session identity for `/api/chat/*` runtime routes.
 *
 * Legacy `visitorId` is **chat only** here — it must never feed platform/quota resolution.
 */
export function resolveEmbedChatVisitorIdFromBody(
  chatVisitorId: string | undefined,
  /** @deprecated Legacy alias for `chatVisitorId` on this route only. */
  legacyVisitorIdForChatOnly: string | undefined,
): string | undefined {
  const c = typeof chatVisitorId === 'string' ? chatVisitorId.trim() : '';
  const v = typeof legacyVisitorIdForChatOnly === 'string' ? legacyVisitorIdForChatOnly.trim() : '';
  if (c) return c;
  if (v) return v;
  return undefined;
}

/**
 * Platform identity for `/api/chat/*` embed runtime (trial owner match, quota, allowlist).
 *
 * Uses **only** the explicit `platformVisitorId` field — never legacy `visitorId`
 * (that field is reserved for chat on these routes).
 *
 * - Trial/visitor bots: caller must reject empty before owner match.
 * - User bots: empty becomes {@link PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL} (non-showcase embeds only; showcase is rejected later).
 */
export function resolveRuntimeEmbedPlatformVisitorIdForChat(params: {
  creatorType: EmbedCreatorType;
  platformVisitorId?: string;
}): string {
  const pv = typeof params.platformVisitorId === 'string' ? params.platformVisitorId.trim() : '';
  if (params.creatorType === 'visitor') {
    return pv;
  }
  return pv || PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL;
}

/**
 * Preview **`/init` only** — authorization input: legacy `visitorId` may alias `platformVisitorId`
 * when proving visitor-bot ownership.
 *
 * On preview **`/chat`**, do **not** pass legacy `visitorId` here — that field means **chat** identity
 * on the chat route, not platform auth. Use explicit `platformVisitorId` (or session) for `/chat` auth.
 *
 * Chat/session lines still use {@link resolveEmbedChatVisitorIdFromBody}.
 */
export function resolvePreviewInitPlatformVisitorIdForAuth(
  platformVisitorId: string | undefined,
  /** @deprecated Legacy alias for `platformVisitorId` on preview init only. */
  legacyVisitorIdForPreviewInitOnly: string | undefined,
): string | undefined {
  const p = typeof platformVisitorId === 'string' ? platformVisitorId.trim() : '';
  if (p) return p;
  const l = typeof legacyVisitorIdForPreviewInitOnly === 'string' ? legacyVisitorIdForPreviewInitOnly.trim() : '';
  return l || undefined;
}

/** True when `platformVisitorId` is non-empty and not the anonymous embed sentinel. */
export function isStrictPlatformVisitorIdentityForEmbedRuntime(pv: string): boolean {
  const s = String(pv ?? '').trim();
  return s.length > 0 && s !== PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL;
}

export type EmbedRuntimePlatformIdentityErrorCode =
  | 'SHOWCASE_RUNTIME_PLATFORM_VISITOR_ID_REQUIRED'
  | 'TRIAL_RUNTIME_PLATFORM_VISITOR_ID_INVALID';

/**
 * Enforces platform identity rules for **embed runtime** (`/api/widget/init`, `/api/chat/*`).
 * Domain/origin gates are applied separately — this is **only** about quota/ownership identity.
 */
export function getEmbedRuntimePlatformIdentityViolation(params: {
  botType: string;
  creatorType: EmbedCreatorType;
  resolvedPlatformVisitorId: string;
}): { ok: true } | { ok: false; errorCode: EmbedRuntimePlatformIdentityErrorCode; message: string } {
  const pv = String(params.resolvedPlatformVisitorId ?? '').trim();

  if (params.creatorType === 'visitor' && pv === PLATFORM_VISITOR_EMBED_ANONYMOUS_SENTINEL) {
    return {
      ok: false,
      errorCode: 'TRIAL_RUNTIME_PLATFORM_VISITOR_ID_INVALID',
      message:
        'Trial runtime requires a real platformVisitorId. The reserved value "anonymous" cannot be used for ownership or quota.',
    };
  }

  if (params.botType === 'showcase' && params.creatorType === 'user' && !isStrictPlatformVisitorIdentityForEmbedRuntime(pv)) {
    return {
      ok: false,
      errorCode: 'SHOWCASE_RUNTIME_PLATFORM_VISITOR_ID_REQUIRED',
      message:
        'Showcase bots require a stable platformVisitorId for runtime embed (the same id across all showcase agents for this site visitor). Add it to your widget config.',
    };
  }

  return { ok: true };
}
