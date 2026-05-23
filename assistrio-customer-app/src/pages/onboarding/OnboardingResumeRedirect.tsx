import { Navigate } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { onboardingResumePath } from '../../onboarding/resolveOnboardingResumeStep';

/** Index route for `/onboarding` — resume from backend draft state. */
export function OnboardingResumeRedirect() {
  const { onboarding } = useOnboardingFlow();
  return <Navigate to={onboardingResumePath(onboarding)} replace />;
}
