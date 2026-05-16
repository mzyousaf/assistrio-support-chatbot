import { BadRequestException } from '@nestjs/common';
import { parseCustomerTopicsAnalyticsQuery } from './customer-topics-analytics.util';

describe('parseCustomerTopicsAnalyticsQuery', () => {
  it('throws on invalid topic filter', () => {
    expect(() =>
      parseCustomerTopicsAnalyticsQuery({ topic: 'not_a_real_topic' }),
    ).toThrow(BadRequestException);
  });

  it('throws on invalid messageTopicScope', () => {
    expect(() => parseCustomerTopicsAnalyticsQuery({ messageTopicScope: 'nope' })).toThrow(
      BadRequestException,
    );
  });

  it('defaults messageTopicScope to all', () => {
    const q = parseCustomerTopicsAnalyticsQuery({});
    expect(q.messageTopicScope).toBe('all');
  });

  it('accepts messageTopicScope primary', () => {
    const q = parseCustomerTopicsAnalyticsQuery({ messageTopicScope: 'PRIMARY' });
    expect(q.messageTopicScope).toBe('primary');
  });

  it('accepts taxonomy topic ids', () => {
    const q = parseCustomerTopicsAnalyticsQuery({ topic: 'PRICING ', granularity: 'week' });
    expect(q.topic).toBe('pricing');
    expect(q.granularity).toBe('week');
  });

  it('defaults growthMetric to messages', () => {
    const q = parseCustomerTopicsAnalyticsQuery({});
    expect(q.growthMetric).toBe('messages');
  });

  it('accepts growthMetric conversations', () => {
    const q = parseCustomerTopicsAnalyticsQuery({ growthMetric: 'CONVERSATIONS' });
    expect(q.growthMetric).toBe('conversations');
  });

  it('throws on invalid growthMetric', () => {
    expect(() => parseCustomerTopicsAnalyticsQuery({ growthMetric: 'both' })).toThrow(BadRequestException);
  });
});
