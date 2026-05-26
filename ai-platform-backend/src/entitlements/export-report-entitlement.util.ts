export const PLAN_LIMIT_EXPORT_REPORTS_CODE = 'plan_limit_export_reports' as const;

export const PLAN_LIMIT_EXPORT_REPORTS_MESSAGE =
  'Exporting reports requires the Starter plan or higher.';

export type PlanLimitExportReportsPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_EXPORT_REPORTS_CODE;
};
