import { computeFreeTrialPeriod, FREE_TRIAL_DAYS, isTrialPeriodExpired } from './plan-trial-period.util';

describe('plan-trial-period.util', () => {
  it('free plan trial period is 7 days', () => {
    const start = new Date('2026-05-01T12:00:00.000Z');
    const { periodStart, periodEnd } = computeFreeTrialPeriod(start);

    expect(periodStart).toEqual(start);
    expect(periodEnd.getTime() - periodStart.getTime()).toBe(FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });

  it('isTrialPeriodExpired is false before trial end', () => {
    const end = new Date('2026-05-08T12:00:00.000Z');
    const now = new Date('2026-05-08T11:59:59.999Z');
    expect(isTrialPeriodExpired(end, now)).toBe(false);
  });

  it('isTrialPeriodExpired is true at or after trial end', () => {
    const end = new Date('2026-05-08T12:00:00.000Z');
    expect(isTrialPeriodExpired(end, end)).toBe(true);
    expect(isTrialPeriodExpired(end, new Date('2026-05-09T00:00:00.000Z'))).toBe(true);
  });
});
