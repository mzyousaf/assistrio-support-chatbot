/** Workspace-level first-time setup lifecycle (Epic 3B). */
export const WORKSPACE_ONBOARDING_STATUSES = [
  'not_started',
  'in_progress',
  'live_pending_install',
  'completed',
] as const;

export type WorkspaceOnboardingStatus = (typeof WORKSPACE_ONBOARDING_STATUSES)[number];

export const WORKSPACE_ONBOARDING_STEPS = [
  'agent-profile',
  'describe-profile',
  'knowledge-base',
  'go-live',
  'you-are-live',
] as const;

export type WorkspaceOnboardingStep = (typeof WORKSPACE_ONBOARDING_STEPS)[number];

/** Customer-facing steps before install/complete. */
export const WORKSPACE_ONBOARDING_FLOW_STEPS = WORKSPACE_ONBOARDING_STEPS.slice(0, 4);

export function nextOnboardingFlowStep(stepId: WorkspaceOnboardingStep): WorkspaceOnboardingStep | null {
  const idx = (WORKSPACE_ONBOARDING_FLOW_STEPS as readonly string[]).indexOf(stepId);
  if (idx < 0 || idx >= WORKSPACE_ONBOARDING_FLOW_STEPS.length - 1) return null;
  return WORKSPACE_ONBOARDING_FLOW_STEPS[idx + 1]!;
}

export const DEFAULT_WORKSPACE_ONBOARDING_STATUS: WorkspaceOnboardingStatus = 'not_started';
export const DEFAULT_WORKSPACE_ONBOARDING_STEP: WorkspaceOnboardingStep = 'agent-profile';

export function isWorkspaceOnboardingStatus(value: unknown): value is WorkspaceOnboardingStatus {
  return typeof value === 'string' && (WORKSPACE_ONBOARDING_STATUSES as readonly string[]).includes(value);
}

export function isWorkspaceOnboardingStep(value: unknown): value is WorkspaceOnboardingStep {
  return typeof value === 'string' && (WORKSPACE_ONBOARDING_STEPS as readonly string[]).includes(value);
}
