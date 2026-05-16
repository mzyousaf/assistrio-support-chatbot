const compactInt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/** Non-negative seconds → compact human duration (e.g. 75 → "1m 15s"); zero/invalid → "—". */
export function formatDurationSeconds(totalSeconds: number | null | undefined): string {
  const raw = typeof totalSeconds === 'number' && Number.isFinite(totalSeconds) ? totalSeconds : 0;
  const s = Math.max(0, raw);
  if (s <= 0) return '—';
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  if (m <= 0) return `${sec}s`;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

export function formatCompactNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  try {
    return compactInt.format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

/** Credit amount with light rounding (e.g. 1.5 credits). */
export function formatCreditAmount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const v = Math.round(n * 100) / 100;
  const label = v === 1 ? 'credit' : 'credits';
  return `${v} ${label}`;
}
