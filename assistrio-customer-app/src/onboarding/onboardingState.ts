export const ONBOARDING_STEPS = [
  { path: 'agent-profile', label: 'Agent Profile' },
  { path: 'describe-profile', label: 'Describe Your AI Agent' },
  { path: 'knowledge-base', label: 'Knowledge Base' },
  { path: 'go-live', label: 'Deploy & Go Live' },
] as const;

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number]['path'];

export function stepIndex(path: string): number {
  return ONBOARDING_STEPS.findIndex((s) => s.path === path);
}

export function prevStepPath(path: string): string | null {
  const i = stepIndex(path);
  if (i <= 0) return null;
  return ONBOARDING_STEPS[i - 1].path;
}

export function nextStepPath(path: string): string | null {
  const i = stepIndex(path);
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[i + 1].path;
}

/** Furthest step index the user may open (0-based). Step 0 always allowed. */
export function maxReachableStepIndex(stepsCompleted: string[]): number {
  let max = 0;
  for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
    const prevPath = ONBOARDING_STEPS[i - 1].path;
    if (stepsCompleted.includes(prevPath)) max = i;
  }
  return max;
}
