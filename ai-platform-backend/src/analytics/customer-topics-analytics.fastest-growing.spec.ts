import { TOPIC_LABELS, type TopicTaxonomyId } from './topic-sentiment-classification.constants';
import { TOPIC_ANALYTICS_KEYS } from './customer-topics-analytics.util';
import { computeFastestGrowingTopics } from './customer-topics-analytics.fastest-growing';

function labelForTopicId(id: TopicTaxonomyId): string {
  return TOPIC_LABELS[id] ?? id;
}

describe('computeFastestGrowingTopics', () => {
  it('compares current vs previous counts for the selected metric', () => {
    const curM = new Map([['pricing', 42]]);
    const curC = new Map([['pricing', 5]]);
    const prevM = new Map([['pricing', 20]]);
    const prevC = new Map([['pricing', 2]]);
    const rows = computeFastestGrowingTopics(
      'messages',
      TOPIC_ANALYTICS_KEYS,
      labelForTopicId,
      curM,
      curC,
      prevM,
      prevC,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.topic).toBe('pricing');
    expect(rows[0]?.currentCount).toBe(42);
    expect(rows[0]?.previousCount).toBe(20);
    expect(rows[0]?.change).toBe(22);
    expect(rows[0]?.changePercent).toBeCloseTo(110, 1);
    expect(rows[0]?.growthLabel).toBeNull();
    expect(rows[0]?.messages).toBe(42);
    expect(rows[0]?.conversations).toBe(5);
  });

  it('uses conversations metric when growthMetric is conversations', () => {
    const curM = new Map<string, number>();
    const curC = new Map([['billing', 10]]);
    const prevM = new Map<string, number>();
    const prevC = new Map([['billing', 4]]);
    const rows = computeFastestGrowingTopics(
      'conversations',
      TOPIC_ANALYTICS_KEYS,
      labelForTopicId,
      curM,
      curC,
      prevM,
      prevC,
    );
    expect(rows[0]?.currentCount).toBe(10);
    expect(rows[0]?.previousCount).toBe(4);
    expect(rows[0]?.changePercent).toBeCloseTo(150, 1);
  });

  it('marks New when previousCount is 0 and currentCount > 0', () => {
    const curM = new Map([['refund', 3]]);
    const curC = new Map([['refund', 1]]);
    const prevM = new Map<string, number>();
    const prevC = new Map<string, number>();
    const rows = computeFastestGrowingTopics(
      'messages',
      TOPIC_ANALYTICS_KEYS,
      labelForTopicId,
      curM,
      curC,
      prevM,
      prevC,
    );
    expect(rows[0]?.changePercent).toBeNull();
    expect(rows[0]?.growthLabel).toBe('New');
  });

  it('sorts positive changePercent before New with larger absolute change', () => {
    const curM = new Map([
      ['pricing', 11],
      ['billing', 100],
    ]);
    const curC = new Map<string, number>();
    const prevM = new Map([
      ['pricing', 10],
      ['billing', 0],
    ]);
    const prevC = new Map<string, number>();
    const rows = computeFastestGrowingTopics(
      'messages',
      TOPIC_ANALYTICS_KEYS,
      labelForTopicId,
      curM,
      curC,
      prevM,
      prevC,
    );
    expect(rows.map((r) => r.topic)).toEqual(['pricing', 'billing']);
  });

  it('excludes topics with non-positive change', () => {
    const curM = new Map([['pricing', 1]]);
    const curC = new Map<string, number>();
    const prevM = new Map([['pricing', 5]]);
    const prevC = new Map<string, number>();
    const rows = computeFastestGrowingTopics(
      'messages',
      TOPIC_ANALYTICS_KEYS,
      labelForTopicId,
      curM,
      curC,
      prevM,
      prevC,
    );
    expect(rows).toHaveLength(0);
  });

  it('limits to top N', () => {
    const curM = new Map([
      ['pricing', 20],
      ['billing', 19],
      ['refund', 18],
    ]);
    const curC = new Map<string, number>();
    const prevM = new Map([
      ['pricing', 10],
      ['billing', 10],
      ['refund', 10],
    ]);
    const prevC = new Map<string, number>();
    const rows = computeFastestGrowingTopics(
      'messages',
      TOPIC_ANALYTICS_KEYS,
      labelForTopicId,
      curM,
      curC,
      prevM,
      prevC,
      2,
    );
    expect(rows).toHaveLength(2);
  });
});
