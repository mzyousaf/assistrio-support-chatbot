import { describe, expect, it } from 'vitest';
import { resolveAnalyticsGranularity } from '@/lib/analyticsGranularity';
import {
  CHATS_ANALYTICS_DEFAULTS,
  buildChatsAnalyticsApiParams,
  chatsAnalyticsQueryIncludesPreviewFlag,
  computeDateRangeFromAnalyticsPreset,
  isoRangeForLastDays,
  isoRangeForLocalDateInputs,
  isoRangeForToday,
} from './chatsAnalyticsQuery';

describe('chatsAnalyticsQuery', () => {
  it('buildChatsAnalyticsApiParams maps includePreview false to query semantics', () => {
    const p = buildChatsAnalyticsApiParams({
      ...CHATS_ANALYTICS_DEFAULTS,
      includePreview: false,
    });
    expect(chatsAnalyticsQueryIncludesPreviewFlag(p)).toBe(true);
    expect(p.includePreview).toBe(false);
  });

  it('buildChatsAnalyticsApiParams omits optional filters when empty', () => {
    const p = buildChatsAnalyticsApiParams(CHATS_ANALYTICS_DEFAULTS);
    expect(p.startedFrom).toBeUndefined();
    expect(p.countryCode).toBeUndefined();
    expect(p.deviceType).toBeUndefined();
  });

  it('buildChatsAnalyticsApiParams sends country and allowed device types only', () => {
    const p = buildChatsAnalyticsApiParams({
      ...CHATS_ANALYTICS_DEFAULTS,
      countryCode: 'de',
      deviceType: 'Mobile',
    });
    expect(p.countryCode).toBe('DE');
    expect(p.deviceType).toBe('mobile');
  });

  it('buildChatsAnalyticsApiParams omits disallowed legacy device values', () => {
    const p = buildChatsAnalyticsApiParams({
      ...CHATS_ANALYTICS_DEFAULTS,
      deviceType: 'bot',
    });
    expect(p.deviceType).toBeUndefined();
  });

  it('buildChatsAnalyticsApiParams sends hour for today preset', () => {
    const p = buildChatsAnalyticsApiParams({ ...CHATS_ANALYTICS_DEFAULTS, preset: 'today' });
    const { from, to } = computeDateRangeFromAnalyticsPreset({ ...CHATS_ANALYTICS_DEFAULTS, preset: 'today' });
    expect(resolveAnalyticsGranularity(from, to)).toBe('hour');
    expect(p.granularity).toBe('hour');
  });

  it('buildChatsAnalyticsApiParams sends day for last 7 days (default) and 30-day preset', () => {
    const w = buildChatsAnalyticsApiParams({ ...CHATS_ANALYTICS_DEFAULTS, preset: '7d' });
    expect(w.granularity).toBe('day');
    const defaultPreset = buildChatsAnalyticsApiParams(CHATS_ANALYTICS_DEFAULTS);
    expect(defaultPreset.granularity).toBe('day');
    const m = buildChatsAnalyticsApiParams({ ...CHATS_ANALYTICS_DEFAULTS, preset: '30d' });
    expect(m.granularity).toBe('day');
  });

  it('buildChatsAnalyticsApiParams sends week for last 90 days', () => {
    const p = buildChatsAnalyticsApiParams({ ...CHATS_ANALYTICS_DEFAULTS, preset: '90d' });
    expect(p.granularity).toBe('week');
  });

  it('isoRangeForLastDays returns ISO strings', () => {
    const { from, to } = isoRangeForLastDays(7);
    expect(Number.isFinite(Date.parse(from))).toBe(true);
    expect(Number.isFinite(Date.parse(to))).toBe(true);
  });

  it('isoRangeForLocalDateInputs validates shape', () => {
    expect(isoRangeForLocalDateInputs('2026-01-10', '2026-01-05')).toBeNull();
    expect(isoRangeForLocalDateInputs('2026-01-01', '2026-01-02')).not.toBeNull();
  });

  it('isoRangeForToday returns same-calendar-day bounds', () => {
    const { from, to } = isoRangeForToday();
    expect(Number.isFinite(Date.parse(from))).toBe(true);
    expect(Number.isFinite(Date.parse(to))).toBe(true);
    const a = new Date(from);
    const b = new Date(to);
    expect(a.getFullYear()).toBe(b.getFullYear());
    expect(a.getMonth()).toBe(b.getMonth());
    expect(a.getDate()).toBe(b.getDate());
  });

  it('computeDateRangeFromAnalyticsPreset matches preset windows', () => {
    const t = computeDateRangeFromAnalyticsPreset({ preset: 'today', customFrom: '', customTo: '' });
    expect(resolveAnalyticsGranularity(t.from, t.to)).toBe('hour');
    const w = computeDateRangeFromAnalyticsPreset({ preset: '7d', customFrom: '', customTo: '' });
    expect(resolveAnalyticsGranularity(w.from, w.to)).toBe('day');
    const n = computeDateRangeFromAnalyticsPreset({ preset: '90d', customFrom: '', customTo: '' });
    expect(resolveAnalyticsGranularity(n.from, n.to)).toBe('week');
  });
});
