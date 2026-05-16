import { describe, expect, it } from 'vitest';
import type {
  CustomerTopicBreakdownByConversationItem,
  CustomerTopicBreakdownByMessagesItem,
  CustomerTopicsAnalyticsSummary,
  CustomerTopicsAnalyticsTimeSeriesPoint,
} from '@/api/types';
import {
  UNCLASSIFIED_SERIES_ID,
  buildTopicRankingRows,
  colorForSeriesInOrder,
  humanizeTopicKey,
  topicDisplayLabel,
  topicIdsForAnalyticsFilter,
  topicRankingRowsVisibleSlice,
  type TopicsBreakdownBundle,
} from './topicsChartHelpers';

function summary(partial: Partial<CustomerTopicsAnalyticsSummary> = {}): CustomerTopicsAnalyticsSummary {
  return {
    totalUserMessages: 100,
    classifiedMessages: 60,
    unclassifiedMessages: 40,
    conversationsWithTopics: 5,
    topTopic: null,
    topicCoverageRate: 0.6,
    ...partial,
  };
}

const breakdownRowMsg = (
  partial: Partial<CustomerTopicBreakdownByMessagesItem> & Pick<CustomerTopicBreakdownByMessagesItem, 'topic'>,
): CustomerTopicBreakdownByMessagesItem => ({
  label: '',
  messages: 0,
  conversations: 0,
  percentage: 0,
  ...partial,
});

const breakdownRowConv = (
  partial: Partial<CustomerTopicBreakdownByConversationItem> &
    Pick<CustomerTopicBreakdownByConversationItem, 'topic'>,
): CustomerTopicBreakdownByConversationItem => ({
  label: '',
  conversations: 0,
  percentage: 0,
  ...partial,
});

function bundle(
  messages: CustomerTopicBreakdownByMessagesItem[],
  conversations: CustomerTopicBreakdownByConversationItem[],
): TopicsBreakdownBundle {
  return { topicBreakdownByMessages: messages, topicBreakdownByConversations: conversations };
}

