import type { UpgradePlanReason } from '@/lib/planLimitError';

export type UpgradePlanModalReason = UpgradePlanReason;

export type PaidPlanFeatureCalloutCopy = {
  title: string;
  description: string;
  reason: UpgradePlanModalReason;
};

export const PAID_PLAN_FEATURE_CALLOUT_PRESETS: Record<
  UpgradePlanModalReason,
  PaidPlanFeatureCalloutCopy
> = {
  auto_train: {
    title: 'Auto-train is available on paid plans',
    description:
      'Upgrade to Starter or Pro to automatically train your agent when knowledge changes.',
    reason: 'auto_train',
  },
  members: {
    title: 'Invite teammates on a paid plan',
    description: 'Upgrade to Starter or Pro to collaborate with your team.',
    reason: 'members',
  },
  addons: {
    title: 'Add-ons are available on paid plans',
    description:
      'Upgrade first, then add more credits, agents, or branding options.',
    reason: 'addons',
  },
  export: {
    title: 'Export reports on Starter and Pro',
    description: 'Upgrade to export reports and leads for your team.',
    reason: 'export',
  },
  branding: {
    title: 'Remove Assistrio branding with an add-on',
    description:
      'Upgrade to a paid plan and use the branding add-on when checkout is available.',
    reason: 'branding',
  },
  trained_knowledge: {
    title: 'Need more trained knowledge storage?',
    description: 'Upgrade to Starter or Pro for a higher trained knowledge limit per agent.',
    reason: 'trained_knowledge',
  },
  credits: {
    title: "You've reached your current plan limit",
    description: 'Upgrade to continue using this feature.',
    reason: 'credits',
  },
  trial_expired: {
    title: "You've reached your current plan limit",
    description: 'Upgrade to continue using this feature.',
    reason: 'trial_expired',
  },
  bots: {
    title: "You've reached your current plan limit",
    description: 'Upgrade to continue using this feature.',
    reason: 'bots',
  },
  share_preview: {
    title: 'Share preview links',
    description: 'Share preview links are available on paid plans.',
    reason: 'share_preview',
  },
};

export function resolvePaidPlanFeatureCalloutPreset(
  reason: UpgradePlanModalReason,
): PaidPlanFeatureCalloutCopy {
  return PAID_PLAN_FEATURE_CALLOUT_PRESETS[reason];
}
