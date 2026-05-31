import type { WorkspaceEntitlements } from '../entitlements/workspace-entitlements.types';
import {
  readAiCreditsAutoTopUpPromptEnabled,
  readAutoTopUpThresholdCredits,
} from './billing-credit-auto-topup.util';

export function resolveCanAutoTopUpPrompt(input: {
  subscription: {
    aiCreditsAutoTopUpPromptEnabled?: boolean | null;
    creditAutoTopUpEnabled?: boolean | null;
    autoTopUpThresholdCredits?: number | null;
  } | null;
  entitlements: Pick<
    WorkspaceEntitlements,
    'isTrialExpired' | 'addonsAllowed' | 'isTrialPlan' | 'planKey'
  >;
  totalCreditsRemaining: number;
}): boolean {
  if (!readAiCreditsAutoTopUpPromptEnabled(input.subscription)) return false;
  if (input.entitlements.isTrialExpired) return false;
  if (!input.entitlements.addonsAllowed) return false;
  if (input.entitlements.isTrialPlan || input.entitlements.planKey === 'free') return false;

  const threshold = readAutoTopUpThresholdCredits(input.subscription);
  return input.totalCreditsRemaining <= threshold;
}
