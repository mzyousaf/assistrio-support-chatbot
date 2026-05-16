import { describe, expect, it } from 'vitest';
import {
  formatAnalyticsCredits,
  formatAnalyticsCreditsWithUnit,
  formatAnalyticsDateLabel,
  formatAnalyticsChatsCountWithUnit,
  formatAnalyticsRangeYmd,
  formatAnalyticsInteger,
  formatAnalyticsNumber,
  formatAnalyticsRatioAsPercent,
  formatAnalyticsScore,
  formatPercent,
  formatSentimentScoreDisplay,
} from './analyticsFormat';

describe('analyticsFormat', () => {
  it('formatAnalyticsInteger maps bad values to em dash', () => {
    expect(formatAnalyticsInteger(NaN)).toBe('—');
    expect(formatAnalyticsInteger(undefined)).toBe('—');
    expect(formatAnalyticsInteger(Infinity)).toBe('—');
  });

  it('formatAnalyticsCredits trims near-integers', () => {
    expect(formatAnalyticsCredits(3)).toBe('3');
    expect(formatAnalyticsCredits(3.25)).toBe('3.25');
  });

  it('formatAnalyticsCreditsWithUnit appends credits label', () => {
    expect(formatAnalyticsCreditsWithUnit(3)).toBe('3 credits');
    expect(formatAnalyticsCreditsWithUnit(NaN)).toBe('—');
  });

  it('formatAnalyticsChatsCountWithUnit pluralizes chat', () => {
    expect(formatAnalyticsChatsCountWithUnit(0)).toBe('0 chats');
    expect(formatAnalyticsChatsCountWithUnit(1)).toBe('1 chat');
    expect(formatAnalyticsChatsCountWithUnit(2)).toBe('2 chats');
    expect(formatAnalyticsChatsCountWithUnit(undefined)).toBe('—');
  });

  it('formatAnalyticsDateLabel returns em dash for bad input', () => {
    expect(formatAnalyticsDateLabel('', 'day')).toBe('—');
    expect(formatAnalyticsDateLabel('not-a-date', 'day')).toBe('—');
  });

  it('formatAnalyticsDateLabel formats valid ISO in UTC', () => {
    expect(formatAnalyticsDateLabel('2026-05-14T00:00:00.000Z', 'day')).toMatch(/May/);
  });

  it('formatAnalyticsDateLabel formats hour buckets in UTC', () => {
    const s = formatAnalyticsDateLabel('2026-05-14T15:00:00.000Z', 'hour');
    expect(s).not.toBe('—');
    expect(s).toMatch(/May/);
  });

  it('formatAnalyticsRangeYmd returns YYYY-MM-DD ~ YYYY-MM-DD or empty for bad input', () => {
    expect(formatAnalyticsRangeYmd('2026-01-05T00:00:00.000Z', '2026-01-10T23:59:59.999Z')).toBe('2026-01-05 ~ 2026-01-10');
    expect(formatAnalyticsRangeYmd('', '2026-01-10T00:00:00.000Z')).toBe('');
    expect(formatAnalyticsRangeYmd('bad', '2026-01-10T00:00:00.000Z')).toBe('');
  });

  it('formatPercent returns em dash when whole is zero or non-finite', () => {
    expect(formatPercent(3, 0)).toBe('—');
    expect(formatPercent(3, NaN)).toBe('—');
  });

  it('formatAnalyticsRatioAsPercent formats finite ratios', () => {
    expect(formatAnalyticsRatioAsPercent(0.2412, 1)).toBe('24.1%');
    expect(formatAnalyticsRatioAsPercent(null, 1)).toBe('—');
  });

  it('formatAnalyticsScore returns em dash for null', () => {
    expect(formatAnalyticsScore(null)).toBe('—');
    expect(formatAnalyticsScore(undefined)).toBe('—');
  });

  it('formatAnalyticsScore formats finite numbers', () => {
    expect(formatAnalyticsScore(0.812345)).toMatch(/0/);
  });

  it('formatSentimentScoreDisplay maps null to em dash', () => {
    expect(formatSentimentScoreDisplay(null)).toBe('—');
    expect(formatSentimentScoreDisplay(undefined)).toBe('—');
  });

  it('formatSentimentScoreDisplay formats finite scores as plain numbers', () => {
    expect(formatSentimentScoreDisplay(0)).toBe('0');
    expect(formatSentimentScoreDisplay(-0.6)).toContain('0.6');
    expect(formatSentimentScoreDisplay(0.45)).toContain('0.45');
  });

  it('formatAnalyticsNumber returns em dash for non-finite', () => {
    expect(formatAnalyticsNumber(Infinity)).toBe('—');
    expect(formatAnalyticsNumber(undefined)).toBe('—');
  });
});
