import { Types } from 'mongoose';
import {
  CustomerTopicsAnalyticsService,
  type CustomerTopicsAnalyticsResponse,
} from './customer-topics-analytics.service';
import { PREVIEW_STARTED_FROM_VALUES } from './customer-chats-analytics.util';
import { TOPIC_LABELS } from './topic-sentiment-classification.constants';
import { TOPIC_ANALYTICS_KEYS } from './customer-topics-analytics.util';

function collectJsonKeys(value: unknown, out: Set<string>): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const x of value) collectJsonKeys(x, out);
    return;
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      out.add(k);
      collectJsonKeys((value as Record<string, unknown>)[k], out);
    }
  }
}

function makeSvc(msg: jest.Mock, conv: jest.Mock) {
  return new CustomerTopicsAnalyticsService({ aggregate: msg } as never, { aggregate: conv } as never);
}

describe('CustomerTopicsAnalyticsService', () => {
  const botId = new Types.ObjectId().toString();

  function makeMessageFacetRow(partial: {
    summary?: Array<{ totalUserMessages?: number; classifiedMessages?: number }>;
    convoWithTopics?: Array<{ n?: number }>;
    bucketTotals?: Array<{
      _id: Date;
      classifiedMessages?: number;
      unclassifiedMessages?: number;
    }>;
    mentionBuckets?: Array<{ _id: { bucket: Date; topic: string }; messages: number }>;
    topicBreakdownCombined?: Array<{ _id: string; messages: number; conversations: number }>;
    topicSentimentAgg?: Array<{
      _id: string;
      positive?: number;
      neutral?: number;
      negative?: number;
      mixed?: number;
      unknown?: number;
    }>;
  }) {
    return {
      summary: partial.summary ?? [],
      convoWithTopics: partial.convoWithTopics ?? [],
      bucketTotals: partial.bucketTotals ?? [],
      mentionBuckets: partial.mentionBuckets ?? [],
      topicBreakdownCombined: partial.topicBreakdownCombined ?? [],
      topicSentimentAgg: partial.topicSentimentAgg ?? [],
    };
  }

  function makeConversationFacetRow(partial: {
    topicBreakdownRows?: Array<{ _id: string; conversations: number }>;
    bucketRows?: Array<{ _id: { bucket: Date; topic: string }; conversations: number }>;
    totalWithPrimary?: Array<{ n?: number }>;
  }) {
    return {
      topicBreakdownRows: partial.topicBreakdownRows ?? [],
      bucketRows: partial.bucketRows ?? [],
      totalWithPrimary: partial.totalWithPrimary ?? [{ n: 0 }],
    };
  }

  /** Stub message + conversation aggregates. Optional `prev` for 3rd/4th calls (previous window). */
  function stubDualAggregates(
    messageAggregateMock: jest.Mock,
    conversationAggregateMock: jest.Mock,
    msgFull: ReturnType<typeof makeMessageFacetRow>,
    convFull: ReturnType<typeof makeConversationFacetRow>,
    prev?: {
      msgCombined?: Array<{ _id: string; messages: number; conversations: number }>;
      convRows?: Array<{ _id: string; conversations: number }>;
    },
  ) {
    let m = 0;
    messageAggregateMock.mockImplementation(async () => {
      m++;
      if (m === 1) return [msgFull];
      return [{ topicBreakdownCombined: prev?.msgCombined ?? [] }];
    });
    let c = 0;
    conversationAggregateMock.mockImplementation(async () => {
      c++;
      if (c === 1) return [convFull];
      return [
        {
          topicBreakdownRows: prev?.convRows ?? [],
          bucketRows: [],
          totalWithPrimary: [{ n: 0 }],
        },
      ];
    });
  }

  it('pipeline matches only user messages for the bot', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(msg, conv, makeMessageFacetRow({}), makeConversationFacetRow({}));
    const svc = makeSvc(msg, conv);
    await svc.get(botId, {});
    const pipeline = msg.mock.calls[0][0] as unknown[];
    const match = pipeline[0] as { $match: Record<string, unknown> };
    expect(match.$match).toMatchObject({
      role: 'user',
    });
    expect(match.$match.botId).toBeInstanceOf(Types.ObjectId);
    expect((match.$match.botId as Types.ObjectId).equals(new Types.ObjectId(botId))).toBe(true);
  });

  it('includePreview=false excludes preview startedFrom on conversation join', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(msg, conv, makeMessageFacetRow({}), makeConversationFacetRow({}));
    const svc = makeSvc(msg, conv);
    await svc.get(botId, { includePreview: 'false' });
    const pipeline = msg.mock.calls[0][0] as unknown[];
    const previewMatch = pipeline.find(
      (s) =>
        s &&
        typeof s === 'object' &&
        '_conv.startedFrom' in ((s as { $match?: Record<string, unknown> }).$match ?? {}),
    ) as { $match: Record<string, unknown> } | undefined;
    expect(previewMatch?.$match?.['_conv.startedFrom']).toEqual({
      $nin: [...PREVIEW_STARTED_FROM_VALUES],
    });
  });

  it('topic filter adds match on messageTopicTags before facet', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(msg, conv, makeMessageFacetRow({}), makeConversationFacetRow({}));
    const svc = makeSvc(msg, conv);
    await svc.get(botId, { topic: 'pricing' });
    const pipeline = msg.mock.calls[0][0] as unknown[];
    const facetIdx = pipeline.findIndex((s) => s && typeof s === 'object' && '$facet' in s);
    const topicMatch = pipeline
      .slice(0, facetIdx)
      .reverse()
      .find(
        (s) =>
          s &&
          typeof s === 'object' &&
          (s as { $match?: { messageTopicTags?: string } }).$match?.messageTopicTags === 'pricing',
      );
    expect(topicMatch).toBeDefined();
  });

  it('message aggregate facet includes topicSentimentAgg', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(msg, conv, makeMessageFacetRow({}), makeConversationFacetRow({}));
    const svc = makeSvc(msg, conv);
    await svc.get(botId, {});
    const pipeline = msg.mock.calls[0][0] as unknown[];
    const facetStage = pipeline.find((s) => s && typeof s === 'object' && '$facet' in s) as
      | { $facet: Record<string, unknown> }
      | undefined;
    expect(facetStage?.$facet?.topicSentimentAgg).toBeDefined();
    expect(Array.isArray(facetStage?.$facet?.topicSentimentAgg)).toBe(true);
  });

  it('topicSentimentBreakdown counts one negative message under each topic tag (multi-label)', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 1, classifiedMessages: 1 }],
        convoWithTopics: [{ n: 1 }],
        topicBreakdownCombined: [
          { _id: 'billing', messages: 1, conversations: 1 },
          { _id: 'refund', messages: 1, conversations: 1 },
        ],
        topicSentimentAgg: [
          { _id: 'billing', negative: 1, positive: 0, neutral: 0, mixed: 0, unknown: 0 },
          { _id: 'refund', negative: 1, positive: 0, neutral: 0, mixed: 0, unknown: 0 },
        ],
      }),
      makeConversationFacetRow({}),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const billing = res.topicSentimentBreakdown.find((r) => r.topic === 'billing');
    const refund = res.topicSentimentBreakdown.find((r) => r.topic === 'refund');
    expect(billing?.negative).toBe(1);
    expect(billing?.totalMessages).toBe(1);
    expect(refund?.negative).toBe(1);
    expect(refund?.totalMessages).toBe(1);
  });

  it('topicSentimentBreakdown maps missing sentiment label to unknown', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 2, classifiedMessages: 2 }],
        topicBreakdownCombined: [{ _id: 'billing', messages: 2, conversations: 1 }],
        topicSentimentAgg: [
          { _id: 'billing', unknown: 2, positive: 0, neutral: 0, negative: 0, mixed: 0 },
        ],
      }),
      makeConversationFacetRow({}),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const billing = res.topicSentimentBreakdown.find((r) => r.topic === 'billing');
    expect(billing?.unknown).toBe(2);
    expect(billing?.totalMessages).toBe(2);
  });

  it('topicSentimentBreakdown respects topic filter (only matching topic rows)', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 1, classifiedMessages: 1 }],
        topicBreakdownCombined: [{ _id: 'pricing', messages: 1, conversations: 1 }],
        topicSentimentAgg: [{ _id: 'pricing', negative: 1, positive: 0, neutral: 0, mixed: 0, unknown: 0 }],
      }),
      makeConversationFacetRow({}),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      topic: 'pricing',
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    expect(res.topicSentimentBreakdown).toHaveLength(1);
    expect(res.topicSentimentBreakdown[0]?.topic).toBe('pricing');
  });

  it('conversation pipeline applies topic filter on primaryTopicNorm', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(msg, conv, makeMessageFacetRow({}), makeConversationFacetRow({}));
    const svc = makeSvc(msg, conv);
    await svc.get(botId, { topic: 'pricing' });
    const pipelineJson = JSON.stringify(conv.mock.calls[0][0]);
    expect(pipelineJson).toContain('primaryTopicNorm');
    expect(pipelineJson).toContain('pricing');
  });

  it('computes classified vs unclassified, topic breakdown labels, and mention-based percentages', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 10, classifiedMessages: 3 }],
        convoWithTopics: [{ n: 2 }],
        bucketTotals: [],
        mentionBuckets: [],
        topicBreakdownCombined: [
          { _id: 'pricing', messages: 2, conversations: 2 },
          { _id: 'other', messages: 1, conversations: 1 },
        ],
      }),
      makeConversationFacetRow({
        topicBreakdownRows: [
          { _id: 'pricing', conversations: 1 },
          { _id: 'billing', conversations: 1 },
        ],
        totalWithPrimary: [{ n: 2 }],
      }),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    expect(res.summary.totalUserMessages).toBe(10);
    expect(res.summary.classifiedMessages).toBe(3);
    expect(res.summary.unclassifiedMessages).toBe(7);
    expect(res.summary.conversationsWithTopics).toBe(2);
    expect(res.summary.topicCoverageRate).toBe(0.3);
    const pricing = res.topicBreakdownByMessages.find((r) => r.topic === 'pricing');
    expect(pricing?.label).toBe(TOPIC_LABELS.pricing);
    expect(pricing?.percentage).toBeCloseTo((2 / 3) * 100, 1);
    const other = res.topicBreakdownByMessages.find((r) => r.topic === 'other');
    expect(other?.percentage).toBeCloseTo((1 / 3) * 100, 1);
    expect(res.topicBreakdownByConversations.find((r) => r.topic === 'pricing')?.conversations).toBe(1);
    expect(res.topicBreakdownByConversations.find((r) => r.topic === 'pricing')?.percentage).toBe(50);
  });

  it('topicBreakdownByMessages.messages are topic mentions (multi-label message counts each topic)', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 1, classifiedMessages: 1 }],
        convoWithTopics: [{ n: 1 }],
        topicBreakdownCombined: [
          { _id: 'billing', messages: 1, conversations: 1 },
          { _id: 'refund', messages: 1, conversations: 1 },
        ],
      }),
      makeConversationFacetRow({}),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    expect(res.summary.classifiedMessages).toBe(1);
    expect(res.topicBreakdownByMessages.find((t) => t.topic === 'billing')?.messages).toBe(1);
    expect(res.topicBreakdownByMessages.find((t) => t.topic === 'refund')?.messages).toBe(1);
    expect(res.topicBreakdownByMessages.reduce((s, t) => s + t.messages, 0)).toBe(2);
  });

  it('topicBreakdownByMessages.conversations counts unique chats per topic (message tags)', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 5, classifiedMessages: 5 }],
        convoWithTopics: [{ n: 1 }],
        topicBreakdownCombined: [{ _id: 'billing', messages: 5, conversations: 1 }],
      }),
      makeConversationFacetRow({}),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const billing = res.topicBreakdownByMessages.find((t) => t.topic === 'billing');
    expect(billing?.messages).toBe(5);
    expect(billing?.conversations).toBe(1);
  });

  it('fills empty time buckets when aggregate returns no series points', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 0, classifiedMessages: 0 }],
        bucketTotals: [],
        mentionBuckets: [],
      }),
      makeConversationFacetRow({ bucketRows: [] }),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-01-03T00:00:00.000Z',
      granularity: 'day',
    });
    expect(res.topicMessageTimeSeries).toHaveLength(3);
    expect(res.topicConversationTimeSeries).toHaveLength(3);
    for (const p of res.topicMessageTimeSeries) {
      expect(p.classifiedMessages).toBe(0);
      expect(p.unclassifiedMessages).toBe(0);
      for (const t of TOPIC_ANALYTICS_KEYS) {
        expect(p[t]).toBe(0);
      }
    }
    for (const p of res.topicConversationTimeSeries) {
      for (const t of TOPIC_ANALYTICS_KEYS) {
        expect(p[t]).toBe(0);
      }
    }
  });

  it('message time series uses mention buckets; conversation time series uses conversation primary buckets', async () => {
    const d = new Date('2024-06-01T12:00:00.000Z');
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 1, classifiedMessages: 1 }],
        convoWithTopics: [{ n: 1 }],
        bucketTotals: [{ _id: d, classifiedMessages: 1, unclassifiedMessages: 0 }],
        mentionBuckets: [{ _id: { bucket: d, topic: 'pricing' }, messages: 2 }],
        topicBreakdownCombined: [{ _id: 'pricing', messages: 2, conversations: 1 }],
      }),
      makeConversationFacetRow({
        topicBreakdownRows: [{ _id: 'pricing', conversations: 9 }],
        bucketRows: [{ _id: { bucket: d, topic: 'pricing' }, conversations: 9 }],
        totalWithPrimary: [{ n: 9 }],
      }),
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const day = res.topicMessageTimeSeries.find((p) => p.date.startsWith('2024-06-01'));
    expect(day?.classifiedMessages).toBe(1);
    expect(day?.pricing).toBe(2);
    const cday = res.topicConversationTimeSeries.find((p) => p.date.startsWith('2024-06-01'));
    expect(cday?.pricing).toBe(9);
  });

  it('response shape omits message content and ids', async () => {
    const d = new Date('2024-06-01T12:00:00.000Z');
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 1, classifiedMessages: 1 }],
        convoWithTopics: [{ n: 1 }],
        bucketTotals: [{ _id: d, classifiedMessages: 1, unclassifiedMessages: 0 }],
        mentionBuckets: [{ _id: { bucket: d, topic: 'pricing' }, messages: 1 }],
        topicBreakdownCombined: [{ _id: 'pricing', messages: 1, conversations: 1 }],
        topicSentimentAgg: [
          { _id: 'pricing', positive: 0, neutral: 0, negative: 1, mixed: 0, unknown: 0 },
        ],
      }),
      makeConversationFacetRow({
        topicBreakdownRows: [{ _id: 'pricing', conversations: 1 }],
        bucketRows: [{ _id: { bucket: d, topic: 'pricing' }, conversations: 1 }],
        totalWithPrimary: [{ n: 1 }],
      }),
    );
    const svc = makeSvc(msg, conv);
    const res: CustomerTopicsAnalyticsResponse = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const keys = new Set<string>();
    collectJsonKeys(res, keys);
    for (const bad of ['content', 'body', 'raw', 'prompt', 'messageId', '_id', 'reason']) {
      expect(keys.has(bad)).toBe(false);
    }
    expect(res.topicConversationTimeSeries.length).toBeGreaterThan(0);
    expect(Array.isArray(res.fastestGrowingByMessages)).toBe(true);
    expect(Array.isArray(res.fastestGrowingByConversations)).toBe(true);
    expect(res.topicSentimentBreakdown).toHaveLength(1);
    expect(Object.keys(res.topicSentimentBreakdown[0]!).sort()).toEqual([
      'label',
      'mixed',
      'negative',
      'neutral',
      'positive',
      'topic',
      'totalMessages',
      'unknown',
    ]);
  });

  it('returns fastestGrowingByMessages from previous equal-length window', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 30, classifiedMessages: 30 }],
        convoWithTopics: [{ n: 1 }],
        topicBreakdownCombined: [{ _id: 'pricing', messages: 30, conversations: 1 }],
      }),
      makeConversationFacetRow({
        topicBreakdownRows: [{ _id: 'pricing', conversations: 2 }],
        totalWithPrimary: [{ n: 2 }],
      }),
      {
        msgCombined: [{ _id: 'pricing', messages: 10, conversations: 1 }],
        convRows: [{ _id: 'pricing', conversations: 1 }],
      },
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-01-10T00:00:00.000Z',
      to: '2024-01-11T00:00:00.000Z',
      granularity: 'day',
      growthMetric: 'messages',
    });
    expect(msg.mock.calls.length).toBe(2);
    expect(conv.mock.calls.length).toBe(2);
    expect(res.fastestGrowingByMessages).toHaveLength(1);
    expect(res.fastestGrowingByMessages[0]?.topic).toBe('pricing');
    expect(res.fastestGrowingByMessages[0]?.change).toBe(20);
    expect(res.fastestGrowingByMessages[0]?.changePercent).toBeCloseTo(200, 1);
    expect(res.fastestGrowingByMessages[0]?.growthLabel).toBeNull();
    expect(res.fastestGrowingByConversations[0]?.currentCount).toBe(2);
    expect(res.fastestGrowingByConversations[0]?.previousCount).toBe(1);
    expect(res.fastestGrowingByConversations[0]?.changePercent).toBeCloseTo(100, 1);
  });

  it('fastestGrowingByConversations uses conversation primary counts, not message mentions', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 5, classifiedMessages: 5 }],
        convoWithTopics: [{ n: 3 }],
        topicBreakdownCombined: [{ _id: 'billing', messages: 5, conversations: 3 }],
      }),
      makeConversationFacetRow({
        topicBreakdownRows: [{ _id: 'billing', conversations: 3 }],
        totalWithPrimary: [{ n: 3 }],
      }),
      {
        msgCombined: [{ _id: 'billing', messages: 2, conversations: 1 }],
        convRows: [{ _id: 'billing', conversations: 1 }],
      },
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-02-01T00:00:00.000Z',
      to: '2024-02-02T00:00:00.000Z',
      granularity: 'day',
      growthMetric: 'conversations',
    });
    expect(res.fastestGrowingByConversations[0]?.currentCount).toBe(3);
    expect(res.fastestGrowingByConversations[0]?.previousCount).toBe(1);
    expect(res.fastestGrowingByConversations[0]?.changePercent).toBeCloseTo(200, 1);
  });

  it('fastestGrowingByMessages labels New when previous window had zero for that metric', async () => {
    const msg = jest.fn();
    const conv = jest.fn();
    stubDualAggregates(
      msg,
      conv,
      makeMessageFacetRow({
        summary: [{ totalUserMessages: 3, classifiedMessages: 3 }],
        convoWithTopics: [{ n: 1 }],
        topicBreakdownCombined: [{ _id: 'refund', messages: 3, conversations: 1 }],
      }),
      makeConversationFacetRow({ topicBreakdownRows: [], totalWithPrimary: [{ n: 0 }] }),
      { msgCombined: [], convRows: [] },
    );
    const svc = makeSvc(msg, conv);
    const res = await svc.get(botId, {
      from: '2024-03-01T00:00:00.000Z',
      to: '2024-03-02T00:00:00.000Z',
      granularity: 'day',
      growthMetric: 'messages',
    });
    expect(res.fastestGrowingByMessages[0]?.growthLabel).toBe('New');
    expect(res.fastestGrowingByMessages[0]?.changePercent).toBeNull();
  });
});
