import { describe, expect, it } from 'vitest';
import type {
  CustomerChatsAnalyticsStartedFromBreakdownItem,
  CustomerChatsAnalyticsTopPageRow,
} from '@/api/types';
import {
  CHATS_TOP_PAGES_UNKNOWN_LABEL,
  applyChatsTopPagesModalSort,
  chatsTopPageDisplayLine,
  chatsTopPageHref,
  chatsTopPageTooltipPath,
  filterChatsTopPagesByKind,
  filterChatsTopPagesByQuery,
  isChatsTopPageUnknown,
  sortChatsTopPageRows,
  stripUrlQueryAndHash,
} from './chatsTopPages.util';
import {
  friendlyWidgetSourceLabel,
  hasWidgetSourceSignal,
  normalizeWidgetSourceRows,
  sortWidgetSourceRows,
} from './chatsWidgetSource.util';

describe('chatsWidgetSource.util', () => {
  it('friendlyWidgetSourceLabel never exposes raw keys', () => {
    expect(friendlyWidgetSourceLabel('runtime_widget')).toBe('Chat Widget');
    expect(friendlyWidgetSourceLabel('shared_preview')).toBe('Shared Widget');
    expect(friendlyWidgetSourceLabel('playground_preview')).toBe('Playground Preview');
    expect(friendlyWidgetSourceLabel('runtime_iframe')).toBe('Iframe');
    expect(friendlyWidgetSourceLabel('unknown')).toBe('Unknown');
  });

  it('sortWidgetSourceRows puts unknown last and sorts by conversations', () => {
    const rows: CustomerChatsAnalyticsStartedFromBreakdownItem[] = [
      { key: 'unknown', label: 'x', conversations: 100, messages: 1 },
      { key: 'runtime_widget', label: 'x', conversations: 5, messages: 1 },
      { key: 'shared_preview', label: 'x', conversations: 10, messages: 1 },
    ];
    const sorted = sortWidgetSourceRows(normalizeWidgetSourceRows(rows));
    expect(sorted.map((r) => r.key)).toEqual(['shared_preview', 'runtime_widget', 'unknown']);
  });

  it('hasWidgetSourceSignal', () => {
    expect(hasWidgetSourceSignal([])).toBe(false);
    expect(hasWidgetSourceSignal([{ key: 'unknown', label: 'u', conversations: 0, messages: 0 }])).toBe(false);
    expect(hasWidgetSourceSignal([{ key: 'unknown', label: 'u', conversations: 1, messages: 0 }])).toBe(true);
  });
});

describe('chatsTopPages.util', () => {
  it('stripUrlQueryAndHash removes query and hash', () => {
    expect(stripUrlQueryAndHash('https://a.com/path?q=1#h')).toBe('a.com/path');
    expect(stripUrlQueryAndHash('host/page?x=1')).toBe('host/page');
  });

  it('isChatsTopPageUnknown matches API label', () => {
    const row: CustomerChatsAnalyticsTopPageRow = {
      page: CHATS_TOP_PAGES_UNKNOWN_LABEL,
      pageLabel: CHATS_TOP_PAGES_UNKNOWN_LABEL,
      websiteOrigin: null,
      conversations: 1,
      messages: 1,
    };
    expect(isChatsTopPageUnknown(row)).toBe(true);
  });

  it('sortChatsTopPageRows puts unknown pages last', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      {
        page: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        pageLabel: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        websiteOrigin: null,
        conversations: 99,
        messages: 1,
      },
      { page: 'a.com/x', pageLabel: 'a.com/x', websiteOrigin: 'a.com', conversations: 2, messages: 1 },
    ];
    const sorted = sortChatsTopPageRows(rows);
    expect(sorted[sorted.length - 1]?.page).toBe(CHATS_TOP_PAGES_UNKNOWN_LABEL);
  });

  it('chatsTopPageDisplayLine truncates safely', () => {
    const row: CustomerChatsAnalyticsTopPageRow = {
      page: `a.com/${'b'.repeat(60)}`,
      pageLabel: `a.com/${'b'.repeat(60)}`,
      websiteOrigin: 'a.com',
      conversations: 1,
      messages: 1,
    };
    const line = chatsTopPageDisplayLine(row, 20);
    expect(line.length).toBeLessThanOrEqual(20);
    expect(line.endsWith('...')).toBe(true);
  });

  it('chatsTopPageTooltipPath strips query from page', () => {
    const row: CustomerChatsAnalyticsTopPageRow = {
      page: 'shop.example.com/help?utm=1',
      pageLabel: 'shop.example.com/help',
      websiteOrigin: 'shop.example.com',
      conversations: 1,
      messages: 1,
    };
    expect(chatsTopPageTooltipPath(row)).not.toContain('?');
    expect(chatsTopPageTooltipPath(row)).toContain('shop.example.com');
  });

  it('chatsTopPageHref builds https URL for host/path', () => {
    const row: CustomerChatsAnalyticsTopPageRow = {
      page: 'shop.example.com/pricing',
      pageLabel: 'shop.example.com/pricing',
      websiteOrigin: 'shop.example.com',
      conversations: 1,
      messages: 1,
    };
    expect(chatsTopPageHref(row)).toBe('https://shop.example.com/pricing');
  });

  it('chatsTopPageHref preserves absolute https URLs', () => {
    const row: CustomerChatsAnalyticsTopPageRow = {
      page: 'https://shop.example.com/about',
      pageLabel: 'shop.example.com/about',
      websiteOrigin: 'shop.example.com',
      conversations: 1,
      messages: 1,
    };
    expect(chatsTopPageHref(row)).toBe('https://shop.example.com/about');
  });

  it('chatsTopPageHref returns null for unknown', () => {
    expect(
      chatsTopPageHref({
        page: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        pageLabel: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        websiteOrigin: null,
        conversations: 1,
        messages: 1,
      }),
    ).toBeNull();
  });
});

