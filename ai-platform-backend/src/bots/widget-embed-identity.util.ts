/**
 * Chat/session identity for embed HTTP APIs (`/api/chat/*`, `/api/widget/init`).
 *
 * Legacy JSON field `visitorId` is a **chat-only** alias for `chatVisitorId` on these routes.
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
