/**
 * Conversation list timestamps — no extra date dependency (Intl + native Date).
 */

const absFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Short clock time for message rows (e.g. “4:32 PM”). */
const msgTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short',
});

export function formatConversationMessageTimeShort(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    return msgTimeFormatter.format(d);
  } catch {
    return '—';
  }
}

export function formatConversationAbsolute(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    return absFormatter.format(d);
  } catch {
    return '—';
  }
}

/** e.g. "6 May 2023 12:12 pm" (day — full month — year — en-GB time). */
export function formatConversationDateTimeDetailed(iso: string | null | undefined): string {
  if (iso == null || !String(iso).trim()) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  try {
    const datePart = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return `${datePart} ${timePart}`;
  } catch {
    return '—';
  }
}

const rtf =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null;

export function formatConversationRelative(iso: string | null | undefined, nowMs = Date.now()): string {
  if (iso == null || !String(iso).trim()) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const diffSec = Math.round((d.getTime() - nowMs) / 1000);
  const past = diffSec <= 0;
  const s = past ? -diffSec : diffSec;
  if (s < 45) return past ? 'just now' : 'in a moment';

  const diffMin = Math.floor(s / 60);
  if (diffMin < 60) {
    if (rtf) return rtf.format(past ? -diffMin : diffMin, 'minute');
    return past ? `${diffMin} min ago` : `in ${diffMin} min`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    if (rtf) return rtf.format(past ? -diffHr : diffHr, 'hour');
    return past ? `${diffHr} hour${diffHr === 1 ? '' : 's'} ago` : `in ${diffHr} hour${diffHr === 1 ? '' : 's'}`;
  }

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) {
    if (rtf) return rtf.format(past ? -diffDay : diffDay, 'day');
    return past ? `${diffDay} day${diffDay === 1 ? '' : 's'} ago` : `in ${diffDay} day${diffDay === 1 ? '' : 's'}`;
  }

  return formatConversationAbsolute(iso);
}
