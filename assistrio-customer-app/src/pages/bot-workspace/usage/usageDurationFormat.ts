/** Format audio duration for customer Usage (aggregate only). */
export function formatUsageAudioDurationSeconds(total: unknown): string {
  const n = typeof total === 'number' && Number.isFinite(total) ? total : NaN;
  if (!Number.isFinite(n) || n <= 0) return '—';
  const secs = Math.round(n);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
