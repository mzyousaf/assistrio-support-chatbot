import type { WorkspaceOnboardingResponse } from '@/api/types';
import { hasUserAgentInstructionsFromDraft } from './agentInstructions';
import { hasOnboardingKnowledgeFromDraft } from './onboardingKnowledge';
import type { OnboardingStepPath } from './onboardingState';

/** Whether required data for a step is satisfied (does not imply step was marked done). */
export function isOnboardingStepDataComplete(
  stepId: OnboardingStepPath,
  onboarding: WorkspaceOnboardingResponse | null,
): boolean {
  if (!onboarding) return false;
  const draft = onboarding.draft;

  switch (stepId) {
    case 'agent-profile':
      return Boolean(String(draft.profile?.name ?? '').trim());
    case 'describe-profile':
      return hasUserAgentInstructionsFromDraft(draft);
    case 'knowledge-base':
      return hasOnboardingKnowledgeFromDraft(draft, onboarding.stagedKnowledge);
    case 'go-live':
      return true;
    default:
      return false;
  }
}
