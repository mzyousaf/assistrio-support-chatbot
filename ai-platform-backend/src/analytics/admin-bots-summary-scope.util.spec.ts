import { platformBotsMatchClause, customerTenantBotsMatchClause } from './admin-bots-summary-scope.util';

describe('admin-bots-summary-scope.util', () => {
  it('platformBotsMatchClause matches isPlatformBot only', () => {
    expect(platformBotsMatchClause()).toEqual({ isPlatformBot: true });
  });

  it('customerTenantBotsMatchClause excludes platform rows', () => {
    expect(customerTenantBotsMatchClause()).toEqual({
      $or: [{ isPlatformBot: { $ne: true } }, { isPlatformBot: { $exists: false } }],
    });
  });
});
