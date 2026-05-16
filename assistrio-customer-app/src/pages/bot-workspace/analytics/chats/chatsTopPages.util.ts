import type { CustomerChatsAnalyticsTopPageRow } from '@/api/types';

export const CHATS_TOP_PAGES_UNKNOWN_LABEL = 'Unknown page';

export function stripUrlQueryAndHash(input: string): string {
  const t = input.trim();
  if (!t) return '';
  try {
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      const path = u.pathname === '/' ? '' : u.pathname;
      return `${u.host}${path}`.replace(/\/$/, '') || u.host;
    }
  } catch {
    /* fall through */
  }
  const q = t.indexOf('?');
  const hash = t.indexOf('#');
  let end = t.length;
  if (q >= 0) end = Math.min(end, q);
  if (hash >= 0) end = Math.min(end, hash);
  return end < t.length ? t.slice(0, end) : t;
}

export function isChatsTopPageUnknown(row: CustomerChatsAnalyticsTopPageRow): boolean {
  const lab = row.pageLabel?.trim() ?? '';
  const pg = row.page?.trim() ?? '';
  return (
    lab.toLowerCase() === CHATS_TOP_PAGES_UNKNOWN_LABEL.toLowerCase() ||
    pg.toLowerCase() === CHATS_TOP_PAGES_UNKNOWN_LABEL.toLowerCase()
  );
}

/** Full path for tooltips — no query or hash. */
export function chatsTopPageTooltipPath(row: CustomerChatsAnalyticsTopPageRow): string {
  if (isChatsTopPageUnknown(row)) return CHATS_TOP_PAGES_UNKNOWN_LABEL;
  const raw = row.page?.trim() || row.pageLabel?.trim() || '';
  return stripUrlQueryAndHash(raw);
}

/** Safe browsing URL for a top-page row; `null` for unknown or unparseable URLs. */
export function chatsTopPageHref(row: CustomerChatsAnalyticsTopPageRow): string | null {
  if (isChatsTopPageUnknown(row)) return null;
  const raw = row.page?.trim() || row.pageLabel?.trim() || '';
  if (!raw) return null;
  const cleaned = stripUrlQueryAndHash(raw);
  if (!cleaned || cleaned.startsWith('//')) return null;
  try {
    const u = /^https?:\/\//i.test(cleaned) ? new URL(cleaned) : new URL(`https://${cleaned}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Single-line display: host + path, truncated. */
export function chatsTopPageDisplayLine(row: CustomerChatsAnalyticsTopPageRow, maxLen = 44): string {
  if (isChatsTopPageUnknown(row)) return CHATS_TOP_PAGES_UNKNOWN_LABEL;
  const full = chatsTopPageTooltipPath(row);
  if (full.length <= maxLen) return full;
  return `${full.slice(0, maxLen - 3)}...`;
}

export function sortChatsTopPageRows(rows: CustomerChatsAnalyticsTopPageRow[]): CustomerChatsAnalyticsTopPageRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const aU = isChatsTopPageUnknown(a) ? 1 : 0;
    const bU = isChatsTopPageUnknown(b) ? 1 : 0;
    if (aU !== bU) return aU - bU;
    return b.conversations - a.conversations || b.messages - a.messages;
  });
  return copy;
}

export function hasTopPagesSignal(rows: CustomerChatsAnalyticsTopPageRow[]): boolean {
  return rows.some((r) => r.conversations > 0 || r.messages > 0);
}

/** Case-insensitive filter on page, label, origin, and normalized tooltip path. */
export function filterChatsTopPagesByQuery(
  rows: CustomerChatsAnalyticsTopPageRow[],
  query: string,
): CustomerChatsAnalyticsTopPageRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => {
    const hay = [
      row.page,
      row.pageLabel,
      row.websiteOrigin ?? '',
      chatsTopPageTooltipPath(row),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(needle);
  });
}

/** Modal filter: all rows, URLs captured only, or unknown page only. */
export type ChatsTopPagesModalKindFilter = 'all' | 'known' | 'unknown';

export function filterChatsTopPagesByKind(
  rows: CustomerChatsAnalyticsTopPageRow[],
  kind: ChatsTopPagesModalKindFilter,
): CustomerChatsAnalyticsTopPageRow[] {
  if (kind === 'all') return rows;
  if (kind === 'known') return rows.filter((r) => !isChatsTopPageUnknown(r));
  return rows.filter((r) => isChatsTopPageUnknown(r));
}

/** Modal sort (applied after search). Unknown pages stay last for numeric sorts. */
export type ChatsTopPagesModalSortMode = 'chats' | 'chats_asc' | 'messages' | 'messages_asc' | 'page';

export function applyChatsTopPagesModalSort(
  rows: CustomerChatsAnalyticsTopPageRow[],
  mode: ChatsTopPagesModalSortMode,
): CustomerChatsAnalyticsTopPageRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const aU = isChatsTopPageUnknown(a) ? 1 : 0;
    const bU = isChatsTopPageUnknown(b) ? 1 : 0;
    if (mode === 'page') {
      if (aU !== bU) return aU - bU;
      return chatsTopPageTooltipPath(a).localeCompare(chatsTopPageTooltipPath(b), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
    }
    if (aU !== bU) return aU - bU;
    switch (mode) {
      case 'chats':
        return b.conversations - a.conversations || b.messages - a.messages;
      case 'chats_asc':
        return a.conversations - b.conversations || a.messages - b.messages;
      case 'messages':
        return b.messages - a.messages || b.conversations - a.conversations;
      case 'messages_asc':
        return a.messages - b.messages || a.conversations - b.conversations;
      default: {
        const _exhaustive: never = mode;
        return _exhaustive;
      }
    }
  });
  return copy;
}
