import { getServerLocalMonthlyBillingPeriod } from './chat-billing-period.util';

describe('getServerLocalMonthlyBillingPeriod', () => {
  it('returns month start, exclusive next month start, and YYYY-MM quota', () => {
    const ref = new Date(2026, 4, 15, 12, 0, 0, 0);
    const { billingPeriodStart, billingPeriodEnd, quotaPeriod } = getServerLocalMonthlyBillingPeriod(ref);
    expect(quotaPeriod).toBe('2026-05');
    expect(billingPeriodStart.getTime()).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).getTime());
    expect(billingPeriodEnd.getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime());
  });
});
