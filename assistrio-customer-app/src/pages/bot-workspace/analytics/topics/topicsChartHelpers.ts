import type {
  CustomerTopicBreakdownByConversationItem,
  CustomerTopicBreakdownByMessagesItem,
  CustomerTopicsAnalyticsSummary,
  CustomerTopicsAnalyticsTopicId,
} from '@/api/types';

export const UNCLASSIFIED_SERIES_ID = 'unclassified';

/** Muted slate for unclassified (not alarm red). */
export const UNCLASSIFIED_LINE_COLOR = '#94a3b8';

/** Palette for classified topics only (order follows dynamic ranking, not taxonomy). */
export const TOPIC_SERIES_PALETTE = [
  '#0d9488',
  '#6366f1',
  '#9333ea',
  '#d97706',
  '#f43f5e',
  '#0891b2',
  '#4f46e5',
  '#c026d3',
  '#64748b',
  '#ea580c',
  '#14b8a6',
  '#7c3aed',
  '#db2777',
] as const;

export type TopicsChartStyle = 'line' | 'donut';

/** Card / modal title for the topic trends chart (matches selected view: Trends or Distribution). */
export function topicsTrendChartTitle(chartStyle: TopicsChartStyle): string {
  return chartStyle === 'donut' ? 'Topic Distribution' : 'Topic Trends';
}

/** How topic volumes are counted on the Topics analytics chart. */
export type TopicsMetricMode = 'messages' | 'conversations';

export type TopicRankingRow = {
  id: string;
  label: string;
  count: number;
  /**
   * Messages mode: % of (topic mentions + unclassified when shown). Conversations mode: API `percentage`.
   */
  pctOfTotal: number | null;
  /**
   * Cross-metric context from API breakdown: chats per topic when metric is messages, else mentions.
   */
  secondaryCount: number | null;
};

export const EMPTY_TOPIC_RANKING: { rows: TopicRankingRow[]; seriesOrder: string[] } = {
  rows: [],
  seriesOrder: [],
};

export function humanizeTopicKey(topic: string): string {
  const t = topic.replace(/_/g, ' ').trim();
  if (!t) return 'Topic';
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function topicDisplayLabel(
  row: CustomerTopicBreakdownByMessagesItem | CustomerTopicBreakdownByConversationItem,
): string {
  const l = row.label?.trim();
  if (l) return l;
  return humanizeTopicKey(row.topic);
}

/**
 * Topic filter dropdown order from API breakdown only (no static taxonomy).
 * Tie-break order matches backend breakdown sort, then flips primary key by metric mode.
 */
export function topicIdsForAnalyticsFilter(
  topicBreakdown: CustomerTopicBreakdownByMessagesItem[] | CustomerTopicBreakdownByConversationItem[],
  metricMode: TopicsMetricMode,
): CustomerTopicsAnalyticsTopicId[] {
  if (metricMode === 'messages') {
    const rows = (topicBreakdown as CustomerTopicBreakdownByMessagesItem[]).map((b) => ({ ...b }));
    rows.sort(
      (a, b) =>
        b.messages - a.messages ||
        b.conversations - a.conversations ||
        a.topic.localeCompare(b.topic),
    );
    return rows.filter((r) => r.messages > 0).map((r) => r.topic);
  }
  const rows = (topicBreakdown as CustomerTopicBreakdownByConversationItem[]).map((b) => ({ ...b }));
  rows.sort(
    (a, b) =>
      b.conversations - a.conversations ||
      a.topic.localeCompare(b.topic),
  );
  return rows.filter((r) => r.conversations > 0).map((r) => r.topic);
}

/** First N rows of the ranking list (same order as {@link buildTopicRankingRows} count-desc). */
export function topicRankingRowsVisibleSlice(
  rankingRows: TopicRankingRow[],
  maxVisible: number,
): TopicRankingRow[] {
  if (maxVisible >= rankingRows.length) return rankingRows;
  return rankingRows.slice(0, maxVisible);
}

export type TopicsBreakdownBundle = {
  topicBreakdownByMessages: CustomerTopicBreakdownByMessagesItem[];
  topicBreakdownByConversations: CustomerTopicBreakdownByConversationItem[];
};

/**
 * Ranking + chart series order from API topic breakdown only.
 * Messages: topics with `messages > 0`; optional Unclassified when `summary.unclassifiedMessages > 0`.
 * Conversations: topics with `conversations > 0` only (no Unclassified).
 */
export function buildTopicRankingRows(
  summary: CustomerTopicsAnalyticsSummary,
  mode: TopicsMetricMode = 'messages',
  breakdown: TopicsBreakdownBundle,
): { rows: TopicRankingRow[]; seriesOrder: string[] } {
  const rows: TopicRankingRow[] = [];

  if (mode === 'messages') {
    const topicBreakdown = breakdown.topicBreakdownByMessages;
    let totalMentions = 0;
    for (const b of topicBreakdown) {
      totalMentions += Math.max(0, Math.trunc(Number(b.messages ?? 0)));
    }
    const unclassified = Math.max(0, Math.trunc(Number(summary.unclassifiedMessages ?? 0)));
    const totalForPct = totalMentions + (unclassified > 0 ? unclassified : 0);

    for (const b of topicBreakdown) {
      const m = Math.max(0, Math.trunc(Number(b.messages ?? 0)));
      if (m <= 0) continue;
      rows.push({
        id: b.topic,
        label: topicDisplayLabel(b),
        count: m,
        pctOfTotal: null,
        secondaryCount: Math.max(0, Math.trunc(Number(b.conversations ?? 0))),
      });
    }

    for (const r of rows) {
      r.pctOfTotal = totalForPct > 0 ? (r.count / totalForPct) * 100 : null;
    }

    rows.sort((a, b) => b.count - a.count);

    if (unclassified > 0) {
      rows.push({
        id: UNCLASSIFIED_SERIES_ID,
        label: 'Unclassified',
        count: unclassified,
        pctOfTotal: totalForPct > 0 ? (unclassified / totalForPct) * 100 : null,
        secondaryCount: null,
      });
    }

    const seriesOrder = rows.map((r) => r.id);
    return { rows, seriesOrder };
  }

  const topicBreakdown = breakdown.topicBreakdownByConversations;
  for (const b of topicBreakdown) {
    const c = Math.max(0, Math.trunc(Number(b.conversations ?? 0)));
    if (c <= 0) continue;
    const pct = Number(b.percentage);
    rows.push({
      id: b.topic,
      label: topicDisplayLabel(b),
      count: c,
      pctOfTotal: Number.isFinite(pct) ? pct : null,
      secondaryCount: null,
    });
  }

  rows.sort((a, b) => b.count - a.count);
  const seriesOrder = rows.map((r) => r.id);
  return { rows, seriesOrder };
}

/** Color for a series id given the dynamic `seriesOrder` (post-sort ranking order). */
export function colorForSeriesInOrder(seriesId: string, orderedSeriesIds: string[]): string {
  if (seriesId === UNCLASSIFIED_SERIES_ID) return UNCLASSIFIED_LINE_COLOR;
  const classifiedOnly = orderedSeriesIds.filter((id) => id !== UNCLASSIFIED_SERIES_ID);
  const idx = classifiedOnly.indexOf(seriesId);
  const slot = idx >= 0 ? idx : 0;
  return TOPIC_SERIES_PALETTE[slot % TOPIC_SERIES_PALETTE.length]!;
}
