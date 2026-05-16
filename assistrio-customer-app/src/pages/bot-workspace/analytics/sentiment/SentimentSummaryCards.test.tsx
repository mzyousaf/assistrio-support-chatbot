import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerSentimentAnalyticsSummary, CustomerSentimentBreakdownItem } from '@/api/types';
import { SentimentSummaryCards } from './SentimentSummaryCards';

function breakdownRow(
  sentiment: CustomerSentimentBreakdownItem['sentiment'],
  messages: number,
  label: string,
): CustomerSentimentBreakdownItem {
  return {
    sentiment,
    label,
    messages,
    conversations: 0,
    percentage: 0,
    averageScore: null,
  };
}

const baseSummary: CustomerSentimentAnalyticsSummary = {
  totalUserMessages: 120,
  classifiedMessages: 100,
  unclassifiedMessages: 20,
  sentimentCoverageRate: 100 / 120,
  averageSentimentScore: 0.42,
  dominantSentiment: 'positive',
  negativeMessages: 8,
  mixedMessages: 4,
  totalConversations: 45,
  classifiedConversations: 40,
  unclassifiedConversations: 5,
  negativeConversations: 3,
  mixedConversations: 2,
};

describe('SentimentSummaryCards', () => {
  it('renders average sentiment as a face meter (no numeric score in the card)', () => {
    const html = renderToStaticMarkup(
      <SentimentSummaryCards
        summary={baseSummary}
        dominantLabel="Positive"
        sentimentBreakdown={[
          breakdownRow('positive', 50, 'Positive'),
          breakdownRow('neutral', 30, 'Neutral'),
          breakdownRow('negative', 8, 'Negative'),
          breakdownRow('mixed', 4, 'Mixed'),
          breakdownRow('unknown', 8, 'Unknown'),
        ]}
        timeSeries={[
          {
            date: '2024-06-01T00:00:00.000Z',
            classifiedMessages: 10,
            unclassifiedMessages: 0,
            positive: 5,
            neutral: 3,
            negative: 1,
            mixed: 1,
            unknown: 0,
            averageSentimentScore: 0.25,
          },
        ]}
        granularity="day"
        metricMode="messages"
      />,
    );
    expect(html).toContain('data-testid="average-sentiment-face-meter"');
    expect(html).toContain('data-face-id="happy"');
    expect(html).toContain('data-testid="average-sentiment-band-label"');
    expect(html).toContain('Happy');
    expect(html).not.toContain('(0.1–0.49)');
    expect(html).toContain('text-teal-600');
    expect(html).not.toContain('0.42');
    expect(html).toMatch(/>\s*Happy\s*<\/p>/);
  });

  it('renders dominant sentiment label text', () => {
    const html = renderToStaticMarkup(
      <SentimentSummaryCards
        summary={{ ...baseSummary, dominantSentiment: 'negative' }}
        dominantLabel="Negative"
        sentimentBreakdown={[breakdownRow('negative', 90, 'Negative')]}
        timeSeries={[]}
        granularity="day"
        metricMode="messages"
      />,
    );
    expect(html).toContain('Negative');
    expect(html).toContain('Dominant sentiment');
  });

  it('shows an em dash for missing average score without breaking mini trend', () => {
    const html = renderToStaticMarkup(
      <SentimentSummaryCards
        summary={{ ...baseSummary, averageSentimentScore: null }}
        dominantLabel="—"
        sentimentBreakdown={[breakdownRow('positive', 0, 'Positive')]}
        timeSeries={[
          {
            date: '2024-06-01T00:00:00.000Z',
            classifiedMessages: 0,
            unclassifiedMessages: 0,
            positive: 0,
            neutral: 0,
            negative: 0,
            mixed: 0,
            unknown: 0,
            averageSentimentScore: null,
          },
        ]}
        granularity="day"
        metricMode="messages"
      />,
    );
    expect(html).toContain('data-face-id="none"');
    expect(html).not.toContain('No score data');
    expect(html).not.toContain('No score trend');
    expect(html).toContain('recharts-wrapper');
  });

  it('mini distribution handles empty totals with a safe empty state', () => {
    const html = renderToStaticMarkup(
      <SentimentSummaryCards
        summary={{ ...baseSummary, unclassifiedMessages: 0 }}
        dominantLabel="—"
        sentimentBreakdown={[
          breakdownRow('positive', 0, 'Positive'),
          breakdownRow('neutral', 0, 'Neutral'),
          breakdownRow('negative', 0, 'Negative'),
          breakdownRow('mixed', 0, 'Mixed'),
          breakdownRow('unknown', 0, 'Unknown'),
        ]}
        timeSeries={[]}
        granularity="day"
        metricMode="messages"
      />,
    );
    expect(html).toContain('No classified volume');
  });
});