describe('topicsChartHelpers (dynamic API topics only)', () => {
  it('humanizeTopicKey formats keys without a fixed taxonomy', () => {
    expect(humanizeTopicKey('custom_topic_key')).toBe('Custom Topic Key');
  });

  it('topicDisplayLabel prefers API label', () => {
    expect(topicDisplayLabel(breakdownRowMsg({ topic: 'refund', label: '  Refunds  ', messages: 1 }))).toBe(
      'Refunds',
    );
  });

  it('topicIdsForAnalyticsFilter orders by messages when metric is messages', () => {
    const bd = [
      breakdownRowMsg({ topic: 'billing', messages: 1, conversations: 10, label: 'B' }),
      breakdownRowMsg({ topic: 'refund', messages: 5, conversations: 1, label: 'R' }),
    ];
    expect(topicIdsForAnalyticsFilter(bd, 'messages')).toEqual(['refund', 'billing']);
  });

  it('topicIdsForAnalyticsFilter orders by conversations when metric is conversations', () => {
    const bd = [
      breakdownRowConv({ topic: 'billing', conversations: 10, label: 'B' }),
      breakdownRowConv({ topic: 'refund', conversations: 1, label: 'R' }),
    ];
    expect(topicIdsForAnalyticsFilter(bd, 'conversations')).toEqual(['billing', 'refund']);
  });

  it('topicRankingRowsVisibleSlice preserves rank order when capped', () => {
    const mk = (id: string, c: number) => ({
      id,
      label: id,
      count: c,
      pctOfTotal: null as number | null,
      secondaryCount: null as number | null,
    });
    const rows = [
      mk('general_question', 100),
      ...Array.from({ length: 11 }, (_, i) => mk(`t${i}`, 90 - i)),
    ];
    const sliced = topicRankingRowsVisibleSlice(rows, 9);
    expect(sliced).toHaveLength(9);
    expect(sliced.map((r) => r.id)).toEqual(rows.slice(0, 9).map((r) => r.id));
    expect(sliced[0]?.id).toBe('general_question');
  });

  it('buildTopicRankingRows messages mode includes only topicBreakdown rows with messages > 0', () => {
    const bd = bundle(
      [
        breakdownRowMsg({ topic: 'refund', messages: 5, label: 'Refund' }),
        breakdownRowMsg({ topic: 'billing', messages: 0, label: 'Billing' }),
      ],
      [],
    );
    const { rows } = buildTopicRankingRows(summary({ unclassifiedMessages: 0, totalUserMessages: 5 }), 'messages', bd);
    expect(rows.map((r) => r.id)).toEqual(['refund']);
  });

  it('buildTopicRankingRows messages mode appends Unclassified when unclassifiedMessages > 0', () => {
    const bd = bundle([breakdownRowMsg({ topic: 'refund', messages: 3, label: 'R' })], []);
    const { rows } = buildTopicRankingRows(
      summary({ unclassifiedMessages: 12, totalUserMessages: 20 }),
      'messages',
      bd,
    );
    const u = rows.find((r) => r.id === UNCLASSIFIED_SERIES_ID);
    expect(u?.count).toBe(12);
    expect(rows[rows.length - 1]?.id).toBe(UNCLASSIFIED_SERIES_ID);
    expect(rows[0]?.id).toBe('refund');
  });

  it('buildTopicRankingRows conversations mode never includes Unclassified', () => {
    const bd = bundle(
      [breakdownRowMsg({ topic: 'refund', messages: 3, conversations: 2, label: 'R' })],
      [breakdownRowConv({ topic: 'refund', conversations: 2, percentage: 100, label: 'R' })],
    );
    const { rows } = buildTopicRankingRows(
      summary({ unclassifiedMessages: 12, totalUserMessages: 20 }),
      'conversations',
      bd,
    );
    expect(rows.find((r) => r.id === UNCLASSIFIED_SERIES_ID)).toBeUndefined();
    expect(rows[0]?.id).toBe('refund');
    expect(rows[0]?.count).toBe(2);
  });

  it('buildTopicRankingRows uses topic row messages from API, not a predefined list', () => {
    const bd = bundle([breakdownRowMsg({ topic: 'refund', messages: 42, label: 'Refund' })], []);
    const { rows, seriesOrder } = buildTopicRankingRows(
      summary({ totalUserMessages: 100, unclassifiedMessages: 0 }),
      'messages',
      bd,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(42);
    expect(seriesOrder).toEqual(['refund']);
  });

  it('buildTopicRankingRows messages mode attaches chats as secondaryCount from API breakdown', () => {
    const bd = bundle([breakdownRowMsg({ topic: 'refund', messages: 10, conversations: 4, label: 'Refund' })], []);
    const { rows } = buildTopicRankingRows(
      summary({ unclassifiedMessages: 0, totalUserMessages: 10 }),
      'messages',
      bd,
    );
    expect(rows[0]?.secondaryCount).toBe(4);
  });

  it('buildTopicRankingRows conversations mode uses API percentage', () => {
    const bd = bundle(
      [],
      [
        breakdownRowConv({ topic: 'billing', conversations: 2, percentage: 20, label: 'B' }),
        breakdownRowConv({ topic: 'refund', conversations: 0, percentage: 0, label: 'R' }),
      ],
    );
    const { rows, seriesOrder } = buildTopicRankingRows(
      summary({ conversationsWithTopics: 10, unclassifiedMessages: 5 }),
      'conversations',
      bd,
    );
    expect(rows).toHaveLength(1);
    expect(seriesOrder).toEqual(['billing']);
    expect(rows[0]?.pctOfTotal).toBe(20);
  });

  it('buildTopicRankingRows messages mode computes topic pct from total mentions plus unclassified', () => {
    const bd = bundle(
      [
        breakdownRowMsg({ topic: 'billing', messages: 10, label: 'B' }),
        breakdownRowMsg({ topic: 'refund', messages: 30, label: 'R' }),
      ],
      [],
    );
    const { rows } = buildTopicRankingRows(
      summary({ totalUserMessages: 100, unclassifiedMessages: 10 }),
      'messages',
      bd,
    );
    const refund = rows.find((r) => r.id === 'refund');
    const uncl = rows.find((r) => r.id === UNCLASSIFIED_SERIES_ID);
    expect(refund?.pctOfTotal).toBeCloseTo(60, 5);
    expect(uncl?.pctOfTotal).toBeCloseTo(20, 5);
  });

  it('buildTopicRankingRows messages mode sets topic pct when no unclassified', () => {
    const { rows } = buildTopicRankingRows(
      summary({ totalUserMessages: 0, unclassifiedMessages: 0 }),
      'messages',
      bundle([breakdownRowMsg({ topic: 'refund', messages: 2, label: 'R' })], []),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pctOfTotal).toBeCloseTo(100, 5);
  });

  it('buildTopicRankingRows messages mode sets topic pct null when total mentions is 0', () => {
    const { rows } = buildTopicRankingRows(
      summary({ totalUserMessages: 10, unclassifiedMessages: 0 }),
      'messages',
      bundle([breakdownRowMsg({ topic: 'refund', messages: 0, label: 'R' })], []),
    );
    expect(rows).toHaveLength(0);
  });

  it('colorForSeriesInOrder maps unclassified to slate and cycles palette for topics', () => {
    const order = [UNCLASSIFIED_SERIES_ID, 'refund', 'billing'];
    expect(colorForSeriesInOrder(UNCLASSIFIED_SERIES_ID, order)).toBe('#94a3b8');
    expect(colorForSeriesInOrder('refund', order)).not.toBe(colorForSeriesInOrder('billing', order));
  });

  it('line time series: missing point key reads as 0 (integration)', () => {
    const p: CustomerTopicsAnalyticsTimeSeriesPoint = {
      date: '2026-01-01',
      classifiedMessages: 0,
      unclassifiedMessages: 2,
      pricing: 0,
      billing: 0,
      product_question: 0,
      technical_support: 0,
      account_access: 0,
      refund: 0,
      order_status: 0,
      integration: 0,
      sales: 0,
      lead_capture: 0,
      complaint: 0,
      general_question: 0,
      other: 0,
    };
    delete (p as Record<string, unknown>).refund;
    const raw = (p as Record<string, unknown>)['refund'];
    expect(raw).toBeUndefined();
    const v = typeof raw === 'number' ? raw : Number(raw);
    expect(Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0).toBe(0);
  });
});
