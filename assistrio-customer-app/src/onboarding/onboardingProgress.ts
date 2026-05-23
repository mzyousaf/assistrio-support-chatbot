import type { WorkspaceOnboardingResponse } from '../api/types';
import { hasUserAgentInstructionsFromDraft } from './agentInstructions';
import { hasOnboardingKnowledgeFromDraft } from './onboardingKnowledge';

/** Derive completed steps from workspace onboarding draft (backend source of truth). */
export function mergeStepsCompletedFromDraft(onboarding: WorkspaceOnboardingResponse): string[] {
  const draft = onboarding.draft;
  const set = new Set<string>([...(draft.stepsCompleted ?? [])]);

  inferStepsFromDraft(set, draft, onboarding);
  return Array.from(set);
}

function inferStepsFromDraft(
  set: Set<string>,
  draft: WorkspaceOnboardingResponse['draft'],
  onboarding: WorkspaceOnboardingResponse,
): void {
  if (String(draft.profile.name ?? '').trim()) {
    set.add('agent-profile');
  }

  if (hasUserAgentInstructionsFromDraft(draft)) {
    set.add('describe-profile');
  }

  if (hasOnboardingKnowledgeFromDraft(draft, onboarding.stagedKnowledge)) {
    set.add('knowledge-base');
  }

  if (
    onboarding.onboardingStatus === 'live_pending_install' ||
    onboarding.onboardingCreatedBotId
  ) {
    set.add('go-live');
  }
}
