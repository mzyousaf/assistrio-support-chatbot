/**
 * Monthly billing window using the **host server's local timezone**.
 * `billingPeriodEnd` is exclusive (midnight at the start of the next calendar month, local).
 */
export function getServerLocalMonthlyBillingPeriod(now: Date = new Date()): {
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  quotaPeriod: string;
} {
  const y = now.getFullYear();
  const m = now.getMonth();
  const billingPeriodStart = new Date(y, m, 1, 0, 0, 0, 0);
  const billingPeriodEnd = new Date(y, m + 1, 1, 0, 0, 0, 0);
  const quotaPeriod = `${y}-${String(m + 1).padStart(2, '0')}`;
  return { billingPeriodStart, billingPeriodEnd, quotaPeriod };
}
