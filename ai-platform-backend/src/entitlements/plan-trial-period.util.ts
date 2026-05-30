/** Free trial length for the Free plan tier. */
export const FREE_TRIAL_DAYS = 7;

export function computeFreeTrialPeriod(trialStart: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(trialStart);
  const periodEnd = new Date(trialStart);
  periodEnd.setDate(periodEnd.getDate() + FREE_TRIAL_DAYS);
  return { periodStart, periodEnd };
}

export function isTrialPeriodExpired(
  periodEnd: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (periodEnd == null) return false;
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return false;
  return now.getTime() >= end.getTime();
}
