import { describe, expect, it } from 'vitest';
import { CHATS_TOP_PAGES_UNKNOWN_LABEL } from './chatsTopPages.util';
import { buildChatsTopPagesCsv } from './chatsTopPagesExport';

describe('buildChatsTopPagesCsv', () => {
  it('includes header and ranked rows with escaped fields', () => {
    const csv = buildChatsTopPagesCsv([
      {
        page: 'a.com/path',
        pageLabel: 'a.com/path',
        websiteOrigin: 'a.com',
        conversations: 3,
        messages: 10,
      },
      {
        page: 'b.com/x,name',
        pageLabel: 'b.com/x,name',
        websiteOrigin: 'b.com',
        conversations: 1,
        messages: 2,
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Rank');
    expect(lines[0]).toContain('Page path');
    expect(lines.some((l) => l.includes('"b.com/x,name"'))).toBe(true);
    expect(lines).toHaveLength(3);
  });

  it('orders unknown page last with Yes in last column', () => {
    const csv = buildChatsTopPagesCsv([
      {
        page: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        pageLabel: CHATS_TOP_PAGES_UNKNOWN_LABEL,
        websiteOrigin: null,
        conversations: 99,
        messages: 1,
      },
      { page: 'z.com/a', pageLabel: 'z.com/a', websiteOrigin: 'z.com', conversations: 2, messages: 1 },
    ]);
    const last = csv.split('\r\n').pop() ?? '';
    expect(last.endsWith('Yes')).toBe(true);
  });
});
