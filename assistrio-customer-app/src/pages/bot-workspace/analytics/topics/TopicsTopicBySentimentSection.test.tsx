import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerTopicsAnalyticsResponse } from '@/api/types';
import { TopicsTopicBySentimentSection } from './TopicsTopicBySentimentSection';

const __dirname = dirname(fileURLToPath(import.meta.url));

function minimalTopicsResponse(
  topicSentimentBreakdown: CustomerTopicsAnalyticsResponse['topicSentimentBreakdown'],
): CustomerTopicsAnalyticsResponse {
  return {
    range: { from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', granularity: 'day' },
    summary: {
      totalUserMessages: 1,
      classifiedMessages: 1,
      unclassifiedMessages: 0,
      conversationsWithTopics: 1,
      topTopic: 'billing',
      topicCoverageRate: 1,
    },
    timeSeries: [],
    topicBreakdown: [],
    topicBreakdownByMessages: [],
    topicBreakdownByConversations: [],
    topicMessageTimeSeries: [],
    topicConversationTimeSeries: [],
    fastestGrowingByMessages: [],
    fastestGrowingByConversations: [],
    topicSentimentBreakdown,
  };
}

describe('TopicsTopicBySentimentSection', () => {
  it('does not import a hardcoded topic taxonomy list', () => {
    const src = readFileSync(join(__dirname, 'TopicsTopicBySentimentSection.tsx'), 'utf8');
    expect(src).not.toMatch(/TOPIC_DISPLAY_FALLBACK|TOPIC_TAXONOMY_ORDER|CUSTOMER_TOPICS_ANALYTICS_MAIN_TOPIC_IDS/);
  });

  it('shows empty state when topicSentimentBreakdown is empty', () => {
    const html = renderToStaticMarkup(
      <TopicsTopicBySentimentSection data={minimalTopicsResponse([])} metricMode="messages" />,
    );
    expect(html).toContain('No topic sentiment data for this range.');
  });

  it('in conversations mode, prompts to switch to By messages', () => {
    const html = renderToStaticMarkup(
      <TopicsTopicBySentimentSection data={minimalTopicsResponse([])} metricMode="conversations" />,
    );
    expect(html).toContain('By messages');
    expect(html).toContain('Topic sentiment is measured on user messages');
  });

  it('builds chart categories from topicSentimentBreakdown rows (labels from API)', () => {
    const src = readFileSync(join(__dirname, 'TopicsTopicBySentimentSection.tsx'), 'utf8');
    expect(src).toContain('data.topicSentimentBreakdown');
    expect(src).toMatch(/topicLabel:\s*r\.label/);
    expect(src).toContain('dataKey="topicLabel"');
  });
});
