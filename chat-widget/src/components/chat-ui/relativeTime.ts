/**
 * Human-readable “time since message” for assistant replies (English, short form).
 * Uses coarse thresholds so we never show “0 minutes” / “0 weeks” etc.:
 * — “Just now” through 60s; first “minute” label at 61s+.
 * — Days 1–6, weeks 7–29, months 30–364, then years (approximate calendar steps).
 */
export function formatRelativeSendTime(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((nowMs - t) / 1000);
  if (sec <= 60) return "Just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? "1 day ago" : `${day} days ago`;

  if (day < 30) {
    const wk = Math.floor(day / 7);
    return wk === 1 ? "1 week ago" : `${wk} weeks ago`;
  }

  if (day < 365) {
    const mo = Math.floor(day / 30);
    return mo === 1 ? "1 month ago" : `${mo} months ago`;
  }

  const yr = Math.floor(day / 365);
  return yr === 1 ? "1 year ago" : `${yr} years ago`;
}
