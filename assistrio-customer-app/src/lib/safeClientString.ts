/**
 * Safe one-line copy for UI (errors, API messages). Never returns "[object Object]" or raw control chars.
 */
export function safeClientString(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const t = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return t || fallback;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

/** Finite number for display, or null. */
export function safeFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function formatCountDisplay(value: unknown): string {
  const n = safeFiniteNumber(value);
  return n == null ? '—' : String(Math.round(n));
}
