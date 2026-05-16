import type { TopicTaxonomyId } from './topic-sentiment-classification.constants';

export type FastestGrowingTopicItem = {
  topic: TopicTaxonomyId;
  label: string;
  currentCount: number;
  previousCount: number;
  change: number;
  changePercent: number | null;
  growthLabel: 'New' | null;
  messages: number;
  conversations: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isTaxonomyTopicId(id: string, keys: readonly string[]): id is TopicTaxonomyId {
  return (keys as readonly string[]).includes(id);
}

/**
 * Compares current vs previous equal-length windows. Only topics with strictly positive change.
 * Sort: positive finite changePercent first (desc), then by change (desc).
 */
export function computeFastestGrowingTopics(
  growthMetric: 'messages' | 'conversations',
  topicAnalyticsKeys: readonly TopicTaxonomyId[],
  labelForTopicId: (id: TopicTaxonomyId) => string,
  currentMsgs: Map<string, number>,
  currentConvs: Map<string, number>,
  prevMsgs: Map<string, number>,
  prevConvs: Map<string, number>,
  limit = 10,
): FastestGrowingTopicItem[] {
  const keys = new Set<string>();
  for (const m of currentMsgs.keys()) keys.add(m);
  for (const m of currentConvs.keys()) keys.add(m);
  for (const m of prevMsgs.keys()) keys.add(m);
  for (const m of prevConvs.keys()) keys.add(m);

  const rows: FastestGrowingTopicItem[] = [];

  for (const raw of keys) {
    if (!isTaxonomyTopicId(raw, topicAnalyticsKeys)) continue;
    const topic = raw;
    const messages = Math.trunc(currentMsgs.get(topic) ?? 0);
    const conversations = Math.trunc(currentConvs.get(topic) ?? 0);
    const pm = Math.trunc(prevMsgs.get(topic) ?? 0);
    const pc = Math.trunc(prevConvs.get(topic) ?? 0);

    const currentCount = growthMetric === 'messages' ? messages : conversations;
    const previousCount = growthMetric === 'messages' ? pm : pc;
    const change = currentCount - previousCount;
    if (change <= 0) continue;

    let changePercent: number | null = null;
    let growthLabel: 'New' | null = null;
    if (previousCount === 0 && currentCount > 0) {
      changePercent = null;
      growthLabel = 'New';
    } else if (previousCount > 0) {
      changePercent = round1(((currentCount - previousCount) / previousCount) * 100);
    }

    rows.push({
      topic,
      label: labelForTopicId(topic),
      currentCount,
      previousCount,
      change,
      changePercent,
      growthLabel,
      messages,
      conversations,
    });
  }

  rows.sort((a, b) => {
    const aPos = a.changePercent != null && Number.isFinite(a.changePercent) && a.changePercent > 0;
    const bPos = b.changePercent != null && Number.isFinite(b.changePercent) && b.changePercent > 0;
    if (aPos && bPos) return (b.changePercent ?? 0) - (a.changePercent ?? 0);
    if (aPos && !bPos) return -1;
    if (!aPos && bPos) return 1;
    return b.change - a.change;
  });

  return rows.slice(0, limit);
}
