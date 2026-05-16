import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_OVERVIEW_RANGE_DAYS,
  divideOrNull,
  knowledgeSourceTypeLabel,
  parseCustomerKnowledgeSourcesAnalyticsQuery,
  safeKnowledgeSourceUrlForAnalytics,
  sortKnowledgeSourceTypeKeys,
} from './customer-knowledge-sources-analytics.util';

describe('parseCustomerKnowledgeSourcesAnalyticsQuery', () => {
  it('defaults to last 30 days, day granularity, includePreview true', () => {
    const before = Date.now();
    const q = parseCustomerKnowledgeSourcesAnalyticsQuery({});
    const after = Date.now();
    expect(q.granularity).toBe('day');
    expect(q.includePreview).toBe(true);
    expect(q.sourceType).toBeUndefined();
    const span = q.to.getTime() - q.from.getTime();
    expect(span).toBeGreaterThanOrEqual(DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000 - 2000);
    expect(span).toBeLessThanOrEqual(DEFAULT_OVERVIEW_RANGE_DAYS * 24 * 60 * 60 * 1000 + (after - before) + 2000);
  });

  it('parses includePreview=false', () => {
    const q = parseCustomerKnowledgeSourcesAnalyticsQuery({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      includePreview: 'false',
    });
    expect(q.includePreview).toBe(false);
  });

  it('parses sourceType filter', () => {
    const q = parseCustomerKnowledgeSourcesAnalyticsQuery({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      sourceType: 'faq',
    });
    expect(q.sourceType).toBe('faq');
  });

  it('throws on invalid granularity', () => {
    expect(() =>
      parseCustomerKnowledgeSourcesAnalyticsQuery({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        granularity: 'nanoseconds',
      }),
    ).toThrow(BadRequestException);
  });

  it('throws on invalid sourceType', () => {
    expect(() =>
      parseCustomerKnowledgeSourcesAnalyticsQuery({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z',
        sourceType: 'nope',
      }),
    ).toThrow(BadRequestException);
  });
});

describe('knowledgeSourceTypeLabel', () => {
  it('maps manual_text', () => {
    expect(knowledgeSourceTypeLabel('manual_text')).toBe('Manual text');
  });
});

describe('sortKnowledgeSourceTypeKeys', () => {
  it('orders unknown last among known keys', () => {
    expect(sortKnowledgeSourceTypeKeys(['unknown', 'document', 'faq'])).toEqual(['document', 'faq', 'unknown']);
  });
});

describe('safeKnowledgeSourceUrlForAnalytics', () => {
  it('rejects non-http(s)', () => {
    expect(safeKnowledgeSourceUrlForAnalytics('s3://b/k')).toBe(null);
    expect(safeKnowledgeSourceUrlForAnalytics('file:///x')).toBe(null);
  });

  it('allows https', () => {
    expect(safeKnowledgeSourceUrlForAnalytics('https://docs.example.com/a')).toBe('https://docs.example.com/a');
  });
});

describe('divideOrNull', () => {
  it('returns null for zero denominator', () => {
    expect(divideOrNull(10, 0)).toBe(null);
  });

  it('divides when valid', () => {
    expect(divideOrNull(9, 3)).toBe(3);
  });
});
