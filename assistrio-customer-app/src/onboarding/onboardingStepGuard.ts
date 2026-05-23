export type OnboardingStepGuard = {
  isDirty: () => boolean;
  discard: () => void;
  /** Persist draft changes without advancing the wizard. Returns true when saved. */
  save: () => Promise<boolean>;
};

let activeGuard: OnboardingStepGuard | null = null;

export function registerOnboardingStepGuard(guard: OnboardingStepGuard): () => void {
  activeGuard = guard;
  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
}

export function getOnboardingStepGuard(): OnboardingStepGuard | null {
  return activeGuard;
}

export function hasOnboardingStepDirty(): boolean {
  return activeGuard?.isDirty() ?? false;
}

export function discardOnboardingStepChanges(): void {
  activeGuard?.discard();
}

export async function saveOnboardingStepChanges(): Promise<boolean> {
  const guard = activeGuard;
  if (!guard) return true;
  return guard.save();
}
