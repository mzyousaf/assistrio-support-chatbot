import { BadRequestException } from '@nestjs/common';
import {
  parseAdminAnalyticsScopeQuery,
  parseAdminBotsSummaryQuery,
} from './admin-bots-summary-query.util';

describe('parseAdminBotsSummaryQuery', () => {
  it('defaults to scope all', () => {
    expect(parseAdminBotsSummaryQuery({})).toEqual({ scope: 'all', customerId: undefined });
  });

  it('maps platformOnly to platform scope', () => {
    expect(parseAdminBotsSummaryQuery({ platformOnly: 'true' }).scope).toBe('platform');
  });

  it('maps customerId to customer scope', () => {
    const id = '507f1f77bcf86cd799439011';
    const q = parseAdminBotsSummaryQuery({ customerId: id });
    expect(q.scope).toBe('customer');
    expect(q.customerId).toBe(id);
  });

  it('accepts explicit scope', () => {
    expect(parseAdminBotsSummaryQuery({ scope: 'platform' }).scope).toBe('platform');
    expect(parseAdminBotsSummaryQuery({ scope: 'customer' }).scope).toBe('customer');
  });

  it('rejects invalid scope', () => {
    expect(() => parseAdminBotsSummaryQuery({ scope: 'tenant' })).toThrow(BadRequestException);
  });

  it('rejects customerId with platform scope', () => {
    expect(() =>
      parseAdminBotsSummaryQuery({
        scope: 'platform',
        customerId: '507f1f77bcf86cd799439011',
      }),
    ).toThrow(BadRequestException);
  });

  it('parseAdminAnalyticsScopeQuery is an alias', () => {
    expect(parseAdminAnalyticsScopeQuery({ scope: 'platform' }).scope).toBe('platform');
  });
});
