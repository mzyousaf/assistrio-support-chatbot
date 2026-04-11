import {
  getTrialSetupStepIndex,
  isKnowledgeBaseMinimumContentMet,
  isSetupStepComplete,
  isTrialOnboardingComplete,
  TRIAL_SETUP_STEPS,
  type TrialSetupStepId,
  type TrialWorkspaceDraftV3,
} from "@/lib/trial/trial-workspace-draft";

const CREATING_PATH = "/trial/dashboard/setup/creating";

/**
 * Bottom-bar navigation for setup steps — uses same unlock rules as the left rail (maxUnlocked index).
 */
export function getSetupWorkspaceNav(
  stepId: TrialSetupStepId,
  draft: TrialWorkspaceDraftV3,
): {
  backPath: string | null;
  forwardPath: string;
  forwardLabel: "Next" | "Go Live" | "Create AI Agent";
  forwardDisabled: boolean;
} {
  const i = getTrialSetupStepIndex(stepId);

  const backPath = i > 0 ? TRIAL_SETUP_STEPS[i - 1]!.path : null;

  if (i < TRIAL_SETUP_STEPS.length - 1) {
    const nextStep = TRIAL_SETUP_STEPS[i + 1]!;
    const isKnowledgeStep = stepId === "knowledge-base";
    const forwardDisabled = isKnowledgeStep ? !isKnowledgeBaseMinimumContentMet(draft) : !isSetupStepComplete(i, draft);
    return {
      backPath,
      forwardPath: nextStep.path,
      forwardLabel: isKnowledgeStep ? "Go Live" : "Next",
      forwardDisabled,
    };
  }

  const forwardDisabled = !isTrialOnboardingComplete(draft);
  return {
    backPath,
    forwardPath: CREATING_PATH,
    forwardLabel: "Create AI Agent",
    forwardDisabled,
  };
}
