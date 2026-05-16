import { Navigate, Outlet } from 'react-router-dom';
import { useCustomerAuth } from '../../auth/CustomerAuthContext';
import { OnboardingFlowProvider } from '../../onboarding/OnboardingFlowContext';

/** Avoid mounting the draft lifecycle when the user has finished first-time setup. */
export function OnboardingGate() {
  const { needsOnboarding } = useCustomerAuth();

  if (needsOnboarding === false) {
    return <Navigate to="/bots" replace />;
  }

  return (
    <OnboardingFlowProvider>
      <Outlet />
    </OnboardingFlowProvider>
  );
}
