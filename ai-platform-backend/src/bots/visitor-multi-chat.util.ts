/**
 * Saved-conversation cap per visitor: minimum 2 (current thread + at least one other slot).
 * Null means unlimited.
 */
export function normalizeVisitorMultiChatMax(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(2, n);
}
