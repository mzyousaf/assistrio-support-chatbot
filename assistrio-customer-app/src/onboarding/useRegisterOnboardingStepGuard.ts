import { useLayoutEffect, useRef } from 'react';
import { registerOnboardingStepGuard, type OnboardingStepGuard } from './onboardingStepGuard';

/** Register dirty/save/discard handlers for the active onboarding step. */
export function useRegisterOnboardingStepGuard(guard: OnboardingStepGuard) {
  const guardRef = useRef(guard);
  guardRef.current = guard;

  useLayoutEffect(() => {
    return registerOnboardingStepGuard({
      isDirty: () => guardRef.current.isDirty(),
      discard: () => guardRef.current.discard(),
      save: () => guardRef.current.save(),
    });
  }, []);
}
