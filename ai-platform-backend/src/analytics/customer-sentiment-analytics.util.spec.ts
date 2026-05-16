import { BadRequestException } from '@nestjs/common';
import { parseCustomerSentimentAnalyticsQuery } from './customer-sentiment-analytics.util';

describe('parseCustomerSentimentAnalyticsQuery', () => {
  it('throws on invalid sentiment filter', () => {
    expect(() =>
      parseCustomerSentimentAnalyticsQuery({ sentiment: 'angry' }),
    ).toThrow(BadRequestException);
  });

  it('accepts supported sentiment labels', () => {
    const q = parseCustomerSentimentAnalyticsQuery({ sentiment: 'NEGATIVE', granularity: 'month' });
    expect(q.sentiment).toBe('negative');
    expect(q.granularity).toBe('month');
  });
});
