export const PLAN_LIMIT_EXPORT_REPORTS_CODE = 'plan_limit_export_reports' as const;

export const PLAN_LIMIT_EXPORT_REPORTS_MESSAGE =
  'Exporting reports requires the Starter plan or higher.';

export const ANALYTICS_HISTORY_LOCKED_HELPER =
  'Free plan includes the last 7 days of analytics.';

export const ANALYTICS_WINDOW_CLAMPED_NOTE =
  'Showing analytics available on your current plan.';

export const EXPORT_REPORTS_LOCKED_HELPER =
  'Export reports are available on Starter and Pro.';

export function resolveExportReportsSaveErrorMessage(result: {
  error?: string;
  errorCode?: string;
}): string {
  if (result.errorCode === PLAN_LIMIT_EXPORT_REPORTS_CODE) {
    return PLAN_LIMIT_EXPORT_REPORTS_MESSAGE;
  }
  return result.error?.trim() || 'Something went wrong. Please try again.';
}

export function isAnalyticsHistoryLimited(analyticsHistoryDays: number | null | undefined): boolean {
  return typeof analyticsHistoryDays === 'number' && analyticsHistoryDays > 0;
}

export function canExportReportsEntitlement(canExportReports: boolean | undefined): boolean {
  return canExportReports === true;
}
