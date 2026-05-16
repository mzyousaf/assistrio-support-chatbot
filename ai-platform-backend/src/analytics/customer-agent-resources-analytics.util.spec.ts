import { BadRequestException } from '@nestjs/common';
import { parseCustomerAgentResourcesAnalyticsQuery } from './customer-agent-resources-analytics.util';

describe('parseCustomerAgentResourcesAnalyticsQuery', () => {
  it('defaults granularity and includePreview', () => {
    const q = parseCustomerAgentResourcesAnalyticsQuery({});
    expect(q.granularity).toBe('day');
    expect(q.includePreview).toBe(true);
  });

  it('rejects invalid granularity', () => {
    expect(() => parseCustomerAgentResourcesAnalyticsQuery({ granularity: 'quarter' })).toThrow(
      BadRequestException,
    );
  });

  it('parses runtime_widget startedFrom', () => {
    const q = parseCustomerAgentResourcesAnalyticsQuery({ startedFrom: 'RUNTIME_WIDGET' });
    expect(q.startedFrom).toBe('runtime_widget');
  });
});
