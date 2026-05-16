import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Topics analytics page structure', () => {
  it('TopicsAnalyticsPage wires metric mode to header, trends, growth, and topic-by-sentiment', () => {
    const page = readFileSync(join(__dirname, 'TopicsAnalyticsPage.tsx'), 'utf8');
    expect(page).toMatch(/TopicsTopicTrendsSection/);
    expect(page).toMatch(/TopicsTopicBySentimentSection/);
    expect(page).not.toMatch(/<TopicsTopicRankingCard/);
    expect(page).toMatch(/TopicsFastestGrowingSection/);
    expect(page).not.toContain('TopicsClassificationSection');
    expect(page).toContain('TopicsMetricModeTabs');
    expect(page).toContain('title={pageTitle}');
    expect(page).toMatch(/const pageTitle = 'Topics'/);
    expect(page).toMatch(/Distribution and score trends from topic-tagged user messages/);
    expect(page).toMatch(/Distribution and score trends from conversations by primary topic/);
    expect(page).toMatch(/counts and averages only/);
    expect(page).toMatch(/subtitle=\{pageSubtitle\}/);
    expect(page).toMatch(/filters=\{/);
    expect(page).toMatch(/One message can include multiple topics/);
    expect(page).toMatch(/Each message counts toward its primary topic only/);
    expect(page).toContain('metricMode={ui.metricMode}');
    expect(page).toMatch(/fastestGrowingByMessages|fastestGrowingTopics/);
  });

  it('Topic trends section composes chart style tabs in header, ranking, and Recharts charts', () => {
    const src = readFileSync(join(__dirname, 'TopicsTopicTrendsSection.tsx'), 'utf8');
    expect(src).not.toMatch(/TopicsMetricModeTabs/);
    expect(src).not.toMatch(/TopicsAnalysisScopeTabs/);
    expect(src).toMatch(/TopicsChartStyleTabs/);
    expect(src).not.toMatch(/variant="secondary"/);
    expect(src).toMatch(/TopicsTopicRankingCard/);
    expect(src).toMatch(/TopicsOverTimeChart|TopicsDonutChart/);
  });

  it('Topics filter bar includes Topic tags scope as a FilterCapsule', () => {
    const bar = readFileSync(
      join(__dirname, '..', 'shared', 'AnalyticsInsightsFilterBars.tsx'),
      'utf8',
    );
    expect(bar).toMatch(/export function TopicsAnalyticsFilterBar/);
    expect(bar).toMatch(/function AnalysisCapsule/);
    expect(bar).toMatch(/title="Topic tags"/);
    expect(bar).toMatch(/title="Widget Channel"/);
    expect(bar).toMatch(/state\.metricMode === 'messages'/);
    expect(bar).not.toMatch(/TopicCapsule/);
  });
});
