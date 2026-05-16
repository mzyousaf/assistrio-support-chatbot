import { describe, expect, it } from 'vitest';
import {
  TOPICS_ANALYTICS_DEFAULTS,
  buildTopicsAnalyticsApiParams,
  topicsAnalyticsQueryIncludesPreviewFlag,
} from './topicsAnalyticsQuery';

describe('buildTopicsAnalyticsApiParams', () => {
  it('defaults to last 7 days preset', () => {
    expect(TOPICS_ANALYTICS_DEFAULTS.preset).toBe('7d');
  });

  it('does not send topic filter param from defaults', () => {
    const p = buildTopicsAnalyticsApiParams(TOPICS_ANALYTICS_DEFAULTS);
    expect(p.topic).toBeUndefined();
  });
  it('tracks includePreview false', () => {
    const p = buildTopicsAnalyticsApiParams({
      ...TOPICS_ANALYTICS_DEFAULTS,
      includePreview: false,
    });
    expect(topicsAnalyticsQueryIncludesPreviewFlag(p)).toBe(true);
  });

  it('defaults message topic scope to primary (main topic only)', () => {
    expect(TOPICS_ANALYTICS_DEFAULTS.messageTopicScope).toBe('primary');
  });

  it('sends messageTopicScope primary in messages mode with default UI state', () => {
    const p = buildTopicsAnalyticsApiParams(TOPICS_ANALYTICS_DEFAULTS);
    expect(p.messageTopicScope).toBe('primary');
  });

  it('sends messageTopicScope primary for conversations regardless of UI scope state', () => {
    const p = buildTopicsAnalyticsApiParams({
      ...TOPICS_ANALYTICS_DEFAULTS,
      metricMode: 'conversations',
      messageTopicScope: 'all',
    });
    expect(p.messageTopicScope).toBe('primary');
  });

  it('sends messageTopicScope primary in messages mode when primary-only scope is selected', () => {
    const p = buildTopicsAnalyticsApiParams({
      ...TOPICS_ANALYTICS_DEFAULTS,
      metricMode: 'messages',
      messageTopicScope: 'primary',
    });
    expect(p.messageTopicScope).toBe('primary');
  });

  it('omits messageTopicScope in messages mode when all topic tags scope is selected', () => {
    const p = buildTopicsAnalyticsApiParams({
      ...TOPICS_ANALYTICS_DEFAULTS,
      metricMode: 'messages',
      messageTopicScope: 'all',
    });
    expect(p.messageTopicScope).toBeUndefined();
  });

  it('sends startedFrom when a widget source is selected', () => {
    const p = buildTopicsAnalyticsApiParams({
      ...TOPICS_ANALYTICS_DEFAULTS,
      startedFrom: 'playground_preview',
    });
    expect(p.startedFrom).toBe('playground_preview');
  });

  it('uses today range when preset is today', () => {
    const p = buildTopicsAnalyticsApiParams({
      ...TOPICS_ANALYTICS_DEFAULTS,
      preset: 'today',
    });
    expect(Number.isFinite(Date.parse(p.from!))).toBe(true);
    expect(Number.isFinite(Date.parse(p.to!))).toBe(true);
    expect(new Date(p.to!).getTime()).toBeGreaterThanOrEqual(new Date(p.from!).getTime());
    expect(p.granularity).toBe('hour');
  });
});
