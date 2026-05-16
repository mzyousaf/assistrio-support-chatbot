/**
 * Display helpers for customer analytics dashboards (safe for UI: no NaN/undefined/null leakage).
 */

const EM = '—';

function finiteNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

export function formatAnalyticsNumber(value: unknown, options?: Intl.NumberFormatOptions): string {
  const n = finiteNumber(value);
  if (n == null) return EM;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    ...options,
  }).format(n);
}

export function formatAnalyticsInteger(value: unknown): string {
  return formatAnalyticsNumber(value, { maximumFractionDigits: 0 });
}

/** Phrase for analytics UI: "0 chats", "1 chat", "N chats" (non-finite → em dash). */
export function formatAnalyticsChatsCountWithUnit(value: unknown): string {
  const n = finiteNumber(value);
  if (n == null) return EM;
  const c = Math.max(0, Math.trunc(n));
  const fmt = formatAnalyticsInteger(c);
  if (c === 1) return `${fmt} chat`;
  return `${fmt} chats`;
}

export function formatAnalyticsCredits(value: unknown): string {
  const n = finiteNumber(value);
  if (n == null) return EM;
  if (Math.abs(n - Math.round(n)) < 1e-9) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

/** Tooltip / sentence form — e.g. "36 credits" (uses em dash when not finite). */
export function formatAnalyticsCreditsWithUnit(value: unknown): string {
  const c = formatAnalyticsCredits(value);
  if (c === EM) return EM;
  return `${c} credits`;
}

/** Similarity / match scores from RAG (null → em dash). Plain numeric, not a percentage. */
export function formatAnalyticsScore(value: unknown): string {
  if (value == null) return EM;
  const n = finiteNumber(value);
  if (n == null) return EM;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Sentiment model scores (−1…1 style): not a percent; null → em dash. */
export function formatSentimentScoreDisplay(value: unknown): string {
  if (value == null) return EM;
  const n = finiteNumber(value);
  if (n == null) return EM;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export function formatAnalyticsDateLabel(
  iso: string | undefined | null,
  granularity: 'hour' | 'day' | 'week' | 'month',
): string {
  const s = typeof iso === 'string' ? iso.trim() : '';
  if (!s) return EM;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return EM;
  if (granularity === 'hour') {
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }
  if (granularity === 'month') {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  if (granularity === 'week') {
    const dayOnly = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    return `Week of ${dayOnly}`;
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** `YYYY-MM-DD ~ YYYY-MM-DD` for analytics headers; invalid input → empty string (never "Invalid Date"). */
export function formatAnalyticsRangeYmd(fromIso: string | undefined | null, toIso: string | undefined | null): string {
  const a = isoToYmdUtc(fromIso);
  const b = isoToYmdUtc(toIso);
  if (!a || !b) return '';
  return `${a} ~ ${b}`;
}

function isoToYmdUtc(iso: string | undefined | null): string {
  const s = typeof iso === 'string' ? iso.trim() : '';
  if (!s) return '';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** `part / whole` as a percent; whole ≤ 0 → em dash. */
export function formatPercent(part: unknown, whole: unknown, digits = 0): string {
  const p = finiteNumber(part) ?? 0;
  const w = finiteNumber(whole);
  if (w == null || w <= 0) return EM;
  const ratio = Math.min(1, Math.max(0, p / w));
  const pct = ratio * 100;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(pct)}%`;
}

/** Backend-style ratio in [0, 1] (e.g. conversion rate). */
export function formatAnalyticsRatioAsPercent(ratio: unknown, digits = 1): string {
  const r = finiteNumber(ratio);
  if (r == null) return EM;
  const pct = Math.min(100, Math.max(0, r * 100));
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(pct)}%`;
}
