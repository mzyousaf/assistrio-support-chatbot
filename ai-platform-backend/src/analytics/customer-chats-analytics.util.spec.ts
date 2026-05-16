import { BadRequestException } from '@nestjs/common';
import {
  ANALYTICS_UNKNOWN_PAGE_LABEL,
  DEFAULT_OVERVIEW_RANGE_DAYS,
  PREVIEW_STARTED_FROM_VALUES,
  enumerateBucketStarts,
  ledgerUsageTypeToMessageTypeKey,
  messageTypeLabel,
  normalizeAnalyticsPageUrl,
  normalizeAnalyticsWebsiteOrigin,
  normalizeConversationStartedFrom,
  parseCustomerChatsAnalyticsQuery,
  startedFromLabel,
  utcDayStart,
} from './customer-chats-analytics.util';

describe('PREVIEW_STARTED_FROM_VALUES', () => {
  it('lists preview keys used for includePreview=false filtering', () => {
    expect([...PREVIEW_STARTED_FROM_VALUES]).toEqual(['playground_preview', 'shared_preview']);
  });
});

describe('parseCustomerChatsAnalyticsQuery', () => {
  it('defaults to last 30 days, day granularity, includePreview true when empty', () => {
    const before = Date.now();
    const q = parseCustomerChatsAnalyticsQuery({});
    const after = Date.now();
    expect(q.granularity).toBe('day');
    expect(q.includePreview).toBe(true);
    const span = q.to.getTime() - q.from.getTime();
    expect(span).toBeGreaterThanOrEqual(DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000 - 2000);
    expect(span).toBeLessThanOrEqual(DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000 + (after - before) + 2000);
  });

  it('parses includePreview=false', () => {
    const q = parseCustomerChatsAnalyticsQuery({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      includePreview: 'false',
    });
    expect(q.includePreview).toBe(false);
  });

  it('throws on invalid granularity', () => {
    expect(() =>
      parseCustomerChatsAnalyticsQuery({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        granularity: 'quarter',
      }),
    ).toThrow(BadRequestException);
  });

  it('parses hour granularity', () => {
    const q = parseCustomerChatsAnalyticsQuery({
      from: '2026-05-14T00:00:00.000Z',
      to: '2026-05-14T23:59:59.999Z',
      granularity: 'hour',
    });
    expect(q.granularity).toBe('hour');
  });
});

describe('enumerateBucketStarts', () => {
  it('returns UTC hour buckets including empty hours', () => {
    const from = new Date('2026-01-10T10:15:00.000Z');
    const to = new Date('2026-01-10T12:45:00.000Z');
    const buckets = enumerateBucketStarts(from, to, 'hour');
    expect(buckets.map((d) => d.toISOString())).toEqual([
      '2026-01-10T10:00:00.000Z',
      '2026-01-10T11:00:00.000Z',
      '2026-01-10T12:00:00.000Z',
    ]);
  });

  it('returns one bucket per UTC day including empty middle days', () => {
    const from = new Date('2026-01-10T12:00:00.000Z');
    const to = new Date('2026-01-12T08:00:00.000Z');
    const buckets = enumerateBucketStarts(from, to, 'day');
    expect(buckets.map((d) => d.toISOString().slice(0, 10))).toEqual([
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
    ]);
  });

  it('aligns week buckets to Monday UTC', () => {
    const from = new Date('2026-01-14T00:00:00.000Z'); // Wednesday
    const to = new Date('2026-01-20T00:00:00.000Z');
    const buckets = enumerateBucketStarts(from, to, 'week');
    expect(buckets[0].toISOString()).toBe(new Date('2026-01-12T00:00:00.000Z').toISOString());
  });
});

describe('labels', () => {
  it('maps startedFrom to product labels', () => {
    expect(startedFromLabel('runtime_widget')).toBe('Runtime Widget');
    expect(startedFromLabel('playground_preview')).toBe('Playground Preview');
  });

  it('maps message type labels', () => {
    expect(messageTypeLabel('suggested_question')).toBe('Suggested Questions');
  });
});

describe('normalizeConversationStartedFrom', () => {
  it('treats empty as unknown', () => {
    expect(normalizeConversationStartedFrom(undefined)).toBe('unknown');
  });
});

describe('ledgerUsageTypeToMessageTypeKey', () => {
  it('maps ledger usage types without double-counting semantics at this layer', () => {
    expect(ledgerUsageTypeToMessageTypeKey('text_message')).toBe('text');
    expect(ledgerUsageTypeToMessageTypeKey('quick_reply_message')).toBe('text');
    expect(ledgerUsageTypeToMessageTypeKey('assistant_reply')).toBe('unknown');
  });
});

describe('utcDayStart', () => {
  it('normalizes to UTC midnight', () => {
    const d = new Date('2026-05-14T15:30:00.000Z');
    expect(utcDayStart(d).toISOString()).toBe('2026-05-14T00:00:00.000Z');
  });
});

describe('normalizeAnalyticsPageUrl', () => {
  it('strips query params and hash', () => {
    const r = normalizeAnalyticsPageUrl('https://shop.example.com/pricing?ref=abc#top');
    expect(r.page).toBe('shop.example.com/pricing');
    expect(r.pageLabel).toBe('shop.example.com/pricing');
    expect(r.page).not.toContain('?');
    expect(r.page).not.toContain('#');
  });

  it('trims trailing slash except root', () => {
    expect(normalizeAnalyticsPageUrl('https://example.com/blog/').page).toBe('example.com/blog');
    expect(normalizeAnalyticsPageUrl('https://example.com/').page).toBe('example.com');
  });

  it('returns Unknown page for missing or invalid URLs', () => {
    expect(normalizeAnalyticsPageUrl(undefined).pageLabel).toBe(ANALYTICS_UNKNOWN_PAGE_LABEL);
    expect(normalizeAnalyticsPageUrl('not a url %%').pageLabel).toBe(ANALYTICS_UNKNOWN_PAGE_LABEL);
  });
});

describe('normalizeAnalyticsWebsiteOrigin', () => {
  it('returns host only without path or query', () => {
    expect(normalizeAnalyticsWebsiteOrigin('https://example.com/path?q=1')).toBe('example.com');
  });
});