describe('filterChatsTopPagesByQuery', () => {
  it('filters by substring case-insensitively', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      { page: 'a.com/foo', pageLabel: 'a.com/foo', websiteOrigin: 'a.com', conversations: 1, messages: 1 },
      { page: 'b.com/bar', pageLabel: 'b.com/bar', websiteOrigin: 'b.com', conversations: 1, messages: 1 },
    ];
    expect(filterChatsTopPagesByQuery(rows, 'FOO')).toHaveLength(1);
    expect(filterChatsTopPagesByQuery(rows, 'FOO')[0]?.page).toBe('a.com/foo');
    expect(filterChatsTopPagesByQuery(rows, '')).toHaveLength(2);
  });
});

describe('filterChatsTopPagesByKind', () => {
  it('filters known vs unknown', () => {
    const known: CustomerChatsAnalyticsTopPageRow = {
      page: 'a.com/x',
      pageLabel: 'a.com/x',
      websiteOrigin: 'a.com',
      conversations: 1,
      messages: 1,
    };
    const unknown: CustomerChatsAnalyticsTopPageRow = {
      page: CHATS_TOP_PAGES_UNKNOWN_LABEL,
      pageLabel: CHATS_TOP_PAGES_UNKNOWN_LABEL,
      websiteOrigin: null,
      conversations: 2,
      messages: 1,
    };
    expect(filterChatsTopPagesByKind([known, unknown], 'all')).toHaveLength(2);
    expect(filterChatsTopPagesByKind([known, unknown], 'known')).toEqual([known]);
    expect(filterChatsTopPagesByKind([known, unknown], 'unknown')).toEqual([unknown]);
  });
});

describe('applyChatsTopPagesModalSort', () => {
  it('sorts by number of chats (most first)', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      { page: 'a.com/a', pageLabel: 'a.com/a', websiteOrigin: 'a.com', conversations: 2, messages: 99 },
      { page: 'b.com/b', pageLabel: 'b.com/b', websiteOrigin: 'b.com', conversations: 10, messages: 1 },
    ];
    const out = applyChatsTopPagesModalSort(rows, 'chats');
    expect(out[0]?.conversations).toBe(10);
  });

  it('sorts by number of chats (fewest first)', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      { page: 'a.com/a', pageLabel: 'a.com/a', websiteOrigin: 'a.com', conversations: 10, messages: 1 },
      { page: 'b.com/b', pageLabel: 'b.com/b', websiteOrigin: 'b.com', conversations: 2, messages: 99 },
    ];
    const out = applyChatsTopPagesModalSort(rows, 'chats_asc');
    expect(out[0]?.conversations).toBe(2);
  });

  it('sorts by number of messages (most first)', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      { page: 'a.com/a', pageLabel: 'a.com/a', websiteOrigin: 'a.com', conversations: 10, messages: 2 },
      { page: 'b.com/b', pageLabel: 'b.com/b', websiteOrigin: 'b.com', conversations: 1, messages: 50 },
    ];
    const out = applyChatsTopPagesModalSort(rows, 'messages');
    expect(out[0]?.messages).toBe(50);
  });

  it('sorts by number of messages (fewest first)', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      { page: 'a.com/a', pageLabel: 'a.com/a', websiteOrigin: 'a.com', conversations: 10, messages: 50 },
      { page: 'b.com/b', pageLabel: 'b.com/b', websiteOrigin: 'b.com', conversations: 1, messages: 5 },
    ];
    const out = applyChatsTopPagesModalSort(rows, 'messages_asc');
    expect(out[0]?.messages).toBe(5);
  });

  it('sorts by page A–Z with unknown last', () => {
    const rows: CustomerChatsAnalyticsTopPageRow[] = [
      {
        page: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        pageLabel: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        websiteOrigin: null,
        conversations: 99,
        messages: 1,
      },
      { page: 'z.com/x', pageLabel: 'z.com/x', websiteOrigin: 'z.com', conversations: 1, messages: 1 },
      { page: 'a.com/x', pageLabel: 'a.com/x', websiteOrigin: 'a.com', conversations: 1, messages: 1 },
    ];
    const out = applyChatsTopPagesModalSort(rows, 'page');
    expect(out.map((r) => r.page)).toEqual(['a.com/x', 'z.com/x', CHATS_TOP_PAGES_UNKNOWN_LABEL]);
  });
});
