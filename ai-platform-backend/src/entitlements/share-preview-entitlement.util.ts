export const PLAN_LIMIT_SHARE_PREVIEW_CODE = 'plan_limit_share_preview' as const;

export const PLAN_LIMIT_SHARE_PREVIEW_MESSAGE =
  'Share preview links are available on paid plans.';

export type PlanLimitSharePreviewPayload = {
  message: string;
  errorCode: typeof PLAN_LIMIT_SHARE_PREVIEW_CODE;
};
