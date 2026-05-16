import { Types } from 'mongoose';
import {
  CustomerSentimentAnalyticsService,
  type CustomerSentimentAnalyticsResponse,
} from './customer-sentiment-analytics.service';
import { PREVIEW_STARTED_FROM_VALUES } from './customer-chats-analytics.util';
import { SENTIMENT_ANALYTICS_DISPLAY_LABELS } from './customer-sentiment-analytics.util';
import { SENTIMENT_ANALYTICS_KEYS } from './customer-sentiment-analytics.util';
import type { SentimentLabel } from './topic-sentiment-classification.constants';

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

describe('CustomerSentimentAnalyticsService', () => {
  const botId = new Types.ObjectId().toString();

  function makeService(
    messageRow: ReturnType<typeof makeMessageFacetRow>,
    conversationRow: ReturnType<typeof makeConversationFacetRow> = makeConversationFacetRow({}),
  ) {
    const messageAggregateMock = jest.fn().mockResolvedValue([messageRow]);
    const conversationAggregateMock = jest.fn().mockResolvedValue([conversationRow]);
    const svc = new CustomerSentimentAnalyticsService(
      { aggregate: messageAggregateMock } as never,
      { aggregate: conversationAggregateMock } as never,
    );
    return { svc, messageAggregateMock, conversationAggregateMock };
  }

  function makeMessageFacetRow(partial: {
    summary?: Array<{
      totalUserMessages?: number;
      classifiedMessages?: number;
      scoreSum?: number;
      scoreCount?: number;
      negativeMessages?: number;
      mixedMessages?: number;
    }>;
    timeSeries?: Array<
      Record<string, unknown> & {
        _id: Date;
        classifiedMessages?: number;
        unclassifiedMessages?: number;
        scoreSum?: number;
        scoreCount?: number;
      }
    >;
    sentimentBreakdown?: Array<{
      _id: string;
      messages: number;
      conversations: number;
      scoreSum: number;
      scoreCount: number;
    }>;
    startedFromBreakdown?: Array<{
      startedFrom: string;
      messages: number;
      conversations: number;
      scoreSum: number;
      scoreCount: number;
    }>;
  }) {
    return {
      summary: partial.summary ?? [],
      timeSeries: partial.timeSeries ?? [],
      sentimentBreakdown: partial.sentimentBreakdown ?? [],
      startedFromBreakdown: partial.startedFromBreakdown ?? [],
    };
  }

  function makeConversationFacetRow(partial: {
    conversationSentimentBreakdown?: Array<{ _id: string; conversations: number }>;
    conversationCounts?: Array<{
      totalConversations?: number;
      classifiedConversations?: number;
      unclassifiedConversations?: number;
    }>;
    conversationTimeSeriesSentiment?: Array<unknown>;
    conversationTimeSeriesClassified?: Array<unknown>;
    conversationTimeSeriesUnclassified?: Array<unknown>;
  }) {
    return {
      conversationSentimentBreakdown: partial.conversationSentimentBreakdown ?? [],
      conversationCounts: partial.conversationCounts ?? [
        { totalConversations: 0, classifiedConversations: 0, unclassifiedConversations: 0 },
      ],
      conversationTimeSeriesSentiment: partial.conversationTimeSeriesSentiment ?? [],
      conversationTimeSeriesClassified: partial.conversationTimeSeriesClassified ?? [],
      conversationTimeSeriesUnclassified: partial.conversationTimeSeriesUnclassified ?? [],
    };
  }

  const baseSenSums = Object.fromEntries(SENTIMENT_ANALYTICS_KEYS.map((s) => [s, 0])) as Record<
    SentimentLabel,
    number
  >;

  it('pipeline matches only user messages for the bot', async () => {
    const { svc, messageAggregateMock } = makeService(makeMessageFacetRow({}));
    await svc.get(botId, {});
    const pipeline = messageAggregateMock.mock.calls[0][0] as unknown[];
    const match = pipeline[0] as { $match: Record<string, unknown> };
    expect(match.$match).toMatchObject({
      role: 'user',
    });
    expect(match.$match.botId).toBeInstanceOf(Types.ObjectId);
    expect((match.$match.botId as Types.ObjectId).equals(new Types.ObjectId(botId))).toBe(true);
  });

  it('includePreview=false excludes preview startedFrom on conversation join', async () => {
    const { svc, messageAggregateMock } = makeService(makeMessageFacetRow({}));
    await svc.get(botId, { includePreview: 'false' });
    const pipeline = messageAggregateMock.mock.calls[0][0] as unknown[];
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

  it('sentiment filter adds match on sentimentNorm before message facet', async () => {
    const { svc, messageAggregateMock } = makeService(makeMessageFacetRow({}));
    await svc.get(botId, { sentiment: 'positive' });
    const pipeline = messageAggregateMock.mock.calls[0][0] as unknown[];
    const facetIdx = pipeline.findIndex((s) => s && typeof s === 'object' && '$facet' in s);
    const sentimentMatch = pipeline
      .slice(0, facetIdx)
      .reverse()
      .find(
        (s) =>
          s &&
          typeof s === 'object' &&
          (s as { $match?: { sentimentNorm?: string } }).$match?.sentimentNorm === 'positive',
      );
    expect(sentimentMatch).toBeDefined();
  });

  it('computes classified vs unclassified, labels, coverage, and dominant sentiment', async () => {
    const { svc } = makeService({
      summary: [
          {
            totalUserMessages: 10,
            classifiedMessages: 4,
            scoreSum: 0.4,
            scoreCount: 2,
            negativeMessages: 1,
            mixedMessages: 1,
          },
        ],
        timeSeries: [],
        sentimentBreakdown: [
          { _id: 'positive', messages: 2, conversations: 2, scoreSum: 0.8, scoreCount: 2 },
          { _id: 'negative', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 },
          { _id: 'mixed', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 },
        ],
        startedFromBreakdown: [],
    });
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    expect(res.summary.totalUserMessages).toBe(10);
    expect(res.summary.classifiedMessages).toBe(4);
    expect(res.summary.unclassifiedMessages).toBe(6);
    expect(res.summary.sentimentCoverageRate).toBe(0.4);
    expect(res.summary.negativeMessages).toBe(1);
    expect(res.summary.mixedMessages).toBe(1);
    expect(res.summary.dominantSentiment).toBe('positive');
    expect(res.summary.averageSentimentScore).toBe(0.2);
    const neu = res.sentimentBreakdown.find((r) => r.sentiment === 'neutral');
    expect(neu?.label).toBe(SENTIMENT_ANALYTICS_DISPLAY_LABELS.neutral);
    expect(neu?.messages).toBe(0);
    const pos = res.sentimentBreakdown.find((r) => r.sentiment === 'positive');
    expect(pos?.averageScore).toBe(0.4);
  });

  it('uses conversationSentimentBreakdown so one chat with multiple labels counts once as mixed', async () => {
    const { svc } = makeService(
      {
        summary: [
          {
            totalUserMessages: 3,
            classifiedMessages: 3,
            scoreSum: 0,
            scoreCount: 0,
            negativeMessages: 1,
            mixedMessages: 1,
          },
        ],
        timeSeries: [],
        sentimentBreakdown: [
          { _id: 'positive', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 },
          { _id: 'negative', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 },
          { _id: 'mixed', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 },
        ],
        startedFromBreakdown: [],
      },
      makeConversationFacetRow({
        conversationSentimentBreakdown: [{ _id: 'mixed', conversations: 1 }],
      }),
    );
    const res = await svc.get(botId, {});
    expect(res.summary.mixedConversations).toBe(1);
    expect(res.summary.negativeConversations).toBe(0);
    const pos = res.sentimentBreakdown.find((r) => r.sentiment === 'positive');
    const neg = res.sentimentBreakdown.find((r) => r.sentiment === 'negative');
    const mix = res.sentimentBreakdown.find((r) => r.sentiment === 'mixed');
    expect(pos?.conversations).toBe(0);
    expect(neg?.conversations).toBe(0);
    expect(mix?.conversations).toBe(1);
  });

  it('conversation time series counts each chat once in its start bucket with thread-level mixed label', async () => {
    const bucket = new Date('2024-06-01T00:00:00.000Z');
    const { svc } = makeService(
      {
        summary: [
          {
            totalUserMessages: 3,
            classifiedMessages: 3,
            scoreSum: 0,
            scoreCount: 0,
            negativeMessages: 1,
            mixedMessages: 1,
          },
        ],
        timeSeries: [],
        sentimentBreakdown: [
          { _id: 'positive', messages: 1, conversations: 0, scoreSum: 0, scoreCount: 0 },
          { _id: 'negative', messages: 1, conversations: 0, scoreSum: 0, scoreCount: 0 },
          { _id: 'mixed', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 },
        ],
        startedFromBreakdown: [],
      },
      makeConversationFacetRow({
        conversationSentimentBreakdown: [{ _id: 'mixed', conversations: 1 }],
        conversationCounts: [{ totalConversations: 1, classifiedConversations: 1, unclassifiedConversations: 0 }],
        conversationTimeSeriesSentiment: [{ _id: { bucket, s: 'mixed' }, conversations: 1 }],
        conversationTimeSeriesClassified: [{ _id: bucket, classifiedConversations: 1, scoreSum: 0, scoreCount: 0 }],
        conversationTimeSeriesUnclassified: [],
      }),
    );
    const res = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const point = res.conversationTimeSeries[0]!;
    expect(point.mixed).toBe(1);
    expect(point.positive).toBe(0);
    expect(point.negative).toBe(0);
    expect(point.neutral).toBe(0);
  });

  it('conversation pipeline matches chats by startedAt in range', async () => {
    const { svc, conversationAggregateMock } = makeService(makeMessageFacetRow({}));
    await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-07T00:00:00.000Z',
    });
    const pipeline = conversationAggregateMock.mock.calls[0][0] as unknown[];
    const startedMatch = pipeline.find(
      (s) =>
        s &&
        typeof s === 'object' &&
        (s as { $match?: { __convAt?: unknown } }).$match?.__convAt != null,
    ) as { $match: { __convAt: { $gte: Date; $lte: Date } } };
    expect(startedMatch.$match.__convAt.$gte).toBeInstanceOf(Date);
    expect(startedMatch.$match.__convAt.$lte).toBeInstanceOf(Date);
    const lookup = pipeline.find(
      (s) => s && typeof s === 'object' && '$lookup' in s && (s as { $lookup: { from?: string } }).$lookup?.from === 'messages',
    );
    expect(lookup).toBeDefined();
  });

  it('averageSentimentScore is null when no finite scores in summary', async () => {
    const { svc } = makeService({
      summary: [
          {
            totalUserMessages: 3,
            classifiedMessages: 1,
            scoreSum: 0,
            scoreCount: 0,
            negativeMessages: 0,
            mixedMessages: 0,
          },
        ],
        timeSeries: [],
        sentimentBreakdown: [{ _id: 'unknown', messages: 1, conversations: 1, scoreSum: 0, scoreCount: 0 }],
        startedFromBreakdown: [],
    });
    const res = await svc.get(botId, {});
    expect(res.summary.averageSentimentScore).toBeNull();
  });

  it('fills empty time buckets when aggregate returns no series points', async () => {
    const { svc } = makeService({
      summary: [{ totalUserMessages: 0, classifiedMessages: 0, scoreSum: 0, scoreCount: 0 }],
      timeSeries: [],
      sentimentBreakdown: [],
      startedFromBreakdown: [],
    });
    const res = await svc.get(botId, {
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-01-03T00:00:00.000Z',
      granularity: 'day',
    });
    expect(res.timeSeries).toHaveLength(3);
    expect(res.conversationTimeSeries).toHaveLength(3);
    for (const p of res.timeSeries) {
      expect(p.classifiedMessages).toBe(0);
      expect(p.averageSentimentScore).toBeNull();
      for (const s of SENTIMENT_ANALYTICS_KEYS) {
        expect(p[s]).toBe(0);
      }
    }
    for (const p of res.conversationTimeSeries) {
      expect(p.classifiedConversations).toBe(0);
      expect(p.unclassifiedConversations).toBe(0);
      expect(p.averageSentimentScore).toBeNull();
      for (const s of SENTIMENT_ANALYTICS_KEYS) {
        expect(p[s]).toBe(0);
      }
    }
  });

  it('response shape omits message content, reason, and ids', async () => {
    const { svc } = makeService({
      summary: [
          {
            totalUserMessages: 1,
            classifiedMessages: 1,
            scoreSum: 0.5,
            scoreCount: 1,
            negativeMessages: 0,
            mixedMessages: 0,
          },
        ],
        timeSeries: [
          {
            _id: new Date('2024-06-01T12:00:00.000Z'),
            classifiedMessages: 1,
            unclassifiedMessages: 0,
            scoreSum: 0.5,
            scoreCount: 1,
            ...baseSenSums,
            positive: 1,
          },
        ],
        sentimentBreakdown: [{ _id: 'positive', messages: 1, conversations: 1, scoreSum: 0.5, scoreCount: 1 }],
        startedFromBreakdown: [{ startedFrom: 'runtime_widget', messages: 1, conversations: 1, scoreSum: 0.5, scoreCount: 1 }],
    });
    const res: CustomerSentimentAnalyticsResponse = await svc.get(botId, {
      from: '2024-06-01T00:00:00.000Z',
      to: '2024-06-01T00:00:00.000Z',
      granularity: 'day',
    });
    const keys = new Set<string>();
    collectJsonKeys(res, keys);
    for (const bad of ['content', 'body', 'raw', 'prompt', 'messageId', '_id', 'reason']) {
      expect(keys.has(bad)).toBe(false);
    }
  });
});
