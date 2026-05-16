/**
 * Shared validation for analytics date controls (local YYYY-MM-DD).
 * Invalid ranges are handled in API builders by falling back to defaults — this is for UI hints only.
 */
export function customYmdRangeIsValid(fromYmd: string, toYmd: string): boolean {
  const a = fromYmd?.trim();
  const b = toYmd?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return false;
  const from = new Date(`${a}T00:00:00`);
  const to = new Date(`${b}T00:00:00`);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return false;
  return from <= to;
}
