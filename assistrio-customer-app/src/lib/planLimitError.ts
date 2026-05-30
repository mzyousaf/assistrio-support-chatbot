export type UpgradePlanReason =
  | 'credits'
  | 'trial_expired'
  | 'members'
  | 'bots'
  | 'trained_knowledge'
  | 'auto_train'
  | 'export'
  | 'branding'
  | 'addons';

export const PLAN_LIMIT_AI_CREDITS_CODE = 'plan_limit_ai_credits' as const;
export const FREE_TRIAL_EXPIRED_CODE = 'free_trial_expired' as const;
export const PLAN_LIMIT_WORKSPACE_MEMBERS_CODE = 'plan_limit_workspace_members' as const;
export const PLAN_LIMIT_WORKSPACE_BOTS_CODE = 'plan_limit_workspace_bots' as const;
export const WORKSPACE_BOT_LIMIT_EXCEEDED_CODE = 'workspace_bot_limit_exceeded' as const;
export const WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE =
  'This agent is inactive because your workspace is over its agent limit.';
export const PLAN_LIMIT_BOT_KB_TOTAL_CODE = 'plan_limit_bot_kb_total' as const;
export const PLAN_LIMIT_AUTO_TRAIN_CODE = 'plan_limit_auto_train' as const;
export const PLAN_LIMIT_EXPORT_REPORTS_CODE = 'plan_limit_export_reports' as const;
export const PLAN_LIMIT_REMOVE_BRANDING_CODE = 'plan_limit_remove_branding' as const;

const ERROR_CODE_TO_REASON: Record<string, UpgradePlanReason> = {
  [PLAN_LIMIT_AI_CREDITS_CODE]: 'credits',
  [FREE_TRIAL_EXPIRED_CODE]: 'trial_expired',
  [PLAN_LIMIT_WORKSPACE_MEMBERS_CODE]: 'members',
  [PLAN_LIMIT_WORKSPACE_BOTS_CODE]: 'bots',
  [WORKSPACE_BOT_LIMIT_EXCEEDED_CODE]: 'bots',
  [PLAN_LIMIT_BOT_KB_TOTAL_CODE]: 'trained_knowledge',
  [PLAN_LIMIT_AUTO_TRAIN_CODE]: 'auto_train',
  [PLAN_LIMIT_EXPORT_REPORTS_CODE]: 'export',
  [PLAN_LIMIT_REMOVE_BRANDING_CODE]: 'branding',
};

export function mapPlanLimitErrorCodeToUpgradeReason(
  errorCode: string | null | undefined,
): UpgradePlanReason | null {
  const code = typeof errorCode === 'string' ? errorCode.trim() : '';
  if (!code) return null;
  return ERROR_CODE_TO_REASON[code] ?? null;
}

export function isChatUpgradeModalErrorCode(errorCode: string | null | undefined): boolean {
  const code = typeof errorCode === 'string' ? errorCode.trim() : '';
  return code === PLAN_LIMIT_AI_CREDITS_CODE || code === FREE_TRIAL_EXPIRED_CODE;
}

export function resolveUpgradePlanReasonSubtitle(reason: UpgradePlanReason): string {
  switch (reason) {
    case 'credits':
      return 'Your workspace has used all available AI credits.';
    case 'trial_expired':
      return 'Your free trial has ended.';
    case 'members':
      return 'Upgrade to invite teammates.';
    case 'bots':
      return 'Upgrade or add an extra agent to create more agents.';
    case 'trained_knowledge':
      return 'Upgrade for more trained knowledge storage.';
    case 'auto_train':
      return 'Auto-train is available on paid plans.';
    case 'export':
      return 'Export reports are available on Starter and Pro.';
    case 'branding':
      return 'Removing Assistrio branding requires the branding add-on.';
    case 'addons':
      return 'Add-ons are available on paid plans.';
    default:
      return 'Upgrade your plan to unlock this feature.';
  }
}

export function defaultRecommendedPlanKeyForReason(
  reason: UpgradePlanReason,
): 'starter' | 'pro' {
  switch (reason) {
    case 'credits':
    case 'bots':
    case 'trained_knowledge':
      return 'pro';
    case 'members':
    case 'trial_expired':
    case 'auto_train':
    case 'export':
    case 'branding':
    case 'addons':
    default:
      return 'starter';
  }
}

export const PLAN_LIMIT_UPGRADE_EVENT = 'assistrio:open-upgrade-plan-modal' as const;

export type PlanLimitUpgradeEventDetail = {
  errorCode?: string;
  reason?: UpgradePlanReason;
  recommendedPlanKey?: 'starter' | 'pro';
};

export function isWorkspaceBotOverLimitLockedError(
  result: { errorCode?: string | null | undefined },
): boolean {
  const code = typeof result.errorCode === 'string' ? result.errorCode.trim() : '';
  return code === WORKSPACE_BOT_LIMIT_EXCEEDED_CODE;
}

export function dispatchPlanLimitUpgradeModal(detail: PlanLimitUpgradeEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLAN_LIMIT_UPGRADE_EVENT, { detail }));
}
